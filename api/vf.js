import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { applyCors } from './cors.js';

const SESSION_DAYS=30;
const CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function db(){
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
}
function normalizeEmail(v=''){return String(v).trim().toLowerCase();}
function cleanText(v='',max=120){return String(v??'').trim().slice(0,max);}
function randomCode(prefix){
  let raw='';
  for(let i=0;i<12;i++)raw+=CODE_ALPHABET[crypto.randomInt(0,CODE_ALPHABET.length)];
  return `${prefix}-${raw.slice(0,4)}-${raw.slice(4,8)}-${raw.slice(8,12)}`;
}
function passwordHash(password,salt){return crypto.scryptSync(String(password),String(salt),64).toString('hex');}
function tokenHash(token){return crypto.createHash('sha256').update(String(token)).digest('hex');}
function publicUser(row){return {id:row.id,publicCode:row.public_code,role:row.role,email:row.email,name:row.name};}
function isObject(v){return v&&typeof v==='object'&&!Array.isArray(v);}
function jsonSize(v){try{return Buffer.byteLength(JSON.stringify(v),'utf8')}catch{return Infinity}}
function validatePlan(plan){
  if(!Array.isArray(plan)||plan.length>21)return false;
  if(jsonSize(plan)>500000)return false;
  return plan.every(day=>isObject(day)&&['strength','run'].includes(day.type)&&cleanText(day.name,100).length>0&&Number.isFinite(Number(day.duration||0))&&Number(day.duration||0)>=0&&Number(day.duration||0)<=300&&(!day.exercises||Array.isArray(day.exercises))&&(!day.exercises||day.exercises.length<=30));
}
async function uniquePublicCode(sql,role){
  const prefix=role==='personal'?'VP':'VF';
  for(let i=0;i<8;i++){
    const code=randomCode(prefix);
    const rows=await sql`SELECT 1 FROM vf_users WHERE public_code=${code} LIMIT 1`;
    if(!rows.length)return code;
  }
  throw new Error('Não foi possível gerar um código único.');
}
async function issueSession(sql,userId){
  const token=crypto.randomBytes(32).toString('base64url');
  const hash=tokenHash(token);
  const expiresAt=new Date(Date.now()+SESSION_DAYS*86400000).toISOString();
  await sql`INSERT INTO vf_sessions (token_hash,user_id,expires_at) VALUES (${hash},${userId},${expiresAt})`;
  return token;
}
async function authenticate(req,role=null){
  const header=String(req.headers?.authorization||'');
  const token=header.startsWith('Bearer ')?header.slice(7).trim():'';
  if(!token)return null;
  const sql=db();
  const rows=await sql`SELECT u.id,u.public_code,u.role,u.email,u.name,s.token_hash
    FROM vf_sessions s JOIN vf_users u ON u.id=s.user_id
    WHERE s.token_hash=${tokenHash(token)} AND s.expires_at>now() LIMIT 1`;
  const user=rows[0]||null;
  if(!user||role&&user.role!==role)return null;
  return {sql,user,tokenHash:user.token_hash};
}
async function getAthleteAccess(sql,athleteId){
  const rows=await sql`SELECT a.athlete_id,a.personal_id,a.status,a.profile_submitted_at,a.approved_at,a.suspended_reason,a.updated_at,
    p.name AS personal_name,p.public_code AS personal_code
    FROM vf_athlete_access a LEFT JOIN vf_users p ON p.id=a.personal_id
    WHERE a.athlete_id=${athleteId} LIMIT 1`;
  return rows[0]||null;
}
async function linkedClient(sql,personalId,athleteId){
  const rows=await sql`SELECT a.*,u.name,u.email,u.public_code FROM vf_athlete_access a
    JOIN vf_users u ON u.id=a.athlete_id
    WHERE a.athlete_id=${athleteId} AND a.personal_id=${personalId} LIMIT 1`;
  return rows[0]||null;
}
async function audit(sql,actorId,athleteId,action,payload={}){
  try{await sql`INSERT INTO vf_audit_log (actor_id,athlete_id,action,payload) VALUES (${actorId||null},${athleteId||null},${action},CAST(${JSON.stringify(payload)} AS jsonb))`;}catch{}
}
function stateSummary(state={}){
  const profile=state.profile||{};
  const sessions=Array.isArray(state.sessions)?state.sessions:[];
  const runs=Array.isArray(state.runSessions)?state.runSessions:[];
  const body=Array.isArray(state.bodyMeasurements)?state.bodyMeasurements:[];
  const latest=[...sessions,...runs].map(x=>x?.date).filter(Boolean).sort().at(-1)||null;
  return {
    mode:profile.mode||null,goal:profile.goal||null,age:profile.age||null,weight:body.at(-1)?.weight||profile.weight||null,
    weeklyDays:profile.days||null,strengthSessions:sessions.length,runSessions:runs.length,lastActivity:latest,
    recentRuns:runs.slice(-5).map(r=>({date:r.date,name:r.name,distance:r.distance,pace:r.pace,duration:r.duration,effort:r.effort})),
    recentStrength:sessions.slice(-5).map(s=>({date:s.date,name:s.name,duration:s.duration,volume:s.volume,completionPercent:s.completionPercent}))
  };
}
function sendError(res,status,message,code='error'){return res.status(status).json({ok:false,error:code,message});}

