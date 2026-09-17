import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { applyCors } from './cors.js';
import { ensureSelfCoachedAccess } from './self-coached-access.js';

function db(){if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL não configurada.');return neon(process.env.DATABASE_URL)}
function tokenHash(v){return crypto.createHash('sha256').update(String(v)).digest('hex')}
function clean(v='',max=160){return String(v??'').trim().slice(0,max)}
function dateISO(v){const x=clean(v,10);return /^\d{4}-\d{2}-\d{2}$/.test(x)?x:null}
function money(v){if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=99999999?n:null}
function sendError(res,status,message,code='error'){return res.status(status).json({ok:false,error:code,message})}
function today(){return new Date().toISOString().slice(0,10)}
function addMonth(dateStr){const [y,m,d]=dateStr.split('-').map(Number),first=new Date(Date.UTC(y,m,1)),last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();return `${first.getUTCFullYear()}-${String(first.getUTCMonth()+1).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`}
async function auth(req){const h=String(req.headers?.authorization||''),token=h.startsWith('Bearer ')?h.slice(7).trim():'';if(!token)return null;const sql=db();const rows=await sql`SELECT u.id,u.role,u.name,u.account_status FROM vf_sessions s JOIN vf_users u ON u.id=s.user_id WHERE s.token_hash=${tokenHash(token)} AND s.expires_at>now() LIMIT 1`;const user=rows[0];return user?.role==='admin'&&user.account_status==='approved'?{sql,user}:null}
async function audit(sql,actor,target,action,payload={}){await sql`INSERT INTO vf_admin_audit_log(actor_id,target_user_id,action,payload) VALUES (${actor},${target},${action},CAST(${JSON.stringify(payload)} AS jsonb))`}
function subInfo(r={}){const due=r.next_due_date?String(r.next_due_date).slice(0,10):null,pending=r.payment_status==='pending'||(due&&due<=today());return {amount:r.monthly_amount==null?null:Number(r.monthly_amount),nextDueDate:due,paymentStatus:pending?'pending':'current',notes:r.subscription_notes||''}}

export default async function adminHandler(req,res){
  if(applyCors(req,res))return;
  const a=await auth(req);if(!a)return sendError(res,401,'Acesso administrativo inválido.','unauthorized');
  const {sql,user}=a,action=clean(req.query?.action||req.body?.action,40),method=String(req.method||'GET').toUpperCase();
  try{
    if(action==='summary'&&method==='GET'){
      const rows=await sql`SELECT u.id,u.public_code,u.name,u.email,u.username,u.account_status,u.created_at,s.monthly_amount,s.next_due_date,s.payment_status,s.notes AS subscription_notes,
        (SELECT count(*)::int FROM vf_athlete_access aa WHERE aa.personal_id=u.id AND aa.athlete_id<>aa.personal_id) AS athlete_count,
        (SELECT count(*)::int FROM vf_athlete_access aa WHERE aa.personal_id=u.id AND aa.athlete_id<>aa.personal_id AND aa.status='approved') AS active_athletes
        FROM vf_users u LEFT JOIN vf_personal_subscriptions s ON s.personal_id=u.id WHERE u.role='personal' ORDER BY u.created_at DESC`;
      const personals=rows.map(r=>({id:r.id,publicCode:r.public_code,name:r.name,email:r.email,username:r.username||null,accountStatus:r.account_status,createdAt:r.created_at,athleteCount:Number(r.athlete_count)||0,activeAthletes:Number(r.active_athletes)||0,subscription:subInfo(r)}));
      return res.status(200).json({ok:true,personals,counts:{pending:personals.filter(p=>p.accountStatus==='pending').length,active:personals.filter(p=>p.accountStatus==='approved').length,suspended:personals.filter(p=>p.accountStatus==='suspended').length,paymentPending:personals.filter(p=>p.subscription.paymentStatus==='pending').length}});
    }
    if(action==='set_status'&&method==='POST'){
      const personalId=clean(req.body?.personalId,120),mode=clean(req.body?.mode,30),reason=clean(req.body?.reason,400);const rows=await sql`SELECT id,name,account_status FROM vf_users WHERE id=${personalId} AND role='personal' LIMIT 1`;const p=rows[0];if(!p)return sendError(res,404,'Personal não encontrado.','not_found');
      if(mode==='approve'||mode==='reactivate'){
        await sql`UPDATE vf_users SET account_status='approved',updated_at=now() WHERE id=${personalId}`;
        await ensureSelfCoachedAccess(sql,personalId);
        await sql`UPDATE vf_athlete_access SET status='approved',suspended_reason=NULL,updated_at=now() WHERE personal_id=${personalId} AND status='suspended' AND suspended_reason='[ADMIN_PERSONAL_SUSPENDED]'`;
        await audit(sql,user.id,personalId,mode==='approve'?'personal_approved':'personal_reactivated',{reason});return res.status(200).json({ok:true,status:'approved'});
      }
      if(mode==='suspend'){
        await sql`UPDATE vf_users SET account_status='suspended',updated_at=now() WHERE id=${personalId}`;
        await sql`DELETE FROM vf_sessions WHERE user_id=${personalId}`;
        await sql`UPDATE vf_athlete_access SET status='suspended',suspended_reason='[ADMIN_PERSONAL_SUSPENDED]',updated_at=now() WHERE personal_id=${personalId} AND status='approved'`;
        await audit(sql,user.id,personalId,'personal_suspended',{reason});return res.status(200).json({ok:true,status:'suspended'});
      }
      return sendError(res,400,'Ação de status inválida.','invalid_mode');
    }
    if(action==='billing_config'&&method==='POST'){
      const personalId=clean(req.body?.personalId,120),due=dateISO(req.body?.dueDate),amount=money(req.body?.amount),notes=clean(req.body?.notes,500);if(!due)return sendError(res,400,'Informe uma data de vencimento válida.','invalid_due_date');
      const found=await sql`SELECT 1 FROM vf_users WHERE id=${personalId} AND role='personal' LIMIT 1`;if(!found.length)return sendError(res,404,'Personal não encontrado.','not_found');
      await sql`INSERT INTO vf_personal_subscriptions(personal_id,monthly_amount,next_due_date,payment_status,notes,updated_at) VALUES (${personalId},${amount},${due},'current',${notes||null},now()) ON CONFLICT(personal_id) DO UPDATE SET monthly_amount=EXCLUDED.monthly_amount,next_due_date=EXCLUDED.next_due_date,payment_status='current',notes=EXCLUDED.notes,updated_at=now()`;
      const id=`ppay_${crypto.randomUUID()}`;await sql`INSERT INTO vf_personal_payment_history(id,personal_id,due_date,amount,status) VALUES (${id},${personalId},${due},${amount},'pending') ON CONFLICT(personal_id,due_date) DO UPDATE SET amount=EXCLUDED.amount,updated_at=now()`;
      await audit(sql,user.id,personalId,'personal_billing_configured',{dueDate:due,amount});return res.status(200).json({ok:true,status:'current',nextDueDate:due});
    }
    if(action==='billing_mark'&&method==='POST'){
      const personalId=clean(req.body?.personalId,120),status=clean(req.body?.status,20);const rows=await sql`SELECT monthly_amount,next_due_date FROM vf_personal_subscriptions WHERE personal_id=${personalId} LIMIT 1`;const s=rows[0];if(!s?.next_due_date)return sendError(res,409,'Configure primeiro o vencimento deste personal.','billing_not_configured');const due=String(s.next_due_date).slice(0,10),amount=s.monthly_amount==null?null:Number(s.monthly_amount),id=`ppay_${crypto.randomUUID()}`;
      if(status==='pending'){
        await sql`UPDATE vf_personal_subscriptions SET payment_status='pending',updated_at=now() WHERE personal_id=${personalId}`;
        await sql`INSERT INTO vf_personal_payment_history(id,personal_id,due_date,amount,status,updated_at) VALUES (${id},${personalId},${due},${amount},'pending',now()) ON CONFLICT(personal_id,due_date) DO UPDATE SET status='pending',paid_at=NULL,updated_at=now()`;
        await audit(sql,user.id,personalId,'personal_payment_pending',{dueDate:due});return res.status(200).json({ok:true,status:'pending'});
      }
      if(status==='paid'){
        await sql`INSERT INTO vf_personal_payment_history(id,personal_id,due_date,amount,status,paid_at,updated_at) VALUES (${id},${personalId},${due},${amount},'paid',now(),now()) ON CONFLICT(personal_id,due_date) DO UPDATE SET status='paid',paid_at=now(),amount=EXCLUDED.amount,updated_at=now()`;
        const next=addMonth(due);await sql`UPDATE vf_personal_subscriptions SET payment_status='current',next_due_date=${next},updated_at=now() WHERE personal_id=${personalId}`;
        const nextId=`ppay_${crypto.randomUUID()}`;await sql`INSERT INTO vf_personal_payment_history(id,personal_id,due_date,amount,status) VALUES (${nextId},${personalId},${next},${amount},'pending') ON CONFLICT(personal_id,due_date) DO NOTHING`;
        await audit(sql,user.id,personalId,'personal_payment_paid',{dueDate:due,nextDueDate:next});return res.status(200).json({ok:true,status:'current',nextDueDate:next});
      }
      return sendError(res,400,'Status de pagamento inválido.','invalid_status');
    }
    if(action==='history'&&method==='GET'){
      const personalId=clean(req.query?.personalId,120);const rows=await sql`SELECT id,due_date,amount,status,paid_at,notes,created_at FROM vf_personal_payment_history WHERE personal_id=${personalId} ORDER BY due_date DESC LIMIT 24`;return res.status(200).json({ok:true,payments:rows});
    }
    return res.status(405).json({ok:false,error:'method_not_allowed',message:'Operação não permitida.'});
  }catch(error){console.error('Admin API error',error);return res.status(500).json({ok:false,error:'server_error',message:'Não foi possível concluir esta ação administrativa agora.'})}
}
