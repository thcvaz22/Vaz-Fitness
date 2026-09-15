import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { applyCors } from './cors.js';

function db(){if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL não configurada.');return neon(process.env.DATABASE_URL)}
function tokenHash(v){return crypto.createHash('sha256').update(String(v)).digest('hex')}
function clean(v='',max=160){return String(v??'').trim().slice(0,max)}
function sendError(res,status,message,code='error'){return res.status(status).json({ok:false,error:code,message})}
async function auth(req){
  const h=String(req.headers?.authorization||''),token=h.startsWith('Bearer ')?h.slice(7).trim():'';
  if(!token)return null;
  const sql=db();
  const rows=await sql`SELECT u.id,u.role,u.name,u.account_status FROM vf_sessions s JOIN vf_users u ON u.id=s.user_id WHERE s.token_hash=${tokenHash(token)} AND s.expires_at>now() LIMIT 1`;
  const user=rows[0]||null;
  if(!user||user.account_status!=='approved'||!['admin','personal'].includes(user.role))return null;
  return {sql,user};
}
async function audit(sql,actor,target,action,payload={}){
  try{await sql`INSERT INTO vf_admin_audit_log(actor_id,target_user_id,action,payload) VALUES (${actor},${target},${action},CAST(${JSON.stringify(payload)} AS jsonb))`}catch{}
}
function mapPlan(r={}){return {code:r.code,name:r.name,studentLimit:Number(r.student_limit)||0,monthlyPrice:Number(r.monthly_price)||0,activationFee:Number(r.activation_fee)||0,isActive:r.is_active!==false,sortOrder:Number(r.sort_order)||0}}
function mapAssignment(r={}){const used=Number(r.student_count)||0,limit=Number(r.student_limit)||0;return {personalId:r.personal_id,planCode:r.plan_code||null,planName:r.plan_name||null,monthlyAmount:r.monthly_amount==null?null:Number(r.monthly_amount),studentLimit:limit,studentCount:used,remaining:Math.max(0,limit-used),overLimit:limit>0&&used>limit,usagePercent:limit>0?Math.min(999,Math.round((used/limit)*100)):0}}
async function getAssignment(sql,personalId){
  const rows=await sql`SELECT s.personal_id,s.plan_code,s.monthly_amount,p.name AS plan_name,p.student_limit,
    (SELECT count(*)::int FROM vf_athlete_access a WHERE a.personal_id=s.personal_id) AS student_count
    FROM vf_personal_subscriptions s LEFT JOIN vf_personal_plans p ON p.code=s.plan_code
    WHERE s.personal_id=${personalId} LIMIT 1`;
  return rows[0]?mapAssignment(rows[0]):{personalId,planCode:null,planName:null,monthlyAmount:null,studentLimit:0,studentCount:0,remaining:0,overLimit:false,usagePercent:0};
}

export default async function personalPlanHandler(req,res){
  if(applyCors(req,res))return;
  res.setHeader('Cache-Control','no-store');
  const a=await auth(req);if(!a)return sendError(res,401,'Sessão inválida.','unauthorized');
  const {sql,user}=a,action=clean(req.query?.action||req.body?.action,40),method=String(req.method||'GET').toUpperCase();
  try{
    if(action==='summary'&&method==='GET'){
      const plans=(await sql`SELECT code,name,student_limit,monthly_price,activation_fee,is_active,sort_order FROM vf_personal_plans WHERE is_active=true ORDER BY sort_order,student_limit`).map(mapPlan);
      if(user.role==='personal')return res.status(200).json({ok:true,plans,assignment:await getAssignment(sql,user.id)});
      const rows=await sql`SELECT u.id AS personal_id,s.plan_code,s.monthly_amount,p.name AS plan_name,p.student_limit,
        (SELECT count(*)::int FROM vf_athlete_access a WHERE a.personal_id=u.id) AS student_count
        FROM vf_users u LEFT JOIN vf_personal_subscriptions s ON s.personal_id=u.id LEFT JOIN vf_personal_plans p ON p.code=s.plan_code
        WHERE u.role='personal' ORDER BY u.created_at DESC`;
      return res.status(200).json({ok:true,plans,assignments:rows.map(mapAssignment)});
    }

    if(user.role!=='admin')return sendError(res,403,'Apenas o administrador pode alterar planos.','forbidden');

    if(action==='approve'&&method==='POST'){
      const personalId=clean(req.body?.personalId,120),planCode=clean(req.body?.planCode,40);
      const pRows=await sql`SELECT code,name,student_limit,monthly_price FROM vf_personal_plans WHERE code=${planCode} AND is_active=true LIMIT 1`;
      const plan=pRows[0];if(!plan)return sendError(res,400,'Selecione um plano válido.','invalid_plan');
      const target=await sql`SELECT id,account_status FROM vf_users WHERE id=${personalId} AND role='personal' LIMIT 1`;if(!target.length)return sendError(res,404,'Personal não encontrado.','not_found');
      await sql`UPDATE vf_users SET account_status='approved',updated_at=now() WHERE id=${personalId}`;
      await sql`INSERT INTO vf_personal_subscriptions(personal_id,plan_code,monthly_amount,payment_status,updated_at) VALUES (${personalId},${plan.code},${plan.monthly_price},'current',now())
        ON CONFLICT(personal_id) DO UPDATE SET plan_code=EXCLUDED.plan_code,monthly_amount=EXCLUDED.monthly_amount,updated_at=now()`;
      await sql`UPDATE vf_athlete_access SET status='approved',suspended_reason=NULL,updated_at=now() WHERE personal_id=${personalId} AND status='suspended' AND suspended_reason='[ADMIN_PERSONAL_SUSPENDED]'`;
      await audit(sql,user.id,personalId,'personal_approved_with_plan',{planCode:plan.code,studentLimit:Number(plan.student_limit),monthlyPrice:Number(plan.monthly_price)});
      return res.status(200).json({ok:true,status:'approved',assignment:await getAssignment(sql,personalId)});
    }

    if(action==='set_plan'&&method==='POST'){
      const personalId=clean(req.body?.personalId,120),planCode=clean(req.body?.planCode,40);
      const pRows=await sql`SELECT code,name,student_limit,monthly_price FROM vf_personal_plans WHERE code=${planCode} AND is_active=true LIMIT 1`;
      const plan=pRows[0];if(!plan)return sendError(res,400,'Selecione um plano válido.','invalid_plan');
      const target=await sql`SELECT id FROM vf_users WHERE id=${personalId} AND role='personal' LIMIT 1`;if(!target.length)return sendError(res,404,'Personal não encontrado.','not_found');
      await sql`INSERT INTO vf_personal_subscriptions(personal_id,plan_code,monthly_amount,payment_status,updated_at) VALUES (${personalId},${plan.code},${plan.monthly_price},'current',now())
        ON CONFLICT(personal_id) DO UPDATE SET plan_code=EXCLUDED.plan_code,monthly_amount=EXCLUDED.monthly_amount,updated_at=now()`;
      const assignment=await getAssignment(sql,personalId);
      await audit(sql,user.id,personalId,'personal_plan_changed',{planCode:plan.code,studentLimit:Number(plan.student_limit),monthlyPrice:Number(plan.monthly_price),studentCount:assignment.studentCount,overLimit:assignment.overLimit});
      return res.status(200).json({ok:true,assignment,warning:assignment.overLimit?'O personal já possui mais alunos que o limite do novo plano. Novos vínculos ficarão bloqueados até ficar dentro do limite.':null});
    }

    return sendError(res,405,'Operação não permitida.','method_not_allowed');
  }catch(error){console.error('Personal plan API error',String(error?.message||'').slice(0,180));return sendError(res,500,'Não foi possível concluir a operação de plano agora.','server_error')}
}
