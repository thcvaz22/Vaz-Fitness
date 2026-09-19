// Vaz Fitness — corrida ao vivo com GPS, pace e resumo.
let runTimer=null;
let runWatchId=null;
let lastRunPosition=null;

const baseRenderVaz=render;
render=function(){
  if(activeView==='workout' && state.currentRun){
    const v=document.getElementById('view');
    v.innerHTML=renderRunLive();
    bindDynamic();
    bindRunControls();
    updateRunMetrics();
    return;
  }
  baseRenderVaz();
};

function startRun(item){
  const pending=state.pendingExtraWorkout,extra=!!(pending&&String(pending.planId)===String(item.id)&&Date.now()-Number(pending.selectedAt||0)<30*60*1000);
  state.currentRun={
    planId:item.id,
    name:item.name,
    plannedPace:item.pace,
    plannedDuration:item.duration,
    intensity:item.intensity,
    status:'ready',
    startedAt:null,
    stoppedAt:null,
    elapsedSec:0,
    distanceKm:0,
    currentPace:null,
    effort:null,
    gpsStatus:'GPS ainda não iniciado',
    gpsAccuracy:null,
    route:[],
    extraWorkout:extra,
    executedOnRestDay:extra&&!!pending.executedOnRestDay,
    anticipatedWorkout:extra&&pending?.mode==='anticipate',
    anticipatedFromDate:extra?pending?.anticipatedFromDate||null:null,
    generatedExtra:extra&&pending?.mode==='generated',
    originalPlanDay:item.day,
    originalPlanId:item.id
  };
  if(extra)state.pendingExtraWorkout=null;
  save();
  activeView='workout';
  render();
}

function renderRunLive(){
  const r=state.currentRun;
  if(!r)return '';
  const review=r.status==='review';
  const running=r.status==='running';
  const effortLabel={easy:'Fácil',moderate:'Moderado',hard:'Difícil'}[r.effort]||'Não informado';
  const pace=formatRunPace(calcAveragePace(r.elapsedSec,r.distanceKm));
  return `<section class="run-live-shell">
    <div class="run-live-head">
      <div><span class="eyebrow">CORRIDA AO VIVO</span><h1>${escapeHtml(r.name)}</h1><p>${r.intensity||'Corrida'} • meta ${r.plannedDuration} min • pace sugerido ${r.plannedPace}/km</p></div>
      <span class="run-gps-pill ${r.gpsStatus.includes('ativo')?'active':''}">${escapeHtml(r.gpsStatus)}</span>
    </div>

    <div class="run-dashboard-card">
      <div class="run-clock" id="runClock">${formatRunTime(r.elapsedSec)}</div>
      <span class="run-clock-label">tempo de treino</span>
      <div class="run-metrics-grid">
        <div class="run-metric"><span>Distância</span><strong id="runDistance">${Number(r.distanceKm||0).toFixed(2)} km</strong></div>
        <div class="run-metric"><span>Pace médio</span><strong id="runAvgPace">${pace}/km</strong></div>
        <div class="run-metric"><span>Pace atual</span><strong id="runCurrentPace">${formatRunPace(r.currentPace)}/km</strong></div>
        <div class="run-metric"><span>GPS</span><strong id="runAccuracy">${r.gpsAccuracy?`±${Math.round(r.gpsAccuracy)} m`:'—'}</strong></div>
      </div>

      ${r.status==='ready'?`<div class="run-start-panel"><p>Ao iniciar, o Vaz Fitness pedirá acesso à localização para calcular distância, trajeto e pace. Se você negar, o cronômetro continuará funcionando e poderá informar a distância manualmente ao terminar.</p><button class="btn primary run-main-btn" data-run-start>▶ Iniciar corrida</button></div>`:''}
      ${running?`<div class="run-live-note"><span class="pulse-dot"></span><strong>Gravando treino</strong><small>Mantenha o app aberto para maior precisão do GPS.</small></div><button class="btn run-stop-btn" data-run-stop>■ Parar corrida</button>`:''}

      ${review?`<div class="run-review">
        <div class="run-review-title"><span class="eyebrow">CORRIDA FINALIZADA</span><h2>Confira os dados</h2><p>Você pode ajustar a distância caso tenha corrido em esteira ou o GPS tenha ficado indisponível.</p></div>
        <label class="run-distance-field">Distância percorrida (km)<input type="number" inputmode="decimal" min="0" step="0.01" value="${Number(r.distanceKm||0).toFixed(2)}" data-run-distance></label>
        <div class="run-review-summary"><div><span>Tempo</span><strong>${formatRunTime(r.elapsedSec)}</strong></div><div><span>Pace</span><strong id="runReviewPace">${pace}/km</strong></div></div>
        <div class="run-effort-block"><span>Como foi a dificuldade?</span><div class="run-effort-options">
          <button type="button" class="run-effort ${r.effort==='easy'?'selected':''}" data-run-effort="easy">🙂<strong>Fácil</strong></button>
          <button type="button" class="run-effort ${r.effort==='moderate'?'selected':''}" data-run-effort="moderate">😤<strong>Moderado</strong></button>
          <button type="button" class="run-effort ${r.effort==='hard'?'selected':''}" data-run-effort="hard">🥵<strong>Difícil</strong></button>
        </div></div>
        <button class="btn primary run-main-btn" data-run-finish ${r.effort?'':'disabled'}>Avançar para o resumo</button>
        <small class="run-review-hint">Dificuldade atual: <strong>${effortLabel}</strong></small>
      </div>`:''}
    </div>
  </section>`;
}

