import crypto from 'node:crypto';
import { database } from './session-auth.js';

function eventKey(body={}){
  return crypto.createHash('sha256').update([
    body.object_type||'',body.object_id||'',body.aspect_type||'',body.owner_id||'',body.event_time||''
  ].join(':')).digest('hex');
}
function send(res,status,payload){res.setHeader('Cache-Control','no-store');return res.status(status).json(payload)}

export default async function stravaWebhookHandler(req,res){
  try{
    if(req.method==='GET'){
      const mode=String(req.query?.['hub.mode']||'');
      const token=String(req.query?.['hub.verify_token']||'');
      const challenge=String(req.query?.['hub.challenge']||'');
      const expected=String(process.env.STRAVA_WEBHOOK_VERIFY_TOKEN||'');
      if(!expected||mode!=='subscribe'||token!==expected||!challenge)return send(res,403,{error:'verification_failed'});
      return send(res,200,{'hub.challenge':challenge});
    }
    if(req.method!=='POST')return send(res,405,{error:'method_not_allowed'});
    const body=req.body||{};
    const ownerId=Number(body.owner_id),objectId=Number(body.object_id),eventTime=Number(body.event_time);
    const objectType=String(body.object_type||'').slice(0,40),aspectType=String(body.aspect_type||'').slice(0,40);
    if(!Number.isFinite(ownerId)||!Number.isFinite(objectId)||!Number.isFinite(eventTime)||!objectType||!aspectType){
      return send(res,200,{ok:true,ignored:true});
    }
    try{
      const sql=database();
      const key=eventKey(body);
      await sql`INSERT INTO strava_webhook_events(event_key,owner_id,object_id,object_type,aspect_type,event_time,updates,payload)
        VALUES (${key},${ownerId},${objectId},${objectType},${aspectType},${eventTime},CAST(${JSON.stringify(body.updates||{})} AS jsonb),CAST(${JSON.stringify(body)} AS jsonb))
        ON CONFLICT (event_key) DO NOTHING`;
      return send(res,200,{ok:true,queued:true});
    }catch(error){
      const msg=String(error?.message||'');
      if(/strava_webhook_events|relation .* does not exist/i.test(msg))return send(res,200,{ok:true,queued:false,migrationRequired:true});
      throw error;
    }
  }catch(error){
    console.error('strava webhook',String(error?.message||error).slice(0,240));
    return send(res,500,{ok:false});
  }
}
