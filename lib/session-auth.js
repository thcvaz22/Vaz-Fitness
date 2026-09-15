import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

export function database(){
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
}

export function sessionTokenHash(token=''){
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export async function authenticateBearer(req,{roles=null,requireApprovedAccount=true}={}){
  const header=String(req.headers?.authorization||'');
  const token=header.startsWith('Bearer ')?header.slice(7).trim():'';
  if(!token)return null;
  const sql=database();
  const rows=await sql`SELECT u.id,u.public_code,u.role,u.email,u.name,u.account_status,u.must_change_password,s.token_hash
    FROM vf_sessions s JOIN vf_users u ON u.id=s.user_id
    WHERE s.token_hash=${sessionTokenHash(token)} AND s.expires_at>now() LIMIT 1`;
  const user=rows[0]||null;
  if(!user)return null;
  if(Array.isArray(roles)&&roles.length&&!roles.includes(user.role))return null;
  if(requireApprovedAccount&&['personal','admin'].includes(user.role)&&user.account_status!=='approved')return null;
  return {sql,user,tokenHash:user.token_hash};
}

export async function requireApprovedAthlete(req){
  const auth=await authenticateBearer(req,{roles:['athlete']});
  if(!auth)return null;
  const rows=await auth.sql`SELECT status,personal_id FROM vf_athlete_access WHERE athlete_id=${auth.user.id} LIMIT 1`;
  const access=rows[0]||null;
  if(!access||access.status!=='approved')return {...auth,access,approved:false};
  return {...auth,access,approved:true};
}
