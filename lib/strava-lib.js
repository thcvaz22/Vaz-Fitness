import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const STRAVA_API='https://www.strava.com/api/v3';
const STRAVA_OAUTH='https://www.strava.com/oauth';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function sql(){
  if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
}
export function requireStravaConfig(){
  if(!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) throw new Error('Credenciais do Strava não configuradas.');
}
export function validInstallationId(value=''){
  return /^[A-Za-z0-9_-]{16,100}$/.test(String(value));
}
function stateSecret(){return process.env.STRAVA_STATE_SECRET||process.env.STRAVA_CLIENT_SECRET||''}
export function makeState(installationId,returnTo='/'){
  requireStravaConfig();
  if(!validInstallationId(installationId))throw new Error('installationId inválido.');
  const payload=Buffer.from(JSON.stringify({installationId,returnTo,ts:Date.now()})).toString('base64url');
  const sig=crypto.createHmac('sha256',stateSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
export function readState(state=''){
  const [payload,sig]=String(state).split('.');
  if(!payload||!sig)throw new Error('Estado OAuth inválido.');
  const expected=crypto.createHmac('sha256',stateSecret()).update(payload).digest('base64url');
  const a=Buffer.from(sig),b=Buffer.from(expected);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))throw new Error('Estado OAuth inválido.');
  const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
  if(!validInstallationId(data.installationId)||Date.now()-Number(data.ts)>15*60*1000)throw new Error('Estado OAuth expirado.');
  return data;
}
export async function saveConnection(installationId,token){
  const db=sql();
  const athlete=token.athlete||{};
  const name=[athlete.firstname,athlete.lastname].filter(Boolean).join(' ')||null;
  await db`INSERT INTO strava_connections (installation_id,athlete_id,athlete_name,access_token,refresh_token,expires_at,scope,auto_sync,updated_at)
    VALUES (${installationId},${athlete.id||null},${name},${token.access_token},${token.refresh_token},${Number(token.expires_at)},${token.scope||''},true,now())
    ON CONFLICT (installation_id) DO UPDATE SET athlete_id=EXCLUDED.athlete_id, athlete_name=EXCLUDED.athlete_name, access_token=EXCLUDED.access_token, refresh_token=EXCLUDED.refresh_token, expires_at=EXCLUDED.expires_at, scope=EXCLUDED.scope, auto_sync=true, updated_at=now()`;
}
export async function getConnection(installationId){
  if(!validInstallationId(installationId))return null;
  const db=sql();
  const rows=await db`SELECT installation_id,athlete_id,athlete_name,access_token,refresh_token,expires_at,scope,auto_sync FROM strava_connections WHERE installation_id=${installationId} LIMIT 1`;
  return rows[0]||null;
}
export async function refreshConnection(conn){
  requireStravaConfig();
  if(Number(conn.expires_at)>Math.floor(Date.now()/1000)+120)return conn;
  const body=new URLSearchParams({client_id:String(process.env.STRAVA_CLIENT_ID),client_secret:process.env.STRAVA_CLIENT_SECRET,grant_type:'refresh_token',refresh_token:conn.refresh_token});
  const r=await fetch(`${STRAVA_OAUTH}/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  if(!r.ok)throw new Error(`Falha ao renovar Strava (${r.status}).`);
  const token=await r.json();
  const db=sql();
  await db`UPDATE strava_connections SET access_token=${token.access_token},refresh_token=${token.refresh_token},expires_at=${Number(token.expires_at)},updated_at=now() WHERE installation_id=${conn.installation_id}`;
  return {...conn,access_token:token.access_token,refresh_token:token.refresh_token,expires_at:Number(token.expires_at)};
}
export async function exchangeCode(code){
  requireStravaConfig();
  const body=new URLSearchParams({client_id:String(process.env.STRAVA_CLIENT_ID),client_secret:process.env.STRAVA_CLIENT_SECRET,code,grant_type:'authorization_code'});
  const r=await fetch(`${STRAVA_OAUTH}/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  if(!r.ok)throw new Error(`Strava recusou a autorização (${r.status}).`);
  return r.json();
}
function escXml(v=''){return String(v).replace(/[<>&'\"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]))}
function routeTime(point,index,session){
  if(point.t)return new Date(point.t).toISOString();
  const start=new Date(session.startedAt||session.date||Date.now()).getTime();
  const count=Math.max(1,(session.route||[]).length-1);
  return new Date(start+(Number(session.durationSec||0)*1000*index/count)).toISOString();
}
export function makeGpx(session){
  const points=(session.route||[]).filter(p=>Number.isFinite(+p.lat)&&Number.isFinite(+p.lng));
  if(points.length<2)return null;
  const trk=points.map((p,i)=>`<trkpt lat="${Number(p.lat).toFixed(6)}" lon="${Number(p.lng).toFixed(6)}"><time>${routeTime(p,i,session)}</time></trkpt>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Vaz Fitness" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${escXml(session.name||'Corrida Vaz Fitness')}</name></metadata><trk><name>${escXml(session.name||'Corrida Vaz Fitness')}</name><type>running</type><trkseg>${trk}</trkseg></trk></gpx>`;
}
async function waitForUpload(uploadId,headers){
  let last=null;
  for(let i=0;i<10;i++){
    if(i)await sleep(1000);
    const r=await fetch(`${STRAVA_API}/uploads/${encodeURIComponent(uploadId)}`,{headers});
    if(!r.ok)continue;
    last=await r.json().catch(()=>null);
    if(last?.error)throw new Error(`Strava: ${String(last.error).replace(/<[^>]*>/g,'')}`);
    if(last?.activity_id)return last;
  }
  return last;
}
export async function uploadRun(conn,session){
  conn=await refreshConnection(conn);
  const headers={Authorization:`Bearer ${conn.access_token}`};
  const gpx=makeGpx(session);
  if(gpx){
    const form=new FormData();
    form.append('file',new Blob([gpx],{type:'application/gpx+xml'}),`vaz-fitness-${session.id||Date.now()}.gpx`);
    form.append('data_type','gpx');
    form.append('sport_type','Run');
    form.append('name',session.name||'Corrida Vaz Fitness');
    form.append('description',`Treino registrado pelo Vaz Fitness • esforço ${session.effort||'não informado'}`);
    form.append('external_id',`vaz-fitness-${session.id||Date.now()}`);
    const r=await fetch(`${STRAVA_API}/uploads`,{method:'POST',headers,body:form});
    const data=await r.json().catch(()=>({}));
    if(!r.ok){
      const detail=String(data.message||data.error||'');
      if(/duplicate/i.test(detail))return {mode:'gpx',duplicate:true,status:detail};
      throw new Error(detail||`Falha no upload Strava (${r.status}).`);
    }
    const uploadId=data.id_str||data.id;
    if(!uploadId)return {mode:'gpx',accepted:true,...data};
    const processed=await waitForUpload(String(uploadId),headers);
    return {mode:'gpx',accepted:true,upload_id:String(uploadId),activity_id:processed?.activity_id||data.activity_id||null,status:processed?.status||data.status||'Enviado ao Strava'};
  }
  const start=new Date(session.startedAt||session.date||Date.now()).toISOString();
  const body=new URLSearchParams({name:session.name||'Corrida Vaz Fitness',sport_type:'Run',type:'Run',start_date_local:start,elapsed_time:String(Math.max(1,Number(session.durationSec)||60)),distance:String(Math.max(0,Number(session.distance)||0)*1000),description:`Treino registrado pelo Vaz Fitness • esforço ${session.effort||'não informado'}`});
  const r=await fetch(`${STRAVA_API}/activities`,{method:'POST',headers:{...headers,'Content-Type':'application/x-www-form-urlencoded'},body});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.message||`Falha no Strava (${r.status}).`);
  return {mode:'manual',activity_id:data.id};
}
