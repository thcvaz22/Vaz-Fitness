import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { applyCors } from './cors.js';
import { makeState, requireStravaConfig, validInstallationId } from '../lib/strava-lib.js';

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
  await sql`DELETE FROM vf_sessions WHERE expires_at<now()`;
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
  const rows=await sql`SELECT u.id,u.public_code,u.role,u.email,u.name,u.account_status,s.token_hash
    FROM vf_sessions s JOIN vf_users u ON u.id=s.user_id
    WHERE s.token_hash=${tokenHash(token)} AND s.expires_at>now() LIMIT 1`;
  const user=rows[0]||null;
  if(!user||role&&user.role!==role)return null;
  if(['personal','admin'].includes(user.role)&&user.account_status!=='approved')return null;
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
function sendError(res,status,message,code='error'){return res.status(status).json({ok:false,error:code,message});}
function normalizeRestDays(value){
  const days=Array.isArray(value)?value.map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<=6):[];
  return [...new Set(days)].slice(0,5).sort((a,b)=>a-b);
}
async function ensureAdvancedTables(sql){
  await sql`CREATE TABLE IF NOT EXISTS vf_plan_change_requests (
    id text PRIMARY KEY,
    athlete_id text NOT NULL,
    personal_id text,
    reason text NOT NULL,
    rest_days jsonb NOT NULL DEFAULT '[]'::jsonb,
    status text NOT NULL DEFAULT 'pending',
    current_plan_version integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz,
    completed_at timestamptz
  )`;
  await sql`ALTER TABLE vf_plan_change_requests ADD COLUMN IF NOT EXISTS draft_plan jsonb`;
  await sql`ALTER TABLE vf_plan_change_requests ADD COLUMN IF NOT EXISTS draft_notes text`;
  await sql`ALTER TABLE vf_plan_change_requests ADD COLUMN IF NOT EXISTS draft_updated_at timestamptz`;
  await sql`CREATE INDEX IF NOT EXISTS vf_plan_change_requests_personal_status_idx ON vf_plan_change_requests(personal_id,status,created_at DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS vf_plan_history (
    id text PRIMARY KEY,
    athlete_id text NOT NULL,
    personal_id text,
    plan jsonb NOT NULL,
    notes text,
    plan_version integer NOT NULL DEFAULT 0,
    source text NOT NULL DEFAULT 'manual',
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS vf_plan_history_athlete_idx ON vf_plan_history(athlete_id,created_at DESC)`;
}

