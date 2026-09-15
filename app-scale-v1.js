// Vaz Fitness — camada de escala: autenticação das integrações, sync incremental e proteção de chamadas caras.
(()=>{
  const TOKEN_KEY='vazFitness.authToken';
  const STRAVA_SYNC_MIN_MS=15*60*1000;
  const STRAVA_STATUS_TTL_MS=6*60*60*1000;
  let aionBusy=false;
  let stravaBusy=false;

  function authToken(){return localStorage.getItem(TOKEN_KEY)||''}
  function authHeaders(extra={}){const token=authToken();return {...extra,...(token?{Authorization:`Bearer ${token}`}:{})}}
  function endpoint(path){return `${window.VAZ_API_BASE||''}${path}`}
  function localAion(text){try{return typeof aionRespond==='function'?aionRespond(text):'AION está em modo local agora.'}catch{return 'AION está em modo local agora.'}}

  if(typeof sendChat==='function'){
    sendChat=async function(text){
      if(aionBusy){toast?.('A AION já está analisando sua mensagem.');return}
      state.chat.push({role:'user',text});
      state.chat.push({role:'ai',text:'AION está analisando seu contexto…',pending:true});
      save();if(activeView!=='aion')activeView='aion';render();
      if(!authToken()){
        state.chat[state.chat.length-1]={role:'ai',text:`${localAion(text)}\n\nModo local ativo: entre na sua conta para usar a análise em nuvem.`};save();render();return;
      }
      aionBusy=true;
      try{
        const context=typeof buildAionContext==='function'?buildAionContext():{};
        const response=await fetch(endpoint('/api/aion'),{method:'POST',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({message:String(text).slice(0,1500),context})});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.error==='aion_rate_limited'||response.status===429?'AION ocupada por alguns instantes.':data.error||'AION externa indisponível');
        state.chat[state.chat.length-1]={role:'ai',text:data.message||localAion(text)};
      }catch(err){
        state.chat[state.chat.length-1]={role:'ai',text:`${localAion(text)}\n\nModo local ativo: ${err.message||'não consegui acessar o Gemini agora.'}`};
      }finally{
        aionBusy=false;save();render();setTimeout(()=>{const m=document.getElementById('messages');if(m)m.scrollTop=m.scrollHeight},30);
      }
    };
  }

  if(typeof refreshStravaStatus==='function'){
    refreshStravaStatus=async function({force=false}={}){
      const s=stravaState();
      if(!authToken())return false;
      if(!force&&s.lastStatusAt&&Date.now()-s.lastStatusAt<STRAVA_STATUS_TTL_MS&&s.status==='ready'){
        if(s.connected)await importStravaActivities({silent:true});
        return s.connected;
      }
      s.status='loading';
      try{
        const r=await fetch(endpoint(`/api/strava-status?installationId=${encodeURIComponent(getInstallationId())}`),{cache:'no-store',headers:authHeaders()});
        const data=await r.json().catch(()=>({}));
        if(r.status===401){Object.assign(s,{connected:false,status:'ready',lastStatusAt:Date.now()});save();return false}
        if(!r.ok)throw new Error(data.error||'Falha ao consultar Strava.');
        Object.assign(s,{connected:!!data.connected,autoSync:data.autoSync!==false,athleteName:data.athleteName||null,status:'ready',lastStatusAt:Date.now()});
      }catch{Object.assign(s,{status:'error'});}
      save();if(activeView==='profile')render();
      if(s.connected){await syncPendingStravaRuns();await importStravaActivities({silent:true});}
      return s.connected;
    };
  }

  if(typeof connectStrava==='function'){
    connectStrava=async function(){
      const token=authToken();if(!token){toast?.('Entre na sua conta antes de conectar o Strava.');return}
      try{
        const native=window.VAZ_NATIVE?'1':'0';
        const r=await fetch(endpoint(`/api/vf?action=strava_oauth_url&installationId=${encodeURIComponent(getInstallationId())}&native=${native}`),{headers:authHeaders({'Content-Type':'application/json'})});
        const data=await r.json().catch(()=>({}));if(!r.ok||!data.url)throw new Error(data.message||'Não foi possível iniciar a conexão com o Strava.');
        if(window.VAZ_NATIVE&&window.VazNative?.openExternal)await window.VazNative.openExternal(data.url);else location.href=data.url;
      }catch(err){toast?.(err.message||'Não foi possível conectar o Strava.');}
    };
  }

  if(typeof syncRunToStrava==='function'){
    syncRunToStrava=async function(session,{silent=false}={}){
      const s=stravaState();
      if(!s.connected||s.autoSync===false||!session)return false;
      if(session.source==='strava'||session.stravaSync==='synced')return true;
      if(!authToken())return false;
      session.stravaSync='syncing';save();
      try{
        const r=await fetch(endpoint('/api/strava-upload'),{method:'POST',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({installationId:getInstallationId(),session})});
        const data=await r.json().catch(()=>({}));
        if(!r.ok||!data.synced)throw new Error(data.error||'Não foi possível sincronizar.');
        session.stravaSync='synced';session.stravaResult=data.result||null;
        if(data.result?.activity_id)session.stravaActivityId=String(data.result.activity_id);
        save();window.VazCalendar?.reconcile?.();if(!silent)toast?.('✓ Corrida sincronizada automaticamente com o Strava');return true;
      }catch(err){
        session.stravaSync='pending';session.stravaError=err.message;save();if(!silent)toast?.('Corrida salva. Strava ficará pendente para nova tentativa.');return false;
      }
    };
  }

  if(typeof importStravaActivities==='function'){
    importStravaActivities=async function({silent=false,force=false}={}){
      const s=stravaState();
      if(!s.connected||!window.VazCalendar?.importStravaActivity||!authToken()||stravaBusy)return 0;
      if(!force&&silent&&s.lastImportAt&&Date.now()-s.lastImportAt<STRAVA_SYNC_MIN_MS)return 0;
      stravaBusy=true;
      try{
        const nowSec=Math.floor(Date.now()/1000);
        const after=s.lastImportAt?Math.max(0,Math.floor(s.lastImportAt/1000)-(6*60*60)):nowSec-(30*24*60*60);
        const r=await fetch(endpoint(`/api/strava-activities?installationId=${encodeURIComponent(getInstallationId())}&after=${after}`),{cache:'no-store',headers:authHeaders()});
        const data=await r.json().catch(()=>({}));
        if(r.status===429){s.lastImportError='rate_limited';save();return 0}
        if(!r.ok)throw new Error(data.error||'Falha ao consultar corridas do Strava.');
        let added=0,additional=0,planned=0;
        for(const activity of data.activities||[]){const result=window.VazCalendar.importStravaActivity(activity);if(result?.added){added++;result.additional?additional++:planned++;}}
        s.lastImportAt=Date.now();s.lastImportError=null;s.stravaRate=data.rate||s.stravaRate||null;save();
        if(added){if(['home','progress','profile'].includes(activeView))render();if(!silent)toast?.(`${added} corrida(s) importada(s) do Strava`);else if(planned)toast?.(`✓ ${planned} treino(s) de corrida confirmado(s) pelo Strava`);}
        return added;
      }catch(err){s.lastImportError=err.message;save();if(!silent)toast?.('Não consegui atualizar as corridas do Strava agora.');return 0}
      finally{stravaBusy=false}
    };
  }

  setTimeout(()=>{try{if(authToken()&&typeof refreshStravaStatus==='function')refreshStravaStatus({force:true})}catch{}},300);
})();
