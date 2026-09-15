import { getConnection, validInstallationId } from './strava-lib.js';

export default async function handler(req,res){
  try{
    const installationId=String(req.query?.installationId||'');
    if(!validInstallationId(installationId))return res.status(200).json({connected:false});
    const conn=await getConnection(installationId);
    if(!conn)return res.status(200).json({connected:false});
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({connected:true,athleteId:conn.athlete_id,athleteName:conn.athlete_name,autoSync:conn.auto_sync,scope:conn.scope});
  }catch(err){return res.status(500).json({connected:false,error:err.message});}
}
