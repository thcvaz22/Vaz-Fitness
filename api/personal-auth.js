import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { applyCors } from './cors.js';

const SESSION_DAYS=30;
const CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BOOTSTRAP_ADMIN_USERNAME='Admin.vaz22';
const BOOTSTRAP_SALT='873e02a6fda9ac65294b54802db3c120';
const BOOTSTRAP_HASH='6f8a33b63e29488f34f3d1fbb6f9deb2f3459985f29ca97e92b71d9c64d5082fc8c63f63a1a3a5712413ad1c65a605f40ad5d00e5c3d87f61c6b1e72128ebed5';

function db(){if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL não configurada.');return neon(process.env.DATABASE_URL)}
function clean(v='',max=120){return String(v??'').trim().slice(0,max)}
function email(v=''){return clean(v,180).toLowerCase()}
function tokenHash(v){return crypto.createHash('sha256').update(String(v)).digest('hex')}
function passwordHash(password,salt){return crypto.scryptSync(String(password),String(salt),64).toString('hex')}
function safeEqualHex(a,b){try{const aa=Buffer.from(a,'hex'),bb=Buffer.from(b,'hex');return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}catch{return false}}
function sendError(res,status,message,code='error'){return res.status(status).json({ok:false,error:code,message})}
function publicUser(r){return {id:r.id,publicCode:r.public_code,role:r.role,email:r.email,name:r.name,username:r.username||null,accountStatus:r.account_status||'approved',mustChangePassword:!!r.must_change_password}}
function randomCode(prefix){let raw='';for(let i=0;i<12;i++)raw+=CODE_ALPHABET[crypto.randomInt(0,CODE_ALPHABET.length)];return `${prefix}-${raw.slice(0,4)}-${raw.slice(4,8)}-${raw.slice(8,12)}`}
async function uniqueCode(sql,prefix){for(let i=0;i<10;i++){const code=randomCode(prefix);const found=await sql`SELECT 1 FROM vf_users WHERE public_code=${code} LIMIT 1`;if(!found.length)return code}throw new Error('code_generation_failed')}
async function issueSession(sql,userId){const token=crypto.randomBytes(32).toString('base64url');const expires=new Date(Date.now()+SESSION_DAYS*86400000).toISOString();await sql`INSERT INTO vf_sessions(token_hash,user_id,expires_at) VALUES (${tokenHash(token)},${userId},${expires})`;return token}
async function auth(req){const h=String(req.headers?.authorization||'');const token=h.startsWith('Bearer ')?h.slice(7).trim():'';if(!token)return null;const sql=db();const rows=await sql`SELECT u.id,u.public_code,u.role,u.email,u.name,u.username,u.account_status,u.must_change_password,s.token_hash FROM vf_sessions s JOIN vf_users u ON u.id=s.user_id WHERE s.token_hash=${tokenHash(token)} AND s.expires_at>now() LIMIT 1`;return rows[0]?{sql,user:rows[0],tokenHash:rows[0].token_hash}:null}
async function maybeBootstrapAdmin(sql,identifier,password){
  if(identifier.toLowerCase()!==BOOTSTRAP_ADMIN_USERNAME.toLowerCase())return null;
  const existing=await sql`SELECT 1 FROM vf_users WHERE role='admin' LIMIT 1`;if(existing.length)return null;
  const actual=passwordHash(password,BOOTSTRAP_SALT);if(!safeEqualHex(actual,BOOTSTRAP_HASH))return null;
  const id=`adm_${crypto.randomUUID()}`,publicCode=await uniqueCode(sql,'ADM');
  const rows=await sql`INSERT INTO vf_users(id,public_code,role,email,name,password_salt,password_hash,username,account_status,must_change_password) VALUES (${id},${publicCode},'admin','admin.vaz22@admin.local','Administrador Vaz',${BOOTSTRAP_SALT},${BOOTSTRAP_HASH},${BOOTSTRAP_ADMIN_USERNAME},'approved',true) RETURNING *`;
  await sql`INSERT INTO vf_cloud_state(user_id,state) VALUES (${id},'{}'::jsonb) ON CONFLICT(user_id) DO NOTHING`;
  return rows[0]||null;
}

export default async function handler(req,res){
  if(applyCors(req,res))return;
  const action=clean(req.query?.action||req.body?.action,40),method=String(req.method||'GET').toUpperCase();
  try{
    if(action==='register'&&method==='POST'){
      const sql=db(),name=clean(req.body?.name,80),mail=email(req.body?.email),password=String(req.body?.password||'');
      if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)||password.length<8||password.length>200)return sendError(res,400,'Revise nome, e-mail e senha. A senha deve ter pelo menos 8 caracteres.','invalid_registration');
      const exists=await sql`SELECT 1 FROM vf_users WHERE email=${mail} LIMIT 1`;if(exists.length)return sendError(res,409,'Já existe uma conta com este e-mail.','email_exists');
      const id=`per_${crypto.randomUUID()}`,publicCode=await uniqueCode(sql,'VP'),salt=crypto.randomBytes(16).toString('hex'),hash=passwordHash(password,salt);
      await sql`INSERT INTO vf_users(id,public_code,role,email,name,password_salt,password_hash,account_status,must_change_password) VALUES (${id},${publicCode},'personal',${mail},${name},${salt},${hash},'pending',false)`;
      await sql`INSERT INTO vf_cloud_state(user_id,state) VALUES (${id},'{}'::jsonb) ON CONFLICT(user_id) DO NOTHING`;
      return res.status(201).json({ok:true,approvalRequired:true,user:{id,publicCode,role:'personal',email:mail,name,accountStatus:'pending'}});
    }

    if(action==='login'&&method==='POST'){
      const sql=db(),identifier=clean(req.body?.identifier||req.body?.email,180),password=String(req.body?.password||'');
      let rows=await sql`SELECT * FROM vf_users WHERE lower(email)=lower(${identifier}) OR lower(COALESCE(username,''))=lower(${identifier}) LIMIT 1`;
      let row=rows[0]||await maybeBootstrapAdmin(sql,identifier,password);
      if(!row){passwordHash(password,'00000000000000000000000000000000');return sendError(res,401,'Usuário/e-mail ou senha inválidos.','invalid_credentials')}
      const actual=passwordHash(password,row.password_salt);if(!safeEqualHex(actual,row.password_hash))return sendError(res,401,'Usuário/e-mail ou senha inválidos.','invalid_credentials');
      if(row.role==='personal'&&row.account_status==='pending')return sendError(res,403,'Seu cadastro foi recebido e aguarda aprovação do administrador.','approval_pending');
      if(['personal','admin'].includes(row.role)&&row.account_status==='suspended')return sendError(res,423,'Seu acesso está suspenso. Entre em contato com o administrador.','account_suspended');
      if(!['personal','admin'].includes(row.role))return sendError(res,403,'Esta conta não possui acesso ao Vaz Personal.','wrong_role');
      const token=await issueSession(sql,row.id);return res.status(200).json({ok:true,token,user:publicUser(row)});
    }

    if(action==='me'&&method==='GET'){
      const a=await auth(req);if(!a)return sendError(res,401,'Sessão inválida.','unauthorized');
      if(['personal','admin'].includes(a.user.role)&&a.user.account_status!=='approved')return sendError(res,423,'Seu acesso não está disponível.','account_blocked');
      return res.status(200).json({ok:true,user:publicUser(a.user)});
    }

    if(action==='logout'&&method==='POST'){
      const a=await auth(req);if(!a)return res.status(200).json({ok:true});await a.sql`DELETE FROM vf_sessions WHERE token_hash=${a.tokenHash}`;return res.status(200).json({ok:true});
    }

    if(action==='profile'&&method==='POST'){
      const a=await auth(req);if(!a||!['personal','admin'].includes(a.user.role))return sendError(res,401,'Sessão inválida.','unauthorized');
      const name=clean(req.body?.name,80),mail=email(req.body?.email);if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail))return sendError(res,400,'Nome ou e-mail inválido.','invalid_profile');
      const dup=await a.sql`SELECT 1 FROM vf_users WHERE email=${mail} AND id<>${a.user.id} LIMIT 1`;if(dup.length)return sendError(res,409,'Este e-mail já está em uso.','email_exists');
      const rows=await a.sql`UPDATE vf_users SET name=${name},email=${mail},updated_at=now() WHERE id=${a.user.id} RETURNING *`;return res.status(200).json({ok:true,user:publicUser(rows[0])});
    }

    if(action==='change_password'&&method==='POST'){
      const a=await auth(req);if(!a)return sendError(res,401,'Sessão inválida.','unauthorized');
      const current=String(req.body?.currentPassword||''),next=String(req.body?.newPassword||'');if(next.length<8||next.length>200)return sendError(res,400,'A nova senha deve ter pelo menos 8 caracteres.','weak_password');
      const rows=await a.sql`SELECT password_salt,password_hash FROM vf_users WHERE id=${a.user.id} LIMIT 1`,r=rows[0];
      if(!r||!safeEqualHex(passwordHash(current,r.password_salt),r.password_hash))return sendError(res,401,'Senha atual incorreta.','invalid_current_password');
      const salt=crypto.randomBytes(16).toString('hex'),hash=passwordHash(next,salt);await a.sql`UPDATE vf_users SET password_salt=${salt},password_hash=${hash},must_change_password=false,updated_at=now() WHERE id=${a.user.id}`;
      await a.sql`DELETE FROM vf_sessions WHERE user_id=${a.user.id}`;const token=await issueSession(a.sql,a.user.id);return res.status(200).json({ok:true,token,mustChangePassword:false});
    }

    return res.status(405).json({ok:false,error:'method_not_allowed',message:'Operação não permitida.'});
  }catch(error){console.error('Personal auth error',error);return res.status(500).json({ok:false,error:'server_error',message:'Não foi possível concluir esta operação agora.'})}
}
