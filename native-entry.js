import { BackgroundGeolocation } from '@capgo/background-geolocation';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';

window.VazNative=window.VazNative||{};
window.VazNative.isNative=true;
window.VazNative.openExternal=async url=>Browser.open({url});
window.VazNative.openStravaAuth=async installationId=>{
  const url=`${window.VAZ_API_BASE}/api/strava-auth?installationId=${encodeURIComponent(installationId)}&native=1`;
  await Browser.open({url});
};

// Retorna ao Vaz Fitness após o OAuth do Strava.
App.addListener('appUrlOpen',async ({url})=>{
  if(!url?.startsWith('vazfitness://'))return;
  try{await Browser.close();}catch{}
  if(url.startsWith('vazfitness://strava-connected')){
    history.replaceState({},'',location.pathname);
    if(typeof refreshStravaStatus==='function')await refreshStravaStatus();
    if(typeof toast==='function')toast('Strava conectado com sucesso!');
  }
});

const browserStartGps=window.startGpsWatch;
const browserStopRun=window.stopRunTracking;

window.startGpsWatch=async function(){
  const r=state.currentRun;if(!r)return;
  // Evita deixar um watch do navegador rodando em paralelo no app nativo.
  if(runWatchId!==null&&navigator.geolocation){try{navigator.geolocation.clearWatch(runWatchId)}catch{}runWatchId=null;}
  r.gpsStatus='Solicitando GPS nativo…';save();updateRunMetrics();
  try{
    const permissions=await BackgroundGeolocation.requestPermissions({permissions:['location','notification']});
    if(permissions.location==='denied'){
      r.gpsStatus='GPS sem permissão';save();updateRunMetrics();return;
    }
    await BackgroundGeolocation.start({
      backgroundTitle:'Vaz Fitness — corrida em andamento',
      backgroundMessage:'GPS ativo para registrar sua corrida mesmo com a tela bloqueada.',
      requestPermissions:false,
      stale:false,
      distanceFilter:3,
      minIntervalMs:1000
    },(location,error)=>{
      if(error){
        r.gpsStatus=error.code==='NOT_AUTHORIZED'?'GPS sem permissão':'GPS nativo indisponível';save();updateRunMetrics();return;
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

// Caso o app seja reaberto durante uma corrida, religa o rastreamento nativo.
if(state.currentRun?.status==='running'){
  BackgroundGeolocation.stop().catch(()=>{}).finally(()=>window.startGpsWatch());
}