export default async function handler(req,res){
  if(applyCors(req,res))return;
  res.setHeader('Cache-Control','no-store');
  const action=String(req.query?.action||req.body?.action||'').trim();
  const method=String(req.method||'GET').toUpperCase();
  try{
    if(action==='register'&&method==='POST'){
      if(req.body?.role==='personal')return sendError(res,403,'Cadastros de personal devem ser feitos pelo Vaz Personal.','personal_registration_route');
      const sql=db();
      const role='athlete';
      const email=normalizeEmail(req.body?.email),name=cleanText(req.body?.name,80),password=String(req.body?.password||'');
      if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<8||password.length>200)return sendError(res,400,'Revise nome, e-mail e senha. A senha deve ter pelo menos 8 caracteres.','invalid_registration');
      const exists=await sql`SELECT 1 FROM vf_users WHERE email=${email} LIMIT 1`;
      if(exists.length)return sendError(res,409,'Já existe uma conta com este e-mail.','email_exists');
      const id=`ath_${crypto.randomUUID()}`;
      const publicCode=await uniquePublicCode(sql,role),salt=crypto.randomBytes(16).toString('hex'),hash=passwordHash(password,salt);
      await sql`INSERT INTO vf_users (id,public_code,role,email,name,password_salt,password_hash,account_status) VALUES (${id},${publicCode},${role},${email},${name},${salt},${hash},'approved')`;
      await sql`INSERT INTO vf_cloud_state (user_id,state) VALUES (${id},'{}'::jsonb) ON CONFLICT (user_id) DO NOTHING`;
      await sql`INSERT INTO vf_athlete_access (athlete_id,status) VALUES (${id},'pending') ON CONFLICT (athlete_id) DO NOTHING`;
      const token=await issueSession(sql,id);
      await audit(sql,id,id,'account_created',{role});
      return res.status(201).json({ok:true,token,user:{id,publicCode,role,email,name}});
    }

    if(action==='login'&&method==='POST'){
      const sql=db(),email=normalizeEmail(req.body?.email),password=String(req.body?.password||'');
      const rows=await sql`SELECT id,public_code,role,email,name,password_salt,password_hash,account_status FROM vf_users WHERE email=${email} LIMIT 1`;
      const row=rows[0];
      if(!row){passwordHash(password,'00000000000000000000000000000000');return sendError(res,401,'E-mail ou senha inválidos.','invalid_credentials');}
      const actual=Buffer.from(passwordHash(password,row.password_salt),'hex'),expected=Buffer.from(row.password_hash,'hex');
      if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))return sendError(res,401,'E-mail ou senha inválidos.','invalid_credentials');
      if(['personal','admin'].includes(row.role)&&row.account_status!=='approved')return sendError(res,423,'Seu acesso não está disponível.','account_blocked');
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

    if(action==='strava_oauth_url'&&method==='GET'){
      const auth=await authenticate(req,'athlete');if(!auth)return sendError(res,401,'Sessão inválida.','unauthorized');
      const access=await getAthleteAccess(auth.sql,auth.user.id);if(access?.status!=='approved')return sendError(res,423,'Seu acesso precisa estar liberado antes de conectar o Strava.','athlete_not_approved');
      const installationId=String(req.query?.installationId||'');if(!validInstallationId(installationId))return sendError(res,400,'installationId inválido.','invalid_installation');
      requireStravaConfig();
      const host=req.headers['x-forwarded-host']||req.headers.host,proto=req.headers['x-forwarded-proto']||'https';
      const redirectUri=`${proto}://${host}/api/strava-callback`,native=String(req.query?.native||'')==='1';
      const returnTo=native?'vazfitness://strava-connected':'/?strava=connected';
      const oauthState=makeState(installationId,returnTo,auth.user.id);
      const target=new URL(native?'https://www.strava.com/oauth/mobile/authorize':'https://www.strava.com/oauth/authorize');
      target.searchParams.set('client_id',String(process.env.STRAVA_CLIENT_ID));target.searchParams.set('redirect_uri',redirectUri);target.searchParams.set('response_type','code');target.searchParams.set('approval_prompt','auto');target.searchParams.set('scope','activity:read,activity:write');target.searchParams.set('state',oauthState);
      return res.status(200).json({ok:true,url:target.toString()});
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

    if(action==='plan_change_request'&&method==='POST'){
      const auth=await authenticate(req,'athlete');if(!auth)return sendError(res,401,'Sessão inválida.','unauthorized');
      const access=await getAthleteAccess(auth.sql,auth.user.id);
      if(access?.status!=='approved'||!access?.personal_id)return sendError(res,409,'Você precisa estar vinculado a um personal com acesso liberado.','personal_required');
      const reason=cleanText(req.body?.reason,500),restDays=normalizeRestDays(req.body?.restDays);
      if(reason.length<8)return sendError(res,400,'Explique brevemente por que deseja mudar o treino.','reason_required');
      await ensureAdvancedTables(auth.sql);
      const planRows=await auth.sql`SELECT plan_version FROM vf_training_plans WHERE athlete_id=${auth.user.id} LIMIT 1`;
      const currentVersion=Number(planRows[0]?.plan_version)||0;
      const existing=await auth.sql`SELECT id,status FROM vf_plan_change_requests WHERE athlete_id=${auth.user.id} AND status IN ('pending','reviewing') ORDER BY created_at DESC LIMIT 1`;
      if(existing[0]?.status==='reviewing')return sendError(res,409,'Seu personal já está preparando o novo treino. O treino atual continua disponível.','request_in_review');
      const id=existing[0]?.id||`request_${crypto.randomUUID()}`;
      if(existing.length){
        await auth.sql`UPDATE vf_plan_change_requests SET reason=${reason},rest_days=CAST(${JSON.stringify(restDays)} AS jsonb),personal_id=${access.personal_id},current_plan_version=${currentVersion},created_at=now() WHERE id=${id}`;
      }else{
        await auth.sql`INSERT INTO vf_plan_change_requests (id,athlete_id,personal_id,reason,rest_days,current_plan_version) VALUES (${id},${auth.user.id},${access.personal_id},${reason},CAST(${JSON.stringify(restDays)} AS jsonb),${currentVersion})`;
      }
      const requestState={id,reason,restDays,status:'pending',createdAt:new Date().toISOString()};
      await auth.sql`UPDATE vf_cloud_state SET state=COALESCE(state,'{}'::jsonb)||jsonb_build_object('profile',COALESCE(state->'profile','{}'::jsonb)||jsonb_build_object('restDays',CAST(${JSON.stringify(restDays)} AS jsonb)),'planChangeRequest',CAST(${JSON.stringify(requestState)} AS jsonb)),state_version=state_version+1,updated_at=now() WHERE user_id=${auth.user.id}`;
      await audit(auth.sql,auth.user.id,auth.user.id,'plan_change_requested',{requestId:id,reason,restDays,currentVersion});
      return res.status(201).json({ok:true,request:{id,reason,restDays,status:'pending'},message:'Solicitação enviada ao seu personal. Seu treino atual foi mantido.'});
    }

    if(action==='plan_change_request'&&method==='GET'){
      const auth=await authenticate(req,'athlete');if(!auth)return sendError(res,401,'Sessão inválida.','unauthorized');
      await ensureAdvancedTables(auth.sql);
      const rows=await auth.sql`SELECT id,reason,rest_days,status,created_at,reviewed_at,completed_at FROM vf_plan_change_requests WHERE athlete_id=${auth.user.id} ORDER BY created_at DESC LIMIT 1`;
      return res.status(200).json({ok:true,request:rows[0]||null});
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
      const rows=await auth.sql`SELECT u.id,u.name,u.email,u.public_code,a.status,a.profile_submitted_at,a.approved_at,a.updated_at,p.plan_version,p.updated_at AS plan_updated_at,
        c.state #>> '{profile,mode}' AS mode,c.state #>> '{profile,goal}' AS goal,c.state #>> '{profile,age}' AS age,c.state #>> '{profile,days}' AS weekly_days,
        COALESCE(c.state #>> '{bodyMeasurements,-1,weight}',c.state #>> '{profile,weight}') AS weight,
        CASE WHEN jsonb_typeof(c.state->'sessions')='array' THEN jsonb_array_length(c.state->'sessions') ELSE 0 END AS strength_sessions,
        CASE WHEN jsonb_typeof(c.state->'runSessions')='array' THEN jsonb_array_length(c.state->'runSessions') ELSE 0 END AS run_sessions
        FROM vf_athlete_access a JOIN vf_users u ON u.id=a.athlete_id
        LEFT JOIN vf_cloud_state c ON c.user_id=u.id LEFT JOIN vf_training_plans p ON p.athlete_id=u.id
        WHERE a.personal_id=${auth.user.id} ORDER BY a.updated_at DESC`;
      const clients=rows.map(r=>({id:r.id,name:r.name,email:r.email,publicCode:r.public_code,status:r.status,profileSubmittedAt:r.profile_submitted_at,approvedAt:r.approved_at,planVersion:Number(r.plan_version)||0,summary:{mode:r.mode||null,goal:r.goal||null,age:r.age?Number(r.age):null,weight:r.weight?Number(r.weight):null,weeklyDays:r.weekly_days?Number(r.weekly_days):null,strengthSessions:Number(r.strength_sessions)||0,runSessions:Number(r.run_sessions)||0,lastActivity:null,recentRuns:[],recentStrength:[]}}));
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
      const athleteId=cleanText(req.body?.athleteId,120),requestId=cleanText(req.body?.requestId,160),client=await linkedClient(auth.sql,auth.user.id,athleteId);
      if(!client)return sendError(res,404,'Aluno não encontrado na sua carteira.','not_found');
      const plan=req.body?.plan,notes=cleanText(req.body?.notes,1000);
      if(!validatePlan(plan)||!plan.length)return sendError(res,400,'Plano inválido.','invalid_plan');
      await ensureAdvancedTables(auth.sql);
      const activeRequests=await auth.sql`SELECT id,status FROM vf_plan_change_requests WHERE athlete_id=${athleteId} AND personal_id=${auth.user.id} AND status IN ('pending','reviewing') ORDER BY created_at DESC LIMIT 1`;
      if(activeRequests.length&&!requestId)return sendError(res,409,'Salve como rascunho ou use “Liberar novo treino”.','request_release_required');
      if(requestId&&activeRequests[0]?.id!==requestId)return sendError(res,409,'Esta solicitação não está mais ativa. Atualize os dados do aluno.','request_not_active');
      const previous=await auth.sql`SELECT plan,notes,plan_version FROM vf_training_plans WHERE athlete_id=${athleteId} LIMIT 1`;
      if(Array.isArray(previous[0]?.plan)&&previous[0].plan.length){
        await auth.sql`INSERT INTO vf_plan_history (id,athlete_id,personal_id,plan,notes,plan_version,source) VALUES (${`history_${crypto.randomUUID()}`},${athleteId},${auth.user.id},CAST(${JSON.stringify(previous[0].plan)} AS jsonb),${previous[0].notes||null},${Number(previous[0].plan_version)||0},'before_update')`;
      }
      const rows=await auth.sql`INSERT INTO vf_training_plans (athlete_id,personal_id,plan,plan_version,notes,updated_at) VALUES (${athleteId},${auth.user.id},CAST(${JSON.stringify(plan)} AS jsonb),1,${notes||null},now())
        ON CONFLICT (athlete_id) DO UPDATE SET personal_id=EXCLUDED.personal_id,plan=EXCLUDED.plan,plan_version=vf_training_plans.plan_version+1,notes=EXCLUDED.notes,updated_at=now() RETURNING plan_version,updated_at`;
      if(requestId){
        await auth.sql`UPDATE vf_plan_change_requests SET status='completed',reviewed_at=COALESCE(reviewed_at,now()),completed_at=now(),draft_plan=CAST(${JSON.stringify(plan)} AS jsonb),draft_notes=${notes||null},draft_updated_at=now() WHERE id=${requestId} AND athlete_id=${athleteId} AND personal_id=${auth.user.id} AND status IN ('pending','reviewing')`;
        await auth.sql`UPDATE vf_cloud_state SET state=CASE WHEN state ? 'planChangeRequest' THEN jsonb_set(state,'{planChangeRequest,status}','"completed"'::jsonb,true) ELSE state END,state_version=state_version+1,updated_at=now() WHERE user_id=${athleteId}`;
      }
      await audit(auth.sql,auth.user.id,athleteId,requestId?'plan_request_released':'plan_updated',{days:plan.length,version:rows[0]?.plan_version,requestId:requestId||null});
      return res.status(200).json({ok:true,...rows[0],requestId:requestId||null});
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
