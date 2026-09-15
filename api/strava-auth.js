import { makeState, requireStravaConfig, validInstallationId } from './strava-lib.js';

export default async function handler(req,res){
  try{
    requireStravaConfig();
    const installationId=String(req.query?.installationId||'');
    if(!validInstallationId(installationId))return res.status(400).json({error:'installationId inválido'});
    const host=req.headers['x-forwarded-host']||req.headers.host;
    const proto=req.headers['x-forwarded-proto']||'https';
    const origin=`${proto}://${host}`;
    const redirectUri=`${origin}/api/strava-callback`;
    const state=makeState(installationId,'/?strava=connected');
    const url=new URL('https://www.strava.com/oauth/authorize');
    url.searchParams.set('client_id',String(process.env.STRAVA_CLIENT_ID));
    url.searchParams.set('redirect_uri',redirectUri);
    url.searchParams.set('response_type','code');
    url.searchParams.set('approval_prompt','auto');
    url.searchParams.set('scope','activity:read,activity:write');
    url.searchParams.set('state',state);
    res.writeHead(302,{Location:url.toString(),'Cache-Control':'no-store'});res.end();
  }catch(err){res.status(500).json({error:err.message});}
}
