import { authenticateStravaAthlete, getConnectionForUser, validInstallationId } from '../lib/strava-lib.js';
import { applyCors } from './cors.js';

export default async function handler(req,res){
  if(applyCors(req,res))return;
  res.setHeader('Cache-Control','no-store');
  try{
    const auth=await authenticateStravaAthlete(req);
    if(!auth)return res.status(401).json({connected:false,error:'unauthorized'});
    const installationId=String(req.query?.installationId||'');
    if(!validInstallationId(installationId))return res.status(200).json({connected:false});
    const conn=await getConnectionForUser(installationId,auth.user.id);
    if(!conn)return res.status(200).json({connected:false});
    return res.status(200).json({connected:true,athleteId:conn.athlete_id,athleteName:conn.athlete_name,autoSync:conn.auto_sync,scope:conn.scope});
  }catch(err){return res.status(500).json({connected:false,error:err.message});}
}
