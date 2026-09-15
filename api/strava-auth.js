import { makeState, requireStravaConfig, validInstallationId } from '../lib/strava-lib.js';
import { requireApprovedAthlete } from '../lib/session-auth.js';

export default async function handler(req,res){
  try{
    requireStravaConfig();
    const auth=await requireApprovedAthlete(req);
    if(!auth)return res.status(401).json({error:'unauthorized'});
    if(!auth.approved)return res.status(423).json({error:'athlete_not_approved'});
    const installationId=String(req.query?.installationId||'');
    if(!validInstallationId(installationId))return res.status(400).json({error:'installationId inválido'});
    const host=req.headers['x-forwarded-host']||req.headers.host;
    const proto=req.headers['x-forwarded-proto']||'https';
    const origin=`${proto}://${host}`;
    const redirectUri=`${origin}/api/strava-callback`;
    const native=String(req.query?.native||'')==='1';
    const returnTo=native?'vazfitness://strava-connected':'/?strava=connected';
    const state=makeState(installationId,returnTo,auth.user.id);
    const url=new URL(native?'https://www.strava.com/oauth/mobile/authorize':'https://www.strava.com/oauth/authorize');
    url.searchParams.set('client_id',String(process.env.STRAVA_CLIENT_ID));
    url.searchParams.set('redirect_uri',redirectUri);
    url.searchParams.set('response_type','code');
    url.searchParams.set('approval_prompt','auto');
    url.searchParams.set('scope','activity:read,activity:write');
    url.searchParams.set('state',state);
    res.writeHead(302,{Location:url.toString(),'Cache-Control':'no-store'});res.end();
  }catch(err){res.status(500).json({error:'strava_auth_failed'});}
}
