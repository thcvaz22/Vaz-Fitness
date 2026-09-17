// Vaz Fitness — conta do aluno, ID público, aprovação do personal e sincronização em nuvem.
(function installMembership(){
  const TOKEN_KEY='vazFitness.authToken';
  const CLOUD_USER_KEY='vazFitness.cloudUser';
  const API_BASE=window.VAZ_API_BASE||'';
  let authToken=localStorage.getItem(TOKEN_KEY)||'';
  let account={user:null,access:null,status:authToken?'checking':'guest',planVersion:0,lastCheck:0};
  let authMode='login',cloudTimer=null,pulling=false;

  function vfApiUrl(action){return `${API_BASE}/api/vf?action=${encodeURIComponent(action)}`;}
  async function vfApi(action,{method='GET',body=null}={}){
    const headers={'Content-Type':'application/json'};if(authToken)headers.Authorization=`Bearer ${authToken}`;
    const r=await fetch(vfApiUrl(action),{method,headers,body:body?JSON.stringify(body):undefined});
    const data=await r.json().catch(()=>({}));
    if(!r.ok){const err=new Error(data.message||'Não foi possível acessar sua conta.');err.code=data.error||'';err.status=r.status;throw err}
    return data;
  }
  function tail(list,max){return Array.isArray(list)?list.slice(-max):[]}
  function sanitizeStateForCloud(){
    const copy=JSON.parse(JSON.stringify(state));
    delete copy.chat;delete copy.current;delete copy.currentRun;
    copy.sessions=tail(copy.sessions,220);
    copy.runSessions=tail(copy.runSessions,180).map(r=>{const x={...r};delete x.route;return x;});
    copy.calendarEvents=tail(copy.calendarEvents,730);
    copy.bodyMeasurements=tail(copy.bodyMeasurements,120);
    copy.readinessCheckins=tail(copy.readinessCheckins,120);
    copy.skipped=tail(copy.skipped,180);
    // Segunda compactação defensiva: o histórico local continua completo, mas o snapshot de nuvem
    // precisa permanecer pequeno para que centenas de atletas não façam o banco crescer sem limite.
    try{
      if(new Blob([JSON.stringify(copy)]).size>750000){
        copy.sessions=tail(copy.sessions,140);
        copy.runSessions=tail(copy.runSessions,120);
        copy.calendarEvents=tail(copy.calendarEvents,420);
        copy.bodyMeasurements=tail(copy.bodyMeasurements,80);
        copy.readinessCheckins=tail(copy.readinessCheckins,80);
        copy.skipped=tail(copy.skipped,120);
      }
    }catch{}
    return copy;
  }
  function applyCloudState(remote){
    if(!remote||typeof remote!=='object')return;
    const preserveChat=state.chat;
    state={...state,...remote,onboarded:true,chat:preserveChat};
  }
  function publicCode(){return account.user?.publicCode||account.user?.public_code||'—';}
  function gateStatus(){if(!state.onboarded)return 'none';if(!authToken)return 'auth';return account.status;}
  function gateNeeded(){return ['auth','checking','pending','suspended','error'].includes(gateStatus());}
  function setGateBody(on){document.body.classList.toggle('vf-account-gated',!!on);}

  function renderAuthGate(){
    const create=authMode==='register';
    setGateBody(true);
    document.getElementById('view').innerHTML=`<section class="vf-account-gate"><div class="vf-gate-card"><div class="vf-gate-brand"><div class="vf-id-logo">VF</div><div><span class="eyebrow">VAZ FITNESS</span><h1>${create?'Crie sua conta de aluno.':'Entre na sua conta.'}</h1></div></div><p>${create?'Seu cadastro ficará vinculado ao seu personal e será sincronizado com segurança entre seus dispositivos.':'Use a conta que você já cadastrou no Vaz Fitness.'}</p><form id="vfAccountForm" class="vf-account-form">${create?`<label>Nome<input name="name" value="${escapeHtml(state.profile?.name||'')}" required maxlength="80"></label>`:''}<label>E-mail<input name="email" type="email" required autocomplete="email"></label><label>Senha<input name="password" type="password" required minlength="8" autocomplete="${create?'new-password':'current-password'}"></label><button class="btn primary">${create?'Criar minha conta':'Entrar'}</button></form><button class="vf-auth-switch" id="vfAuthSwitch">${create?'Já tenho conta':'Criar uma nova conta'}</button></div></section>`;
    document.getElementById('vfAuthSwitch').onclick=()=>{authMode=create?'login':'register';render();};
    document.getElementById('vfAccountForm').onsubmit=submitAccount;
  }
  async function submitAccount(e){
    e.preventDefault();const fd=new FormData(e.currentTarget),button=e.currentTarget.querySelector('button');button.disabled=true;button.textContent='Aguarde…';
    try{
      const data=await vfApi(authMode==='register'?'register':'login',{method:'POST',body:authMode==='register'?{role:'athlete',name:fd.get('name'),email:fd.get('email'),password:fd.get('password')}:{email:fd.get('email'),password:fd.get('password')}});
      if(!['athlete','personal'].includes(data.user?.role))throw new Error('Esta conta não possui acesso ao Vaz Fitness.');
      authToken=data.token;localStorage.setItem(TOKEN_KEY,authToken);account.user=data.user;account.access=data.access||null;account.status='checking';
      if(authMode==='register')await submitProfileForApproval();
      await checkAccess(true);
    }catch(err){toast(err.message||'Não foi possível criar sua conta.');render();}
  }
  async function submitProfileForApproval(){
    const payload=sanitizeStateForCloud();
    const data=await vfApi('submit_profile',{method:'POST',body:{state:payload,plan:state.plan||[]}});
    account.access=data.access;account.status=data.access?.status||'pending';
    if(account.user)account.user.publicCode=data.publicCode||account.user.publicCode;
    localStorage.setItem(CLOUD_USER_KEY,account.user?.id||'');
  }
  function renderPendingGate(){
    setGateBody(true);const linked=account.access?.personal_name;
    document.getElementById('view').innerHTML=`<section class="vf-account-gate"><div class="vf-gate-card pending"><span class="eyebrow">CADASTRO CONCLUÍDO</span><h1>Seu código ID está pronto.</h1><p>Seu treino precisa ser avaliado e liberado pelo seu personal antes do primeiro acesso.</p><div class="vf-public-code"><small>SEU CÓDIGO ID</small><strong>${escapeHtml(publicCode())}</strong><button class="btn ghost" id="copyVfCode">Copiar código</button></div><div class="vf-send-message"><strong>Mande o código ID para seu personal para liberar o seu treino.</strong>${linked?`<span>Vinculado a ${escapeHtml(linked)} • aguardando liberação.</span>`:'<span>Depois que o personal adicionar seu ID no Vaz Personal, ele poderá revisar seu plano.</span>'}</div><button class="btn primary" id="refreshVfAccess">Verificar liberação</button><button class="vf-auth-switch" id="logoutVfAccount">Entrar com outra conta</button></div></section>`;
    document.getElementById('copyVfCode').onclick=async()=>{try{await navigator.clipboard.writeText(publicCode());toast('Código ID copiado.')}catch{toast(publicCode())}};
    document.getElementById('refreshVfAccess').onclick=()=>checkAccess(true);
    document.getElementById('logoutVfAccount').onclick=logoutAccount;
  }
  function renderSuspendedGate(){
    setGateBody(true);
    document.getElementById('view').innerHTML=`<section class="vf-account-gate"><div class="vf-gate-card suspended"><div class="vf-lock">!</div><span class="eyebrow">ACESSO INDISPONÍVEL</span><h1>Não foi possível entrar</h1><p class="vf-contact-personal">Contate seu personal.</p><button class="btn ghost" id="refreshVfAccess">Tentar novamente</button><button class="vf-auth-switch" id="logoutVfAccount">Sair da conta</button></div></section>`;
    document.getElementById('refreshVfAccess').onclick=()=>checkAccess(true);document.getElementById('logoutVfAccount').onclick=logoutAccount;
  }
  function renderCheckingGate(message='Verificando sua liberação…'){
    setGateBody(true);document.getElementById('view').innerHTML=`<section class="vf-account-gate"><div class="vf-gate-card checking"><div class="vf-spinner"></div><h2>${escapeHtml(message)}</h2><p>Sincronizando seu perfil e o plano do personal.</p></div></section>`;
  }
  function renderErrorGate(){
    setGateBody(true);document.getElementById('view').innerHTML=`<section class="vf-account-gate"><div class="vf-gate-card suspended"><span class="eyebrow">VAZ FITNESS</span><h1>Não foi possível entrar</h1><p class="vf-contact-personal">Contate seu personal.</p><button class="btn ghost" id="refreshVfAccess">Tentar novamente</button></div></section>`;document.getElementById('refreshVfAccess').onclick=()=>checkAccess(true);
  }
  function logoutAccount(){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(CLOUD_USER_KEY);authToken='';account={user:null,access:null,status:'guest',planVersion:0,lastCheck:0};authMode='login';render();}

  async function pullCloudOnce(){
    if(pulling||!authToken||account.status!=='approved')return;pulling=true;
    try{
      const cloud=await vfApi('cloud_state');
      const key=localStorage.getItem(CLOUD_USER_KEY);
      if(key!==account.user?.id||!(state.sessions?.length||state.runSessions?.length)){
        applyCloudState(cloud.state||{});localStorage.setItem(CLOUD_USER_KEY,account.user?.id||'');
      }
    }catch{}finally{pulling=false}
  }
  async function checkAccess(showLoader=false){
    if(!authToken||!state.onboarded)return false;
    if(showLoader){account.status='checking';render();}
    try{
      const data=await vfApi('athlete_access');account.user=data.user;account.access=data.access;account.lastCheck=Date.now();
      account.status=data.access?.status||'pending';
      if(account.status==='approved'){
        if(data.plan?.plan&&Array.isArray(data.plan.plan)){
          const incoming=Number(data.plan.plan_version)||0;
          if(incoming>=account.planVersion){state.plan=data.plan.plan;account.planVersion=incoming;}
        }
        await pullCloudOnce();
        baseSave();setGateBody(false);baseRender();
        return true;
      }
      render();return false;
    }catch(err){
      if(err.status===401){logoutAccount();return false;}
      if(err.code==='suspended'){account.status='suspended';render();return false;}
      account.status='error';render();return false;
    }
  }
  async function ensureApproved(){
    if(account.status==='approved'&&Date.now()-account.lastCheck<60000)return true;
    return checkAccess(false);
  }
  function scheduleCloudPush(){
    if(account.status!=='approved'||!authToken)return;clearTimeout(cloudTimer);cloudTimer=setTimeout(async()=>{try{await vfApi('cloud_state',{method:'POST',body:{state:sanitizeStateForCloud()}})}catch(err){if(err.code==='suspended'){account.status='suspended';render();}}},7000);
  }

  const baseRender=render;
  render=function(){
    const gate=gateStatus();
    if(gate==='none'){setGateBody(false);baseRender();return;}
    if(gate==='auth'){renderAuthGate();return;}
    if(gate==='checking'){renderCheckingGate();return;}
    if(gate==='pending'){renderPendingGate();return;}
    if(gate==='suspended'){renderSuspendedGate();return;}
    if(gate==='error'){renderErrorGate();return;}
    setGateBody(false);baseRender();
  };
  const baseSave=save;
  save=function(){baseSave();scheduleCloudPush();};
  const baseStartItem=startItem;
  startItem=async function(id){if(await ensureApproved())baseStartItem(id);};
  if(typeof startRun==='function'){
    const baseStartRun=startRun;
    startRun=async function(item){if(await ensureApproved())baseStartRun(item);};
  }

  const baseRenderProfile=renderProfile;
  renderProfile=function(){
    const html=baseRenderProfile();
    if(account.status!=='approved')return html;
    const personalName=account.user?.role==='personal'?'Você mesmo':account.access?.personal_name||'Vinculado';
    const card=`<div class="card"><div class="card-head"><div><h2>Conta e acompanhamento</h2><p>Vínculo com o Vaz Personal</p></div><span class="pill">SINCRONIZADO</span></div><div class="detail-list"><div class="detail-row"><span>Código ID</span><strong>${escapeHtml(publicCode())}</strong></div><div class="detail-row"><span>Personal</span><strong>${escapeHtml(personalName)}</strong></div><div class="detail-row"><span>Status</span><strong>Liberado</strong></div></div><div class="hero-actions"><button class="btn ghost" data-vf-sync>Sincronizar agora</button><button class="btn danger-soft" data-vf-logout>Sair da conta</button></div></div>`;
    return html.replace(/<\/section>\s*$/,`${card}</section>`);
  };
  const baseBindDynamic=bindDynamic;
  bindDynamic=function(){baseBindDynamic();document.querySelector('[data-vf-sync]')?.addEventListener('click',()=>checkAccess(true));document.querySelector('[data-vf-logout]')?.addEventListener('click',logoutAccount);};

  const style=document.createElement('style');style.textContent=`
    body.vf-account-gated .bottom-nav{display:none!important}.vf-account-gate{min-height:calc(100dvh - 110px);display:grid;place-items:center;padding:20px}.vf-gate-card{width:min(580px,100%);background:#fff;border:1px solid var(--line);border-radius:30px;padding:26px;box-shadow:0 28px 70px rgba(0,0,0,.12);text-align:left}.vf-gate-card h1{font-size:clamp(32px,7vw,52px);line-height:1.02;margin:9px 0 12px}.vf-gate-card>p{color:var(--muted);line-height:1.55}.vf-gate-brand{display:flex;align-items:flex-start;gap:13px}.vf-id-logo{width:48px;height:48px;border-radius:16px;background:var(--yellow);display:grid;place-items:center;font-weight:950}.vf-account-form{display:flex;flex-direction:column;gap:11px;margin-top:18px}.vf-account-form label{font-size:11px;font-weight:800}.vf-account-form input{width:100%;margin-top:5px;border:1px solid var(--line);border-radius:14px;padding:13px;font-size:16px}.vf-auth-switch{display:block;margin:14px auto 0;border:0;background:transparent;color:#766000;font-weight:850}.vf-public-code{border:2px solid var(--yellow);background:#fffbea;border-radius:22px;padding:18px;text-align:center;margin:20px 0}.vf-public-code small,.vf-public-code strong{display:block}.vf-public-code strong{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:clamp(22px,6vw,34px);letter-spacing:.06em;margin:7px 0 13px}.vf-send-message{background:#f7f7f7;border:1px solid var(--line);border-radius:18px;padding:15px;margin-bottom:16px}.vf-send-message strong,.vf-send-message span{display:block}.vf-send-message span{color:var(--muted);font-size:11px;line-height:1.5;margin-top:5px}.vf-lock{width:62px;height:62px;border-radius:20px;background:#ffebe9;color:#a82c26;font-size:34px;font-weight:950;display:grid;place-items:center;margin-bottom:16px}.vf-gate-card.suspended{text-align:center}.vf-contact-personal{font-size:20px!important;color:#333!important;font-weight:800}.vf-spinner{width:44px;height:44px;border:5px solid #eee;border-top-color:var(--yellow);border-radius:50%;animation:vfspin .8s linear infinite;margin:0 auto 18px}.vf-gate-card.checking{text-align:center}@keyframes vfspin{to{transform:rotate(360deg)}}
  `;document.head.appendChild(style);

  if(state.onboarded){
    if(authToken){account.status='checking';setTimeout(()=>checkAccess(false),50);}else{account.status='guest';setTimeout(()=>render(),0);}
  }
  setInterval(()=>{if(authToken&&state.onboarded)checkAccess(false);},300000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&authToken&&state.onboarded&&Date.now()-account.lastCheck>60000)checkAccess(false);});
})();