function bindRunControls(){
  document.querySelector('[data-run-start]')?.addEventListener('click',beginRunTracking);
  document.querySelector('[data-run-stop]')?.addEventListener('click',stopRunTracking);
  document.querySelector('[data-run-distance]')?.addEventListener('input',e=>{
    const value=Math.max(0,Number(String(e.target.value).replace(',','.'))||0);
    state.currentRun.distanceKm=value;
    const pace=formatRunPace(calcAveragePace(state.currentRun.elapsedSec,value));
    const el=document.getElementById('runReviewPace');if(el)el.textContent=`${pace}/km`;
    save();
  });
  document.querySelectorAll('[data-run-effort]').forEach(b=>b.addEventListener('click',()=>{
    state.currentRun.effort=b.dataset.runEffort;
    save();render();
  }));
  document.querySelector('[data-run-finish]')?.addEventListener('click',finishRunSession);
}

function beginRunTracking(){
  const r=state.currentRun;if(!r)return;
  r.status='running';
  r.startedAt=Date.now();
  r.elapsedSec=0;
  r.distanceKm=0;
  r.route=[];
  r.currentPace=null;
  r.gpsStatus='Solicitando GPS…';
  lastRunPosition=null;
  save();
  startRunTimer();
  startGpsWatch();
  render();
}

function startRunTimer(){
  clearInterval(runTimer);
  runTimer=setInterval(()=>{
    const r=state.currentRun;
    if(!r||r.status!=='running')return;
    r.elapsedSec=Math.max(0,Math.floor((Date.now()-r.startedAt)/1000));
    updateRunMetrics();
  },500);
}

function startGpsWatch(){
  const r=state.currentRun;if(!r)return;
  if(!navigator.geolocation){r.gpsStatus='GPS não disponível';save();updateRunMetrics();return;}
  if(runWatchId!==null)navigator.geolocation.clearWatch(runWatchId);
  runWatchId=navigator.geolocation.watchPosition(onRunPosition,onRunGpsError,{enableHighAccuracy:true,maximumAge:1500,timeout:15000});
}

