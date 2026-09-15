import { exchangeCode, readState, saveConnection } from './strava-lib.js';

export default async function handler(req,res){
  try{
    if(req.query?.error){return res.writeHead(302,{Location:'/?strava=denied'}).end();}
    const code=String(req.query?.code||'');
    const state=String(req.query?.state||'');
    if(!code||!state)return res.status(400).send('Autorização do Strava incompleta.');
    const parsed=readState(state);
    const token=await exchangeCode(code);
    await saveConnection(parsed.installationId,token);
    res.writeHead(302,{Location:parsed.returnTo||'/?strava=connected','Cache-Control':'no-store'});res.end();
  }catch(err){
    console.error('strava callback',err);
    res.writeHead(302,{Location:'/?strava=error'});res.end();
  }
}
