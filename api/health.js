import adminHandler from '../lib/admin-handler.js';
import trainingLibraryHandler from '../lib/training-library-handler.js';
import personalToolsHandler from '../lib/personal-tools-handler.js';
import stravaWebhookHandler from '../lib/strava-webhook-handler.js';

export default async function handler(req,res){
  const scope=String(req.query?.scope||'');
  if(scope==='admin')return adminHandler(req,res);
  if(scope==='library')return trainingLibraryHandler(req,res);
  if(scope==='tools')return personalToolsHandler(req,res);
  if(scope==='strava_webhook')return stravaWebhookHandler(req,res);
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({ok:true,app:'Vaz Fitness',aion:Boolean(process.env.GEMINI_API_KEY),model:process.env.GEMINI_MODEL||'gemini-3.8-flash',scaleProfile:'300-ready-v1'});
}
