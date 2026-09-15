import { authenticateStravaAthlete, getConnectionForUser, uploadRun, validInstallationId } from '../lib/strava-lib.js';
import { applyCors } from './cors.js';

export default async function handler(req,res){
  if(applyCors(req,res))return;
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Método não permitido'});
  try{
    const auth=await authenticateStravaAthlete(req);
    if(!auth)return res.status(401).json({synced:false,error:'unauthorized'});
    const {installationId,session}=req.body||{};
    if(!validInstallationId(installationId))return res.status(400).json({error:'installationId inválido'});
    if(!session||!session.durationSec)return res.status(400).json({error:'Dados da corrida incompletos'});
    const conn=await getConnectionForUser(installationId,auth.user.id);
    if(!conn)return res.status(409).json({error:'Strava não conectado'});
    if(!conn.auto_sync)return res.status(200).json({synced:false,reason:'auto_sync_disabled'});
    const result=await uploadRun(conn,session);
    return res.status(200).json({synced:true,result});
  }catch(err){
    console.error('strava upload',err);
    return res.status(500).json({synced:false,error:err.message});
  }
}
