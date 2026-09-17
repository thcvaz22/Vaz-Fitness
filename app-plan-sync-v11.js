// Vaz Fitness v11 — sincronização segura do plano liberado e do status da solicitação.
(()=>{
  const TOKEN_KEY='vazFitness.authToken';
  const API_BASE=window.VAZ_API_BASE||'';
  let syncing=false,restSyncTimer=null;

  const token=()=>localStorage.getItem(TOKEN_KEY)||'';
  const apiUrl=action=>`${API_BASE}/api/vf?action=${encodeURIComponent(action)}`;
  async function api(action,{method='GET',body=null}={}){
    const bearer=token();
    if(!bearer)throw new Error('Sessão não encontrada.');
    const response=await fetch(apiUrl(action),{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${bearer}`},body:body?JSON.stringify(body):undefined});
    const data=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error(data.message||'Falha ao sincronizar dados.');error.status=response.status;error.code=data.error||'';throw error;}
    return data;
  }
  function safeCloudState(){
    const copy=JSON.parse(JSON.stringify(state||{}));
    delete copy.chat;delete copy.current;delete copy.currentRun;
    if(Array.isArray(copy.sessions))copy.sessions=copy.sessions.slice(-220);
    if(Array.isArray(copy.runSessions))copy.runSessions=copy.runSessions.slice(-180).map(r=>{const x={...r};delete x.route;return x;});
    if(Array.isArray(copy.calendarEvents))copy.calendarEvents=copy.calendarEvents.slice(-730);
    if(Array.isArray(copy.bodyMeasurements))copy.bodyMeasurements=copy.bodyMeasurements.slice(-120);
    if(Array.isArray(copy.readinessCheckins))copy.readinessCheckins=copy.readinessCheckins.slice(-120);
    if(Array.isArray(copy.skipped))copy.skipped=copy.skipped.slice(-180);
    return copy;
  }
  function persist(){try{save()}catch{try{localStorage.setItem('vazFitness.v1',JSON.stringify(state))}catch{}}}
  function normalizeRequest(row){
    if(!row)return null;
    return {id:row.id,reason:row.reason||'',restDays:Array.isArray(row.rest_days)?row.rest_days:(row.restDays||[]),status:row.status||'pending',createdAt:row.created_at||row.createdAt||null,reviewedAt:row.reviewed_at||null,completedAt:row.completed_at||null};
  }
  async function syncFromServer({notify=false}={}){
    if(syncing||!token())return;
    syncing=true;
    try{
      const [accessData,requestData]=await Promise.all([api('athlete_access'),api('plan_change_request').catch(()=>({request:null}))]);
      let changed=false,planChanged=false;
      const serverPlan=accessData?.plan;
      if(accessData?.access?.status==='approved'&&Array.isArray(serverPlan?.plan)){
        const serverVersion=Number(serverPlan.plan_version)||0,localVersion=Number(state.cloudPlanVersion)||0;
        if(!localVersion||serverVersion>localVersion){
          state.plan=serverPlan.plan;
          state.cloudPlanVersion=serverVersion;
          state.cloudPlanUpdatedAt=serverPlan.updated_at||new Date().toISOString();
          changed=true;planChanged=true;
        }
      }
      const incoming=normalizeRequest(requestData?.request),previous=state.planChangeRequest||null;
      if(incoming){
        const different=!previous||previous.id!==incoming.id||previous.status!==incoming.status||JSON.stringify(previous.restDays||[])!==JSON.stringify(incoming.restDays||[]);
        if(different){state.planChangeRequest=incoming;changed=true;}
      }
      if(changed){
        persist();
        try{render()}catch{}
        if(notify){
          const prevStatus=previous?.status;
          const nextStatus=incoming?.status;
          if(planChanged&&nextStatus==='completed'&&['pending','reviewing'].includes(prevStatus))toast('Seu novo treino foi liberado pelo personal e já está atualizado.');
          else if(nextStatus==='rejected'&&['pending','reviewing'].includes(prevStatus))toast('Sua solicitação foi encerrada. Seu treino atual foi mantido.');
          else if(planChanged)toast('Seu treino foi atualizado pelo personal.');
        }
      }
    }catch(error){
      if(error.status===401)return;
    }finally{syncing=false;}
  }
  async function syncRestDays(){
    if(!token())return;
    try{await api('cloud_state',{method:'POST',body:{state:safeCloudState()}})}catch(error){if(![401,423].includes(Number(error.status)))console.warn('Vaz Fitness: não foi possível sincronizar dias de descanso.',error)}
  }

  // Corrige o botão criado no v10: o seletor do submit depende do atributo explícito type="submit".
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('.vf-request-dialog form button.btn.primary');
    if(button&&!button.hasAttribute('type'))button.setAttribute('type','submit');
  },true);

  // Mudanças de descanso feitas no Perfil passam a chegar ao personal sem depender de novo login.
  document.addEventListener('change',event=>{
    if(!event.target?.matches?.('[data-rest-day]'))return;
    clearTimeout(restSyncTimer);
    restSyncTimer=setTimeout(syncRestDays,450);
  },true);

  window.addEventListener('focus',()=>syncFromServer({notify:true}));
  window.addEventListener('online',()=>syncFromServer({notify:true}));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncFromServer({notify:true})});
  setInterval(()=>{if(document.visibilityState==='visible')syncFromServer({notify:true})},60000);
  setTimeout(()=>syncFromServer({notify:false}),1200);
})();