function onRunPosition(pos){
  const r=state.currentRun;if(!r||r.status!=='running')return;
  const p={lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy,t:pos.timestamp};
  r.gpsAccuracy=pos.coords.accuracy;
  if(p.accuracy>70){r.gpsStatus='GPS com baixa precisão';updateRunMetrics();return;}
  r.gpsStatus='GPS ativo';
  if(lastRunPosition){
    const meters=haversineMeters(lastRunPosition,p);
    const dt=Math.max(1,(p.t-lastRunPosition.t)/1000);
    const speed=meters/dt;
    // Descarta saltos improváveis de localização e ruído muito pequeno.
    if(meters>=2 && speed<=12.5){
      r.distanceKm+=meters/1000;
      if(speed>=0.7){
        const secKm=1000/speed;
        r.currentPace=(secKm>=120&&secKm<=1800)?secKm:null;
      }
    }
  }
  lastRunPosition=p;
  if(r.route.length<1500)r.route.push({lat:+p.lat.toFixed(6),lng:+p.lng.toFixed(6),t:p.t,accuracy:Math.round(p.accuracy)});
  if(r.route.length%5===0)save();
  updateRunMetrics();
}

function onRunGpsError(err){
  const r=state.currentRun;if(!r)return;
  const messages={1:'GPS sem permissão',2:'Sinal de GPS indisponível',3:'GPS demorou para responder'};
  r.gpsStatus=messages[err.code]||'GPS indisponível';
  save();updateRunMetrics();
}

function stopRunTracking(){
  const r=state.currentRun;if(!r||r.status!=='running')return;
  r.elapsedSec=Math.max(1,Math.floor((Date.now()-r.startedAt)/1000));
  r.stoppedAt=Date.now();
  r.status='review';
  r.gpsStatus=r.route.length?'GPS concluído':'Sem trajeto GPS';
  clearInterval(runTimer);runTimer=null;
  if(runWatchId!==null){navigator.geolocation.clearWatch(runWatchId);runWatchId=null;}
  lastRunPosition=null;
  save();render();
}

function finishRunSession(){
  const r=state.currentRun;if(!r||!r.effort)return;
  const item=state.plan.find(x=>x.id===r.planId);
  const paceSec=calcAveragePace(r.elapsedSec,r.distanceKm);
  const session={
    id:Date.now(),date:new Date().toISOString(),name:r.name,type:r.intensity||'Corrida',
    duration:Math.max(1,Math.round(r.elapsedSec/60)),durationSec:r.elapsedSec,
    distance:+Number(r.distanceKm||0).toFixed(2),pace:formatRunPace(paceSec),plannedPace:r.plannedPace,
    effort:r.effort,route:r.route||[],routePoints:(r.route||[]).length,
    planId:r.planId,extraWorkout:!!r.extraWorkout,executedOnRestDay:!!r.executedOnRestDay,
    anticipatedWorkout:!!r.anticipatedWorkout,anticipatedFromDate:r.anticipatedFromDate||null,generatedExtra:!!r.generatedExtra,
    originalPlanDay:r.originalPlanDay??item?.day,originalPlanId:r.originalPlanId||item?.id
  };
  state.runSessions.push(session);
  if(item&&!r.extraWorkout){item.status='done';item.nextPace=suggestRunPace(item.intensity);}
  state.currentRun=null;
  state.score=Math.min(99,state.score+1);
  save();
  showRunSummary(session);
  activeView='home';render();
}

function showRunSummary(s){
  const effort={easy:'Fácil',moderate:'Moderado',hard:'Difícil'}[s.effort]||'—';
  const routeText=s.routePoints?`${s.routePoints} pontos GPS registrados`:'Distância informada manualmente';
  document.getElementById('summaryContent').innerHTML=`<div class="summary-wrap">
    <div class="summary-hero"><span class="eyebrow">${s.extraWorkout?'CORRIDA EXTRA CONCLUÍDA':'CORRIDA CONCLUÍDA'}</span><h2>${escapeHtml(s.name)}</h2><p style="color:#bbb">${escapeHtml(routeText)}</p></div>
    <div class="run-final-grid">
      <div class="summary-box"><small>Tipo de treino</small><strong>${escapeHtml(s.type)}</strong></div>
      <div class="summary-box"><small>Tempo</small><strong>${formatRunTime(s.durationSec)}</strong></div>
      <div class="summary-box"><small>Pace médio</small><strong>${s.pace}/km</strong></div>
      <div class="summary-box"><small>Distância</small><strong>${s.distance.toFixed(2)} km</strong></div>
      <div class="summary-box"><small>Dificuldade</small><strong>${effort}</strong></div>
    </div>
    <div class="card aion-card" style="margin-top:14px"><div class="card-head"><div><h3>Leitura AION</h3><p>Base para o próximo treino</p></div></div><div class="insight">${runAionSummary(s)}</div></div>
    <div class="dialog-actions"><button class="btn primary" onclick="document.getElementById('summaryDialog').close()">Concluir</button></div>
  </div>`;
  document.getElementById('summaryDialog').showModal();
}

