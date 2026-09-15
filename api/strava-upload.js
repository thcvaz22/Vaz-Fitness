import { getConnection, uploadRun, validInstallationId } from './strava-lib.js';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Método não permitido'});
  try{
    const {installationId,session}=req.body||{};
    if(!validInstallationId(installationId))return res.status(400).json({error:'installationId inválido'});
    if(!session||!session.durationSec)return res.status(400).json({error:'Dados da corrida incompletos'});
    const conn=await getConnection(installationId);
    if(!conn)return res.status(409).json({error:'Strava não conectado'});
    if(!conn.auto_sync)return res.status(200).json({synced:false,reason:'auto_sync_disabled'});
    const result=await uploadRun(conn,session);
    return res.status(200).json({synced:true,result});
  }catch(err){
    console.error('strava upload',err);
    return res.status(500).json({synced:false,error:err.message});
  }
}
