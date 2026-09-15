import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { applyCors } from './cors.js';

const DEFAULT_BRAND={
  systemName:'Vaz Fitness',
  primaryColor:'#f5c400',
  accentColor:'#151515',
  backgroundColor:'#ffffff',
  surfaceColor:'#ffffff',
  textColor:'#1c1c1c',
  logoUrl:null
};

function db(){
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
}
function tokenHash(token){return crypto.createHash('sha256').update(String(token)).digest('hex');}
function clean(v='',max=120){return String(v??'').trim().slice(0,max);}
function color(v,fallback){const x=clean(v,20);return /^#[0-9a-fA-F]{6}$/.test(x)?x.toLowerCase():fallback;}
function logo(v){
  const x=clean(v,800);if(!x)return null;
  try{const u=new URL(x);return u.protocol==='https:'?u.toString():null}catch{return null}
}
function rowToBrand(row){
  if(!row)return {...DEFAULT_BRAND};
  return {
    systemName:row.system_name||DEFAULT_BRAND.systemName,
    primaryColor:row.primary_color||DEFAULT_BRAND.primaryColor,
    accentColor:row.accent_color||DEFAULT_BRAND.accentColor,
    backgroundColor:row.background_color||DEFAULT_BRAND.backgroundColor,
    surfaceColor:row.surface_color||DEFAULT_BRAND.surfaceColor,
    textColor:row.text_color||DEFAULT_BRAND.textColor,
    logoUrl:row.logo_url||null,
    updatedAt:row.updated_at||null
  };
}
async function authenticate(req){
  const header=String(req.headers?.authorization||'');
  const token=header.startsWith('Bearer ')?header.slice(7).trim():'';
  if(!token)return null;
  const sql=db();
  const rows=await sql`SELECT u.id,u.public_code,u.role,u.email,u.name
    FROM vf_sessions s JOIN vf_users u ON u.id=s.user_id
    WHERE s.token_hash=${tokenHash(token)} AND s.expires_at>now() LIMIT 1`;
  return rows[0]?{sql,user:rows[0]}:null;
}
async function getBrand(sql,personalId){
  if(!personalId)return {...DEFAULT_BRAND};
  const rows=await sql`SELECT system_name,primary_color,accent_color,background_color,surface_color,text_color,logo_url,updated_at
    FROM vf_personal_branding WHERE personal_id=${personalId} LIMIT 1`;
  return rowToBrand(rows[0]);
}

export default async function handler(req,res){
  if(applyCors(req,res))return;
  try{
    const auth=await authenticate(req);
    if(!auth)return res.status(401).json({ok:false,error:'unauthorized',message:'Sessão inválida.'});

    if(req.method==='GET'){
      if(auth.user.role==='personal'){
        const branding=await getBrand(auth.sql,auth.user.id);
        return res.status(200).json({ok:true,branding,personal:{id:auth.user.id,name:auth.user.name,publicCode:auth.user.public_code}});
      }
      const accessRows=await auth.sql`SELECT a.status,a.personal_id,p.name AS personal_name
        FROM vf_athlete_access a LEFT JOIN vf_users p ON p.id=a.personal_id
        WHERE a.athlete_id=${auth.user.id} LIMIT 1`;
      const access=accessRows[0];
      if(!access||access.status==='pending')return res.status(403).json({ok:false,error:'pending',message:'Seu treino ainda não foi liberado pelo personal.'});
      if(access.status==='suspended')return res.status(423).json({ok:false,error:'suspended',message:'Não foi possível entrar, contate seu personal.'});
      const branding=await getBrand(auth.sql,access.personal_id);
      return res.status(200).json({ok:true,branding,personal:{id:access.personal_id,name:access.personal_name}});
    }

    if(req.method==='POST'){
      if(auth.user.role!=='personal')return res.status(403).json({ok:false,error:'forbidden',message:'Apenas o personal pode alterar a identidade do sistema.'});
      const body=req.body||{};
      const systemName=clean(body.systemName,50)||DEFAULT_BRAND.systemName;
      const primaryColor=color(body.primaryColor,DEFAULT_BRAND.primaryColor);
      const accentColor=color(body.accentColor,DEFAULT_BRAND.accentColor);
      const backgroundColor=color(body.backgroundColor,DEFAULT_BRAND.backgroundColor);
      const surfaceColor=color(body.surfaceColor,DEFAULT_BRAND.surfaceColor);
      const textColor=color(body.textColor,DEFAULT_BRAND.textColor);
      const logoUrl=logo(body.logoUrl);
      const rows=await auth.sql`INSERT INTO vf_personal_branding
        (personal_id,system_name,primary_color,accent_color,background_color,surface_color,text_color,logo_url,updated_at)
        VALUES (${auth.user.id},${systemName},${primaryColor},${accentColor},${backgroundColor},${surfaceColor},${textColor},${logoUrl},now())
        ON CONFLICT (personal_id) DO UPDATE SET system_name=EXCLUDED.system_name,primary_color=EXCLUDED.primary_color,
        accent_color=EXCLUDED.accent_color,background_color=EXCLUDED.background_color,surface_color=EXCLUDED.surface_color,
        text_color=EXCLUDED.text_color,logo_url=EXCLUDED.logo_url,updated_at=now()
        RETURNING system_name,primary_color,accent_color,background_color,surface_color,text_color,logo_url,updated_at`;
      try{await auth.sql`INSERT INTO vf_audit_log (actor_id,athlete_id,action,payload) VALUES (${auth.user.id},NULL,'branding_updated',CAST(${JSON.stringify({systemName})} AS jsonb))`;}catch{}
      return res.status(200).json({ok:true,branding:rowToBrand(rows[0])});
    }

    return res.status(405).json({ok:false,error:'method_not_allowed',message:'Método não permitido.'});
  }catch(error){
    console.error('Branding API error',error);
    return res.status(500).json({ok:false,error:'server_error',message:'Não foi possível carregar a identidade do sistema agora.'});
  }
}
