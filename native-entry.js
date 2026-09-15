import { BackgroundGeolocation } from '@capgo/background-geolocation';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';

window.VazNative=window.VazNative||{};
window.VazNative.isNative=true;
window.VazNative.openExternal=async url=>Browser.open({url});
window.VazNative.openStravaAuth=async installationId=>{
  const token=localStorage.getItem('vazFitness.authToken')||'';
  if(!token)throw new Error('Entre na sua conta antes de conectar o Strava.');
  const endpoint=`${window.VAZ_API_BASE}/api/vf?action=strava_oauth_url&installationId=${encodeURIComponent(installationId)}&native=1`;
  const response=await fetch(endpoint,{headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.url)throw new Error(data.message||'Não foi possível iniciar a conexão com o Strava.');
  await Browser.open({url:data.url});
};

App.addListener('appUrlOpen',async ({url})=>{
  if(!url?.startsWith('vazfitness://'))return;
  try{await Browser.close();}catch{}
  if(url.startsWith('vazfitness://strava-connected')){
    history.replaceState({},'',location.pathname);
    if(typeof refreshStravaStatus==='function')await refreshStravaStatus({force:true});
    if(typeof toast==='function')toast('Strava conectado com sucesso!');
  }
});

const browserStartGps=window.startGpsWatch;
const browserStopRun=window.stopRunTracking;

window.startGpsWatch=async function(){
  const r=state.currentRun;if(!r)return;
  if(runWatchId!==null&&navigator.geolocation){try{navigator.geolocation.clearWatch(runWatchId)}catch{}runWatchId=null;}
  r.gpsStatus='Solicitando GPS nativo…';save();updateRunMetrics();
  try{
    await BackgroundGeolocation.start({
      backgroundTitle:'Vaz Fitness — corrida em andamento',
      backgroundMessage:'GPS ativo para registrar sua corrida mesmo com a tela bloqueada.',
      requestPermissions:true,
      stale:false,
      distanceFilter:3
    },(location,error)=>{
      if(error){
        const denied=['NOT_AUTHORIZED','PERMISSION_DENIED'].includes(error.code);
        r.gpsStatus=denied?'GPS sem permissão':'GPS nativo indisponível';
        save();updateRunMetrics();return;
      }
      if(!location||!state.currentRun||state.currentRun.status!=='running')return;
      onRunPosition({
        coords:{latitude:location.latitude,longitude:location.longitude,accuracy:location.accuracy,speed:location.speed},
        timestamp:location.time||Date.now()
      });
      if(state.currentRun)state.currentRun.gpsStatus='GPS nativo ativo';
    });
  }catch(err){
    console.warn('native gps',err);
    r.gpsStatus='GPS nativo indisponível';save();updateRunMetrics();
    if(typeof browserStartGps==='function')browserStartGps();
  }
};

window.stopRunTracking=function(){
  BackgroundGeolocation.stop().catch(()=>{});
  return browserStopRun.apply(this,arguments);
};

if(state.currentRun?.status==='running'){
  BackgroundGeolocation.stop().catch(()=>{}).finally(()=>window.startGpsWatch());
}
