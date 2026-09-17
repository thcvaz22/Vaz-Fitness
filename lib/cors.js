const ALLOWED_ORIGINS = new Set([
  'https://vaz-fitness.vercel.app',
  'https://vaz-fitness-vaz3.vercel.app',
  'https://localhost',
  'capacitor://localhost',
  'ionic://localhost'
]);

export function applyCors(req,res){
  const origin=String(req.headers?.origin||'');
  if(ALLOWED_ORIGINS.has(origin)){
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
  }
  res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age','86400');
  if(req.method==='OPTIONS'){
    res.status(204).end();
    return true;
  }
  return false;
}
