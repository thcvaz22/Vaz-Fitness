import { authenticateStravaAthlete, getConnectionForUser, refreshConnection, stravaRateInfo, validInstallationId } from '../lib/strava-lib.js';
import { applyCors } from './cors.js';

const STRAVA_API='https://www.strava.com/api/v3';
const MAX_BACKFILL_DAYS=90;
const WEBHOOK_IDLE_WINDOW_SEC=6*60*60;

async function webhookState(sql,ownerId){
  if(String(process.env.STRAVA_WEBHOOK_ACTIVE||'')!=='1')return {active:false,pending:0};
  try{
    const rows=await sql`SELECT count(*)::int AS pending FROM strava_webhook_events WHERE owner_id=${Number(ownerId)} AND processed_at IS NULL AND object_type='activity'`;
    return {active:true,pending:Number(rows[0]?.pending)||0};
  }catch{return {active:false,pending:0}}
}
async function markWebhookProcessed(sql,ownerId){
  try{await sql`UPDATE strava_webhook_events SET processed_at=now() WHERE owner_id=${Number(ownerId)} AND processed_at IS NULL AND object_type='activity'`}catch{}
}

export default async function handler(req,res){
  if(applyCors(req,res))return;
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'Método não permitido.'});
  try{
    const auth=await authenticateStravaAthlete(req);
    if(!auth)return res.status(401).json({connected:false,error:'unauthorized'});
    const installationId=String(req.query?.installationId||'');
    if(!validInstallationId(installationId))return res.status(400).json({error:'installationId inválido'});
    let conn=await getConnectionForUser(installationId,auth.user.id);
    if(!conn)return res.status(401).json({connected:false,error:'Strava não conectado.'});
    conn=await refreshConnection(conn);

    const now=Math.floor(Date.now()/1000);
    const earliest=now-(MAX_BACKFILL_DAYS*24*60*60);
    const requestedAfter=Number(req.query?.after);
    const after=Number.isFinite(requestedAfter)?Math.max(earliest,Math.floor(requestedAfter)):earliest;
    const hook=await webhookState(auth.sql,conn.athlete_id);
    if(hook.active&&hook.pending===0&&after>now-WEBHOOK_IDLE_WINDOW_SEC){
      return res.status(200).json({connected:true,activities:[],syncedAfter:after,serverTime:now,source:'webhook_idle'});
    }

    const url=new URL(`${STRAVA_API}/athlete/activities`);
    url.searchParams.set('after',String(after));
    url.searchParams.set('per_page','100');
    url.searchParams.set('page','1');

    const r=await fetch(url,{headers:{Authorization:`Bearer ${conn.access_token}`}});
    const data=await r.json().catch(()=>[]);
    const rate=stravaRateInfo(r.headers);
    if(!r.ok){
      const message=data?.message||`Falha ao consultar atividades do Strava (${r.status}).`;
      if(r.status===429){res.setHeader('Retry-After','900');return res.status(429).json({connected:true,error:message,rate});}
      throw new Error(message);
    }

    const activities=(Array.isArray(data)?data:[])
      .filter(a=>String(a.sport_type||a.type||'').toLowerCase().includes('run'))
      .map(a=>({
        id:String(a.id),
        name:a.name||'Corrida no Strava',
        sportType:a.sport_type||a.type||'Run',
        distanceKm:+((Number(a.distance)||0)/1000).toFixed(2),
        movingTimeSec:Number(a.moving_time)||0,
        elapsedTimeSec:Number(a.elapsed_time)||0,
        startDate:a.start_date||null,
        startDateLocal:a.start_date_local||a.start_date||null,
        averageSpeed:Number(a.average_speed)||0,
        workoutType:a.workout_type??null,
        manual:!!a.manual,
        trainer:!!a.trainer
      }));
    if(hook.active&&hook.pending)await markWebhookProcessed(auth.sql,conn.athlete_id);
    return res.status(200).json({connected:true,activities,syncedAfter:after,serverTime:now,rate,source:hook.pending?'webhook_catchup':'poll'});
  }catch(err){
    return res.status(500).json({connected:true,error:err.message});
  }
}
