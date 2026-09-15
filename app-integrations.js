// Vaz Fitness — integrações externas (Strava).
const VAZ_INSTALLATION_KEY='vazFitness.installationId';
function getInstallationId(){
  let id=localStorage.getItem(VAZ_INSTALLATION_KEY);
  if(!id){
    const uuid=(crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`);
    id=`vf_${uuid}`;localStorage.setItem(VAZ_INSTALLATION_KEY,id);
  }
  return id;
}
function apiEndpoint(path){return `${window.VAZ_API_BASE||''}${path}`;}
function stravaState(){
  state.strava=state.strava||{connected:false,autoSync:true,athleteName:null,status:'idle',lastImportAt:0};
  return state.strava;
}
async function refreshStravaStatus(){
  const s=stravaState();s.status='loading';
  try{
    const r=await fetch(apiEndpoint(`/api/strava-status?installationId=${encodeURIComponent(getInstallationId())}`),{cache:'no-store'});
    const data=await r.json();
    Object.assign(s,{connected:!!data.connected,autoSync:data.autoSync!==false,athleteName:data.athleteName||null,status:'ready'});
  }catch{Object.assign(s,{status:'error'});}
  save();if(activeView==='profile')render();
  if(s.connected){
    await syncPendingStravaRuns();
    await importStravaActivities({silent:true});
  }
}
async function connectStrava(){
  if(window.VAZ_NATIVE&&window.VazNative?.openStravaAuth){return window.VazNative.openStravaAuth(getInstallationId());}
  location.href=apiEndpoint(`/api/strava-auth?installationId=${encodeURIComponent(getInstallationId())}`);
}
async function syncRunToStrava(session,{silent=false}={}){
  const s=stravaState();
  if(!s.connected||s.autoSync===false||!session)return false;
  if(session.source==='strava'||session.stravaSync==='synced')return true;
  session.stravaSync='syncing';save();
  try{
    const r=await fetch(apiEndpoint('/api/strava-upload'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({installationId:getInstallationId(),session})});
    const data=await r.json();
    if(!r.ok||!data.synced)throw new Error(data.error||'Não foi possível sincronizar.');
    session.stravaSync='synced';session.stravaResult=data.result||null;
    if(data.result?.activity_id)session.stravaActivityId=String(data.result.activity_id);
    save();window.VazCalendar?.reconcile?.();
    if(!silent)toast('✓ Corrida sincronizada automaticamente com o Strava');
    return true;
  }catch(err){
    session.stravaSync='pending';session.stravaError=err.message;save();
    if(!silent)toast('Corrida salva. Strava ficará pendente para nova tentativa.');
    return false;
  }
}
async function syncPendingStravaRuns(){
  const pending=(state.runSessions||[]).filter(r=>r.source!=='strava'&&(r.stravaSync==='pending'||!r.stravaSync)).slice(-5);
  for(const run of pending)await syncRunToStrava(run,{silent:true});
}
async function importStravaActivities({silent=false}={}){
  const s=stravaState();
  if(!s.connected||!window.VazCalendar?.importStravaActivity)return 0;
  try{
    const after=Math.floor(Date.now()/1000)-(120*24*60*60);
    const r=await fetch(apiEndpoint(`/api/strava-activities?installationId=${encodeURIComponent(getInstallationId())}&after=${after}`),{cache:'no-store'});
    const data=await r.json();
    if(!r.ok)throw new Error(data.error||'Falha ao consultar corridas do Strava.');
    let added=0,additional=0,planned=0;
    for(const activity of data.activities||[]){
      const result=window.VazCalendar.importStravaActivity(activity);
      if(result?.added){added++;result.additional?additional++:planned++;}
    }
    s.lastImportAt=Date.now();save();
    if(added){
      if(activeView==='home'||activeView==='progress'||activeView==='profile')render();
      if(!silent)toast(`${added} corrida(s) importada(s) do Strava`);
      else if(planned)toast(`✓ ${planned} treino(s) de corrida confirmado(s) pelo Strava`);
    }
    return added;
  }catch(err){
    s.lastImportError=err.message;save();
    if(!silent)toast('Não consegui atualizar as corridas do Strava agora.');
    return 0;
  }
}

(function installStravaUi(){
  const priorRenderProfile=renderProfile;
  renderProfile=function(){
    const html=priorRenderProfile();const s=stravaState();
    const connected=s.connected;
    const card=`<div class="card integration-card"><div class="card-head"><div><h2>Conexões</h2><p>Sincronize suas atividades com serviços externos</p></div><span class="pill">INTEGRAÇÕES</span></div><div class="integration-row"><div class="integration-logo strava-mark">S</div><div class="integration-copy"><strong>Strava</strong><small>${connected?`Conectado${s.athleteName?` como ${escapeHtml(s.athleteName)}`:''} • sincronização automática ativa`:'Envie e reconheça automaticamente suas corridas'}</small></div>${connected?`<span class="integration-status">✓ Conectado</span>`:`<button class="btn primary" data-strava-connect>Conectar</button>`}</div>${connected?'<p class="integration-note">Ao abrir o Vaz Fitness, corridas recentes do Strava são conciliadas com seu plano. Se houver corrida planejada naquele dia, ela vira treino realizado; se não houver, entra como corrida adicional. Corridas feitas pelo Vaz Fitness continuam sendo enviadas automaticamente ao Strava.</p>':''}</div>`;
    return html.replace(/<\/section>\s*$/,`${card}</section>`);
  };
  const priorBind=bindDynamic;
  bindDynamic=function(){priorBind();document.querySelector('[data-strava-connect]')?.addEventListener('click',connectStrava);};

  if(typeof finishRunSession==='function'){
    const priorFinish=finishRunSession;
    finishRunSession=function(){
      const count=state.runSessions.length;
      priorFinish();
      const session=state.runSessions.at(-1);
      if(session&&state.runSessions.length>count){session.stravaSync='pending';save();setTimeout(()=>syncRunToStrava(session),100);}
    };
  }

  const params=new URLSearchParams(location.search);
  const stravaResult=params.get('strava');
  if(stravaResult){
    history.replaceState({},'',location.pathname);
    setTimeout(()=>toast(stravaResult==='connected'?'Strava conectado com sucesso!':'Não foi possível concluir a conexão com o Strava.'),250);
  }
  const style=document.createElement('style');style.textContent=`.integration-row{display:flex;align-items:center;gap:12px;padding:14px;background:#fafafa;border:1px solid var(--line);border-radius:18px}.integration-logo{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;font-weight:900;font-size:20px}.strava-mark{background:#fc4c02;color:white}.integration-copy{flex:1;min-width:0}.integration-copy strong,.integration-copy small{display:block}.integration-copy small{color:var(--muted);margin-top:4px;line-height:1.4}.integration-status{font-size:11px;font-weight:800;color:var(--good);white-space:nowrap}.integration-note{font-size:11px;color:var(--muted);line-height:1.5;margin:12px 4px 0}@media(max-width:560px){.integration-row{align-items:flex-start;flex-wrap:wrap}.integration-copy{min-width:calc(100% - 62px)}.integration-row .btn,.integration-status{margin-left:58px}}`;
  document.head.appendChild(style);

  document.addEventListener('visibilitychange',()=>{
    const s=stravaState();
    if(document.visibilityState==='visible'&&s.connected&&Date.now()-(s.lastImportAt||0)>60000)importStravaActivities({silent:true});
  });
  refreshStravaStatus();
})();