export default async function handler(req,res){
  if(applyCors(req,res))return;
  const action=String(req.query?.action||req.body?.action||'').trim();
  const method=String(req.method||'GET').toUpperCase();
  try{
    if(action==='register'&&method==='POST'){
      const sql=db();
      const role=req.body?.role==='personal'?'personal':'athlete';
      const email=normalizeEmail(req.body?.email),name=cleanText(req.body?.name,80),password=String(req.body?.password||'');
      if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<8||password.length>200)return sendError(res,400,'Revise nome, e-mail e senha. A senha deve ter pelo menos 8 caracteres.','invalid_registration');
      const exists=await sql`SELECT 1 FROM vf_users WHERE email=${email} LIMIT 1`;
      if(exists.length)return sendError(res,409,'Já existe uma conta com este e-mail.','email_exists');
      const id=`${role==='personal'?'per':'ath'}_${crypto.randomUUID()}`;
      const publicCode=await uniquePublicCode(sql,role),salt=crypto.randomBytes(16).toString('hex'),hash=passwordHash(password,salt);
      await sql`INSERT INTO vf_users (id,public_code,role,email,name,password_salt,password_hash) VALUES (${id},${publicCode},${role},${email},${name},${salt},${hash})`;
      await sql`INSERT INTO vf_cloud_state (user_id,state) VALUES (${id},'{}'::jsonb) ON CONFLICT (user_id) DO NOTHING`;
      if(role==='athlete')await sql`INSERT INTO vf_athlete_access (athlete_id,status) VALUES (${id},'pending') ON CONFLICT (athlete_id) DO NOTHING`;
      const token=await issueSession(sql,id);
      await audit(sql,id,role==='athlete'?id:null,'account_created',{role});
      return res.status(201).json({ok:true,token,user:{id,publicCode,role,email,name}});
    }

    if(action==='login'&&method==='POST'){
      const sql=db(),email=normalizeEmail(req.body?.email),password=String(req.body?.password||'');
      const rows=await sql`SELECT id,public_code,role,email,name,password_salt,password_hash FROM vf_users WHERE email=${email} LIMIT 1`;
      const row=rows[0];
      if(!row){passwordHash(password,'00000000000000000000000000000000');return sendError(res,401,'E-mail ou senha inválidos.','invalid_credentials');}
      const actual=Buffer.from(passwordHash(password,row.password_salt),'hex'),expected=Buffer.from(row.password_hash,'hex');
      if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))return sendError(res,401,'E-mail ou senha inválidos.','invalid_credentials');
      const token=await issueSession(sql,row.id);
      const access=row.role==='athlete'?await getAthleteAccess(sql,row.id):null;
      return res.status(200).json({ok:true,token,user:publicUser(row),access});
    }

    if(action==='logout'&&method==='POST'){
      const auth=await authenticate(req);if(!auth)return sendError(res,401,'Sessão inválida.','unauthorized');
      await auth.sql`DELETE FROM vf_sessions WHERE token_hash=${auth.tokenHash}`;
      return res.status(200).json({ok:true});
    }

    if(action==='me'&&method==='GET'){
      const auth=await authenticate(req);if(!auth)return sendError(res,401,'Sessão inválida.','unauthorized');
      const access=auth.user.role==='athlete'?await getAthleteAccess(auth.sql,auth.user.id):null;
      return res.status(200).json({ok:true,user:publicUser(auth.user),access});
    }

    if(action==='submit_profile'&&method==='POST'){
      const auth=await authenticate(req,'athlete');if(!auth)return sendError(res,401,'Sessão inválida.','unauthorized');
      const state=isObject(req.body?.state)?req.body.state:null,plan=req.body?.plan;
      if(!state||jsonSize(state)>2000000)return sendError(res,400,'Perfil inválido ou muito grande.','invalid_state');
      if(!validatePlan(plan))return sendError(res,400,'Plano de treino inválido.','invalid_plan');
      await auth.sql`INSERT INTO vf_cloud_state (user_id,state,state_version,updated_at) VALUES (${auth.user.id},CAST(${JSON.stringify(state)} AS jsonb),1,now())
        ON CONFLICT (user_id) DO UPDATE SET state=EXCLUDED.state,state_version=vf_cloud_state.state_version+1,updated_at=now()`;
      await auth.sql`UPDATE vf_athlete_access SET profile_submitted_at=COALESCE(profile_submitted_at,now()),status=CASE WHEN status='suspended' THEN status ELSE 'pending' END,updated_at=now() WHERE athlete_id=${auth.user.id}`;
      await auth.sql`INSERT INTO vf_training_plans (athlete_id,plan,plan_version,updated_at) VALUES (${auth.user.id},CAST(${JSON.stringify(plan)} AS jsonb),1,now())
        ON CONFLICT (athlete_id) DO UPDATE SET plan=EXCLUDED.plan,plan_version=vf_training_plans.plan_version+1,updated_at=now()`;
      await audit(auth.sql,auth.user.id,auth.user.id,'profile_submitted',{planDays:plan.length});
      const access=await getAthleteAccess(auth.sql,auth.user.id);
      return res.status(200).json({ok:true,publicCode:auth.user.public_code,access});
    }

    if(action==='cloud_state'&&method==='GET'){
      const auth=await authenticate(req,'athlete');if(!auth)return sendError(res,401,'Sessão inválida.','unauthorized');
      const access=await getAthleteAccess(auth.sql,auth.user.id);
      if(access?.status==='suspended')return sendError(res,423,'Não foi possível entrar, contate seu personal.','suspended');
      const rows=await auth.sql`SELECT state,state_version,updated_at FROM vf_cloud_state WHERE user_id=${auth.user.id} LIMIT 1`;
      return res.status(200).json({ok:true,...(rows[0]||{state:{},state_version:0,updated_at:null})});
    }

    if(action==='cloud_state'&&method==='POST'){
      const auth=await authenticate(req,'athlete');if(!auth)return sendError(res,401,'Sessão inválida.','unauthorized');
      const access=await getAthleteAccess(auth.sql,auth.user.id);
      if(access?.status!=='approved')return sendError(res,423,access?.status==='suspended'?'Não foi possível entrar, contate seu personal.':'Seu treino ainda não foi liberado pelo personal.',access?.status||'pending');
      const state=isObject(req.body?.state)?req.body.state:null;
      if(!state||jsonSize(state)>2000000)return sendError(res,400,'Estado inválido ou muito grande.','invalid_state');
      const rows=await auth.sql`INSERT INTO vf_cloud_state (user_id,state,state_version,updated_at) VALUES (${auth.user.id},CAST(${JSON.stringify(state)} AS jsonb),1,now())
        ON CONFLICT (user_id) DO UPDATE SET state=EXCLUDED.state,state_version=vf_cloud_state.state_version+1,updated_at=now() RETURNING state_version,updated_at`;
      return res.status(200).json({ok:true,...rows[0]});
    }

    if(action==='athlete_access'&&method==='GET'){
      const auth=await authenticate(req,'athlete');if(!auth)return sendError(res,401,'Sessão inválida.','unauthorized');
      const access=await getAthleteAccess(auth.sql,auth.user.id);
      const plans=await auth.sql`SELECT plan,plan_version,notes,updated_at FROM vf_training_plans WHERE athlete_id=${auth.user.id} LIMIT 1`;
      const plan=plans[0]||null;
      return res.status(200).json({ok:true,user:publicUser(auth.user),access,plan:access?.status==='approved'?plan:null});
    }

    if(action==='personal_clients'&&method==='GET'){
      const auth=await authenticate(req,'personal');if(!auth)return sendError(res,401,'Sessão inválida.','unauthorized');
      const rows=await auth.sql`SELECT u.id,u.name,u.email,u.public_code,a.status,a.profile_submitted_at,a.approved_at,a.updated_at,c.state,p.plan_version,p.updated_at AS plan_updated_at
        FROM vf_athlete_access a JOIN vf_users u ON u.id=a.athlete_id
        LEFT JOIN vf_cloud_state c ON c.user_id=u.id LEFT JOIN vf_training_plans p ON p.athlete_id=u.id
        WHERE a.personal_id=${auth.user.id} ORDER BY a.updated_at DESC`;
      const clients=rows.map(r=>({id:r.id,name:r.name,email:r.email,publicCode:r.public_code,status:r.status,profileSubmittedAt:r.profile_submitted_at,approvedAt:r.approved_at,planVersion:r.plan_version||0,summary:stateSummary(r.state||{})}));
      return res.status(200).json({ok:true,clients});
    }

    if(action==='personal_claim'&&method==='POST'){
      const auth=await authenticate(req,'personal');if(!auth)return sendError(res,401,'Sessão inválida.','unauthorized');
      const code=cleanText(req.body?.code,40).toUpperCase();
      const rows=await auth.sql`SELECT u.id,u.name,u.public_code,a.personal_id,a.profile_submitted_at,a.status FROM vf_users u JOIN vf_athlete_access a ON a.athlete_id=u.id WHERE u.public_code=${code} AND u.role='athlete' LIMIT 1`;
      const athlete=rows[0];
      if(!athlete)return sendError(res,404,'Código ID não encontrado.','not_found');
      if(!athlete.profile_submitted_at)return sendError(res,409,'Este aluno ainda não concluiu o cadastro.','profile_incomplete');
      if(athlete.personal_id&&athlete.personal_id!==auth.user.id)return sendError(res,409,'Este aluno já está vinculado a outro personal.','already_linked');
      await auth.sql`UPDATE vf_athlete_access SET personal_id=${auth.user.id},updated_at=now() WHERE athlete_id=${athlete.id}`;
      await auth.sql`UPDATE vf_training_plans SET personal_id=${auth.user.id},updated_at=now() WHERE athlete_id=${athlete.id}`;
      await audit(auth.sql,auth.user.id,athlete.id,'personal_linked',{});
      return res.status(200).json({ok:true,athlete:{id:athlete.id,name:athlete.name,publicCode:athlete.public_code,status:athlete.status}});
    }

    if(action==='personal_client'&&method==='GET'){
      const auth=await authenticate(req,'personal');if(!auth)return sendError(res,401,'Sessão inválida.','unauthorized');
      const athleteId=cleanText(req.query?.athleteId,120),client=await linkedClient(auth.sql,auth.user.id,athleteId);
      if(!client)return sendError(res,404,'Aluno não encontrado na sua carteira.','not_found');
      const stateRows=await auth.sql`SELECT state,state_version,updated_at FROM vf_cloud_state WHERE user_id=${athleteId} LIMIT 1`;
      const planRows=await auth.sql`SELECT plan,plan_version,notes,updated_at FROM vf_training_plans WHERE athlete_id=${athleteId} LIMIT 1`;
      return res.status(200).json({ok:true,athlete:{id:client.athlete_id,name:client.name,email:client.email,publicCode:client.public_code,status:client.status,profileSubmittedAt:client.profile_submitted_at,approvedAt:client.approved_at,suspendedReason:client.suspended_reason},state:stateRows[0]?.state||{},stateVersion:stateRows[0]?.state_version||0,plan:planRows[0]||{plan:[],plan_version:0,notes:null}});
    }

    if(action==='personal_plan'&&method==='POST'){
      const auth=await authenticate(req,'personal');if(!auth)return sendError(res,401,'Sessão inválida.','unauthorized');
      const athleteId=cleanText(req.body?.athleteId,120),client=await linkedClient(auth.sql,auth.user.id,athleteId);
      if(!client)return sendError(res,404,'Aluno não encontrado na sua carteira.','not_found');
      const plan=req.body?.plan,notes=cleanText(req.body?.notes,1000);
      if(!validatePlan(plan))return sendError(res,400,'Plano inválido.','invalid_plan');
      const rows=await auth.sql`INSERT INTO vf_training_plans (athlete_id,personal_id,plan,plan_version,notes,updated_at) VALUES (${athleteId},${auth.user.id},CAST(${JSON.stringify(plan)} AS jsonb),1,${notes||null},now())
        ON CONFLICT (athlete_id) DO UPDATE SET personal_id=EXCLUDED.personal_id,plan=EXCLUDED.plan,plan_version=vf_training_plans.plan_version+1,notes=EXCLUDED.notes,updated_at=now() RETURNING plan_version,updated_at`;
      await audit(auth.sql,auth.user.id,athleteId,'plan_updated',{days:plan.length,version:rows[0]?.plan_version});
      return res.status(200).json({ok:true,...rows[0]});
    }

    if(action==='personal_access'&&method==='POST'){
      const auth=await authenticate(req,'personal');if(!auth)return sendError(res,401,'Sessão inválida.','unauthorized');
      const athleteId=cleanText(req.body?.athleteId,120),client=await linkedClient(auth.sql,auth.user.id,athleteId);
      if(!client)return sendError(res,404,'Aluno não encontrado na sua carteira.','not_found');
      const mode=String(req.body?.mode||'');
      if(!['approve','suspend','reactivate'].includes(mode))return sendError(res,400,'Ação inválida.','invalid_action');
      if(mode==='approve'){
        if(!client.profile_submitted_at)return sendError(res,409,'O aluno ainda não concluiu o cadastro.','profile_incomplete');
        const planRows=await auth.sql`SELECT plan FROM vf_training_plans WHERE athlete_id=${athleteId} LIMIT 1`;
        if(!planRows.length||!Array.isArray(planRows[0].plan)||!planRows[0].plan.length)return sendError(res,409,'Revise e salve um plano antes de liberar o aluno.','plan_required');
        await auth.sql`UPDATE vf_athlete_access SET status='approved',approved_at=COALESCE(approved_at,now()),suspended_reason=NULL,updated_at=now() WHERE athlete_id=${athleteId}`;
        await audit(auth.sql,auth.user.id,athleteId,'access_approved',{});
      }else if(mode==='suspend'){
        const reason=cleanText(req.body?.reason,250)||'Suspenso pelo personal';
        await auth.sql`UPDATE vf_athlete_access SET status='suspended',suspended_reason=${reason},updated_at=now() WHERE athlete_id=${athleteId}`;
        await audit(auth.sql,auth.user.id,athleteId,'access_suspended',{reason});
      }else{
        await auth.sql`UPDATE vf_athlete_access SET status='approved',suspended_reason=NULL,updated_at=now() WHERE athlete_id=${athleteId}`;
        await audit(auth.sql,auth.user.id,athleteId,'access_reactivated',{});
      }
      const access=await getAthleteAccess(auth.sql,athleteId);
      return res.status(200).json({ok:true,access});
    }

    return sendError(res,404,'Rota não encontrada.','not_found');
  }catch(error){
    console.error('VF API error',action,error);
    const message=String(error?.message||'').includes('relation')?'A central de contas ainda não foi ativada no banco.':'Não foi possível concluir esta operação agora.';
    return sendError(res,500,message,'server_error');
  }
}
