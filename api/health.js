import adminHandler from '../lib/admin-handler.js';
import trainingLibraryHandler from '../lib/training-library-handler.js';

export default async function handler(req,res){
  const scope=String(req.query?.scope||'');
  if(scope==='admin')return adminHandler(req,res);
  if(scope==='library')return trainingLibraryHandler(req,res);
  return res.status(200).json({ok:true,app:'Vaz Fitness',aion:Boolean(process.env.GEMINI_API_KEY),model:process.env.GEMINI_MODEL||'gemini-3.8-flash'});
}