function runAionSummary(s){
  if(s.effort==='easy')return `Você terminou ${s.distance.toFixed(2)} km em ${formatRunTime(s.durationSec)}, com pace médio de ${s.pace}/km e esforço fácil. A próxima progressão pode ser pequena e controlada, alterando tempo, distância ou ritmo — não todos ao mesmo tempo.`;
  if(s.effort==='hard')return `A sessão foi classificada como difícil. Antes de acelerar o próximo treino, a AION vai priorizar recuperação e comparar este resultado com seu histórico recente.`;
  return `O esforço moderado ficou dentro da zona principal de trabalho. A AION vai comparar ${s.pace}/km e ${s.distance.toFixed(2)} km com as próximas sessões antes de aumentar a exigência.`;
}

function updateRunMetrics(){
  const r=state.currentRun;if(!r)return;
  const clock=document.getElementById('runClock');if(clock)clock.textContent=formatRunTime(r.elapsedSec||0);
  const dist=document.getElementById('runDistance');if(dist)dist.textContent=`${Number(r.distanceKm||0).toFixed(2)} km`;
  const avg=document.getElementById('runAvgPace');if(avg)avg.textContent=`${formatRunPace(calcAveragePace(r.elapsedSec,r.distanceKm))}/km`;
  const cur=document.getElementById('runCurrentPace');if(cur)cur.textContent=`${formatRunPace(r.currentPace)}/km`;
  const acc=document.getElementById('runAccuracy');if(acc)acc.textContent=r.gpsAccuracy?`±${Math.round(r.gpsAccuracy)} m`:'—';
}
function calcAveragePace(sec,km){return km>=0.08?sec/km:null}
function formatRunPace(secPerKm){if(!Number.isFinite(secPerKm)||secPerKm<=0)return '--:--';const m=Math.floor(secPerKm/60),s=Math.round(secPerKm%60);return `${m}:${String(s===60?0:s).padStart(2,'0')}`}
function formatRunTime(sec){sec=Math.max(0,Math.floor(sec||0));const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function haversineMeters(a,b){const R=6371000,toRad=d=>d*Math.PI/180,dLat=toRad(b.lat-a.lat),dLon=toRad(b.lng-a.lng),lat1=toRad(a.lat),lat2=toRad(b.lat);const x=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}

// Não envia coordenadas GPS precisas à AION externa.
const baseBuildAionContext=buildAionContext;
buildAionContext=function(){
  const ctx=baseBuildAionContext();
  ctx.recentRuns=state.runSessions.slice(-4).map(r=>({date:r.date,name:r.name,type:r.type,duration:r.duration,durationSec:r.durationSec,distance:r.distance,pace:r.pace,plannedPace:r.plannedPace,effort:r.effort,routePoints:r.routePoints||0}));
  if(state.currentRun)ctx.currentRun={name:state.currentRun.name,status:state.currentRun.status,elapsedSec:state.currentRun.elapsedSec,distance:+Number(state.currentRun.distanceKm||0).toFixed(2),effort:state.currentRun.effort,plannedPace:state.currentRun.plannedPace};
  return ctx;
};

(function installRunStyles(){
  const style=document.createElement('style');style.id='vaz-run-live-styles';style.textContent=`
  .run-live-shell{max-width:820px;margin:0 auto;padding-bottom:120px}.run-live-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px}.run-live-head h1{margin:6px 0 6px;font-size:32px}.run-live-head p{margin:0;color:var(--muted)}.run-gps-pill{font-size:11px;font-weight:800;padding:9px 12px;border-radius:999px;background:#f1f1f1;color:#666;white-space:nowrap}.run-gps-pill.active{background:#e8f7ef;color:#12804b}.run-dashboard-card{background:#171717;color:white;border-radius:32px;padding:28px;box-shadow:var(--shadow);text-align:center}.run-clock{font-size:68px;line-height:1;font-weight:900;font-variant-numeric:tabular-nums;letter-spacing:-.05em;margin-top:10px}.run-clock-label{display:block;color:#8f8f8f;font-size:12px;margin-top:8px}.run-metrics-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:26px 0}.run-metric{background:#242424;border:1px solid #343434;border-radius:18px;padding:15px 10px}.run-metric span{display:block;color:#9d9d9d;font-size:10px;margin-bottom:7px}.run-metric strong{font-size:17px}.run-start-panel{max-width:600px;margin:0 auto}.run-start-panel p{color:#b9b9b9;font-size:13px;line-height:1.55}.run-main-btn{width:100%;margin-top:16px;min-height:52px}.run-stop-btn{width:100%;background:#fff0f0!important;color:#bd3030!important;margin-top:18px;min-height:52px}.run-live-note{display:flex;align-items:center;justify-content:center;gap:8px;color:#ddd;font-size:13px}.run-live-note small{color:#909090}.pulse-dot{width:10px;height:10px;border-radius:50%;background:#ef5050;box-shadow:0 0 0 7px rgba(239,80,80,.12)}.run-review{text-align:left;margin-top:8px}.run-review-title h2{font-size:28px;margin:6px 0}.run-review-title p{color:#aaa}.run-distance-field{color:#bbb;display:block;margin:18px 0}.run-distance-field input{font-size:28px;font-weight:800;background:#292929;color:white;border-color:#3c3c3c}.run-review-summary{display:grid;grid-template-columns:1fr 1fr;gap:10px}.run-review-summary>div{padding:15px;background:#242424;border-radius:16px}.run-review-summary span{display:block;color:#999;font-size:10px}.run-review-summary strong{font-size:22px}.run-effort-block{margin-top:20px}.run-effort-block>span{font-size:12px;color:#bbb;font-weight:700}.run-effort-options{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}.run-effort{border:1px solid #3d3d3d;background:#242424;color:white;border-radius:16px;padding:16px 8px;font-size:22px}.run-effort strong{display:block;font-size:11px;margin-top:6px}.run-effort.selected{border-color:var(--yellow);background:#3c3515;box-shadow:inset 0 0 0 1px var(--yellow)}.run-review-hint{display:block;text-align:center;color:#888;margin-top:10px}.run-final-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.run-final-grid .summary-box strong{font-size:16px}@media(max-width:700px){.run-live-head{display:block}.run-gps-pill{display:inline-block;margin-top:12px}.run-dashboard-card{padding:24px 16px}.run-clock{font-size:56px}.run-metrics-grid{grid-template-columns:1fr 1fr}.run-live-note{flex-wrap:wrap}.run-live-note small{width:100%}.run-final-grid{grid-template-columns:1fr 1fr}.run-final-grid .summary-box:first-child{grid-column:1/-1}}@media(max-width:380px){.run-clock{font-size:48px}.run-metric strong{font-size:15px}.run-effort-options{grid-template-columns:1fr}.run-review-summary{grid-template-columns:1fr}}
  `;document.head.appendChild(style);
})();

if(state.currentRun&&state.currentRun.status==='running'){
  // Em caso de recarga, o cronômetro é recuperado; o GPS volta a ser solicitado.
  state.currentRun.elapsedSec=Math.max(0,Math.floor((Date.now()-state.currentRun.startedAt)/1000));
  startRunTimer();startGpsWatch();
}
render();
