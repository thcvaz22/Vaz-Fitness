import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';
import { applyCors } from './cors.js';

function db(){if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL não configurada.');return neon(process.env.DATABASE_URL)}
function tokenHash(token){return crypto.createHash('sha256').update(String(token)).digest('hex')}
function clean(v='',max=1000){return String(v??'').trim().slice(0,max)}
function isObject(v){return v&&typeof v==='object'&&!Array.isArray(v)}
function jsonSize(v){try{return Buffer.byteLength(JSON.stringify(v),'utf8')}catch{return Infinity}}
function sendError(res,status,message,code='error'){return res.status(status).json({ok:false,error:code,message})}
function validatePlan(plan){
  if(!Array.isArray(plan)||!plan.length||plan.length>21||jsonSize(plan)>500000)return false;
  return plan.every(day=>isObject(day)&&['strength','run'].includes(day.type)&&clean(day.name,100).length>0&&Number.isInteger(Number(day.day))&&Number(day.day)>=0&&Number(day.day)<=6&&Number.isFinite(Number(day.duration||0))&&Number(day.duration||0)>=0&&Number(day.duration||0)<=300&&(!day.exercises||Array.isArray(day.exercises))&&(!day.exercises||day.exercises.length<=30));
}
async function authenticate(req){
  const header=String(req.headers?.authorization||'');const token=header.startsWith('Bearer ')?header.slice(7).trim():'';
  if(!token)return null;
  const sql=db();
  const rows=await sql`SELECT u.id,u.role,u.account_status FROM vf_sessions s JOIN vf_users u ON u.id=s.user_id WHERE s.token_hash=${tokenHash(token)} AND s.expires_at>now() LIMIT 1`;
  const user=rows[0]||null;
  if(!user||user.role!=='personal'||user.account_status!=='approved')return null;
  return {sql,user};
}
async function ensureTable(sql){
  await sql`CREATE TABLE IF NOT EXISTS vf_plan_drafts (
    athlete_id text PRIMARY KEY,
    personal_id text NOT NULL,
    plan jsonb NOT NULL,
    notes text,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS vf_plan_drafts_personal_idx ON vf_plan_drafts(personal_id,updated_at DESC)`;
}
async function linked(sql,personalId,athleteId){
  const rows=await sql`SELECT 1 FROM vf_athlete_access WHERE athlete_id=${athleteId} AND personal_id=${personalId} LIMIT 1`;
  return !!rows.length;
}

export default async function handler(req,res){
  if(applyCors(req,res))return;
  res.setHeader('Cache-Control','no-store');
  try{
    const auth=await authenticate(req);if(!auth)return sendError(res,401,'Sessão inválida ou conta indisponível.','unauthorized');
    const {sql,user}=auth;await ensureTable(sql);
    const athleteId=clean(req.query?.athleteId||req.body?.athleteId,120);
    if(!athleteId||!await linked(sql,user.id,athleteId))return sendError(res,404,'Aluno não encontrado na sua carteira.','not_found');

    if(req.method==='GET'){
      const rows=await sql`SELECT plan,notes,updated_at FROM vf_plan_drafts WHERE athlete_id=${athleteId} AND personal_id=${user.id} LIMIT 1`;
      return res.status(200).json({ok:true,draft:rows[0]||null});
    }
    if(req.method==='POST'){
      const plan=req.body?.plan,notes=clean(req.body?.notes,1000);
      if(!validatePlan(plan))return sendError(res,400,'Rascunho de treino inválido.','invalid_plan');
      const rows=await sql`INSERT INTO vf_plan_drafts (athlete_id,personal_id,plan,notes,updated_at) VALUES (${athleteId},${user.id},CAST(${JSON.stringify(plan)} AS jsonb),${notes||null},now())
        ON CONFLICT (athlete_id) DO UPDATE SET personal_id=EXCLUDED.personal_id,plan=EXCLUDED.plan,notes=EXCLUDED.notes,updated_at=now() RETURNING updated_at`;
      return res.status(200).json({ok:true,draft:{plan,notes,updated_at:rows[0]?.updated_at}});
    }
    if(req.method==='DELETE'){
      await sql`DELETE FROM vf_plan_drafts WHERE athlete_id=${athleteId} AND personal_id=${user.id}`;
      return res.status(200).json({ok:true});
    }
    return sendError(res,405,'Método não permitido.','method_not_allowed');
  }catch(error){
    console.error('plan-draft',error);
    return sendError(res,500,'Não foi possível salvar o rascunho agora.','server_error');
  }
}
