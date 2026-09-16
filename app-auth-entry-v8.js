// Vaz Fitness — entrada V8: login primeiro, cadastro guiado apenas para novo usuário.
(function installAuthEntryV8(){
  if(window.__VAZ_AUTH_ENTRY_V8__)return;
  window.__VAZ_AUTH_ENTRY_V8__=true;

  const TOKEN_KEY='vazFitness.authToken';
  const CLOUD_USER_KEY='vazFitness.cloudUser';
  const REG_STAGE_KEY='vazFitness.registrationStage.v8';
  const API_BASE=window.VAZ_API_BASE||'';
  let restoring=false;
  let pendingCreated=null;

  function token(){return localStorage.getItem(TOKEN_KEY)||'';}
  function apiUrl(action){return `${API_BASE}/api/vf?action=${encodeURIComponent(action)}`;}
  async function api(action,{method='GET',body=null,bearer=''}={}){
    const headers={'Content-Type':'application/json'};
    if(bearer)headers.Authorization=`Bearer ${bearer}`;
    const response=await fetch(apiUrl(action),{method,headers,body:body?JSON.stringify(body):undefined});
    const data=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error(data.message||'Não foi possível concluir esta operação.');error.code=data.error||'';error.status=response.status;throw error;}
    return data;
  }
  function registrationStage(){return sessionStorage.getItem(REG_STAGE_KEY)||'';}
  function setRegistrationStage(value){if(value)sessionStorage.setItem(REG_STAGE_KEY,value);else sessionStorage.removeItem(REG_STAGE_KEY);}
  function setGated(on=true){document.body.classList.toggle('vf-account-gated',!!on);}
  function setView(html){setGated(true);const view=document.getElementById('view');if(view)view.innerHTML=html;}
  function closeOnboardingIfOpen(){
    const dialog=document.getElementById('onboardingDialog');
    if(dialog?.open){try{dialog.close();}catch{}}
  }
  function safeStateForCloud(){
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
  function persistState(){
    try{localStorage.setItem(DB_KEY,JSON.stringify(state));}catch{try{save();}catch{}}
  }
  function renderLogin(){
    closeOnboardingIfOpen();
    setView(`<section class="vf-account-gate vf-entry-v8"><div class="vf-gate-card"><div class="vf-gate-brand"><div class="vf-id-logo">VF</div><div><span class="eyebrow">VAZ FITNESS</span><h1>Entre na sua conta.</h1></div></div><p>Já usa o Vaz Fitness? Entre normalmente. Se você reinstalou o aplicativo, não precisa refazer seu cadastro.</p><form id="vfEntryLogin" class="vf-account-form"><label>E-mail<input name="email" type="email" autocomplete="email" required></label><label>Senha<input name="password" type="password" minlength="8" autocomplete="current-password" required></label><button class="btn primary">Entrar</button></form><div class="vf-entry-divider"><span>ou</span></div><button class="btn dark vf-entry-new" id="vfEntryNewUser">Novo usuário</button><small class="vf-entry-helper">Primeiro acesso? Vamos coletar seus dados de treino e, no final, criar sua conta.</small></div></section>`);
    document.getElementById('vfEntryLogin')?.addEventListener('submit',loginExisting);
    document.getElementById('vfEntryNewUser')?.addEventListener('click',startNewUser);
  }
  function renderCreateAccount(){
    const name=String(state?.profile?.name||'').trim();
    setView(`<section class="vf-account-gate vf-entry-v8"><div class="vf-gate-card"><div class="vf-gate-brand"><div class="vf-id-logo">VF</div><div><span class="eyebrow">ÚLTIMA ETAPA</span><h1>Agora crie seu acesso.</h1></div></div><p>Seu perfil de treino está pronto${name?`, ${escapeHtml(name)}`:''}. Informe e-mail e senha para salvar tudo na sua conta e enviar o cadastro para liberação do personal.</p><div class="vf-entry-ready"><span>✓</span><div><strong>Dados do treino preenchidos</strong><small>Objetivo, modalidade, nível, frequência e perfil físico já estão prontos.</small></div></div><form id="vfEntryCreate" class="vf-account-form"><label>E-mail<input name="email" type="email" autocomplete="email" required></label><label>Senha<input name="password" type="password" minlength="8" autocomplete="new-password" required></label><label>Confirmar senha<input name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required></label><button class="btn primary">Criar minha conta</button></form><button class="vf-auth-switch" id="vfEntryBackLogin">Já tenho conta</button></div></section>`);
    document.getElementById('vfEntryCreate')?.addEventListener('submit',createAccount);
    document.getElementById('vfEntryBackLogin')?.addEventListener('click',()=>{setRegistrationStage('');pendingCreated=null;renderLogin();});
  }
  function renderRestoring(){
    closeOnboardingIfOpen();
    setView(`<section class="vf-account-gate"><div class="vf-gate-card checking"><div class="vf-spinner"></div><h2>Recuperando sua conta…</h2><p>Buscando seu perfil, seu treino e o vínculo com o personal.</p></div></section>`);
  }
  async function hydrateAccount(bearer,userHint=null){
    const accessData=await api('athlete_access',{bearer});
    const access=accessData.access||null;
    let remote=null;
    if(access?.status==='approved'){
      try{remote=(await api('cloud_state',{bearer})).state||null;}catch{}
    }
    if(remote&&typeof remote==='object')state={...state,...remote,onboarded:true};
    else state={...state,onboarded:true};
    if(accessData.plan?.plan&&Array.isArray(accessData.plan.plan))state.plan=accessData.plan.plan;
    const user=accessData.user||userHint;
    if(user?.name&&state.profile)state.profile={...state.profile,name:state.profile.name||user.name};
    persistState();
    if(user?.id)localStorage.setItem(CLOUD_USER_KEY,user.id);
    return accessData;
  }
  async function loginExisting(event){
    event.preventDefault();
    const form=event.currentTarget,fd=new FormData(form),button=form.querySelector('button');
    if(button){button.disabled=true;button.textContent='Entrando…';}
    try{
      const data=await api('login',{method:'POST',body:{email:String(fd.get('email')||'').trim(),password:String(fd.get('password')||'')}});
      if(data.user?.role!=='athlete')throw new Error('Esta conta não é uma conta de aluno.');
      try{await hydrateAccount(data.token,data.user);}catch{}
      localStorage.setItem(TOKEN_KEY,data.token);
      if(data.user?.id)localStorage.setItem(CLOUD_USER_KEY,data.user.id);
      setRegistrationStage('');
      location.reload();
    }catch(error){toast(error.message||'Não foi possível entrar.');if(button){button.disabled=false;button.textContent='Entrar';}}
  }
  function resetOnboardingForm(){
    const form=document.getElementById('onboardingForm');
    if(!form)return;
    try{form.reset();}catch{}
    const clearNames=['name','age','weight','height'];
    clearNames.forEach(n=>{const el=form.elements.namedItem(n);if(el)el.value='';});
    const mode=form.querySelector('input[name="mode"][value="hybrid"]');if(mode)mode.checked=true;
    const defaults={days:'4',minutes:'60',location:'gym',easyPace:'5:20',strengthLevel:'intermediate',runningLevel:'intermediate',hybridFocus:'balanced'};
    Object.entries(defaults).forEach(([name,value])=>{const el=form.elements.namedItem(name);if(el)el.value=value;});
    try{if(typeof currentStep!=='undefined')currentStep=1;if(typeof showStep==='function')showStep();}catch{}
  }
  function startNewUser(){
    pendingCreated=null;
    setRegistrationStage('onboarding');
    try{state=defaultState();state.profile={...state.profile,name:''};state.plan=[];state.sessions=[];state.runSessions=[];state.skipped=[];state.onboarded=false;persistState();}catch{}
    localStorage.removeItem(CLOUD_USER_KEY);
    resetOnboardingForm();
    const dialog=document.getElementById('onboardingDialog');
    if(!dialog)return toast('Não foi possível abrir o cadastro agora.');
    if(!dialog.open)dialog.showModal();
  }
  async function createAccount(event){
    event.preventDefault();
    const form=event.currentTarget,fd=new FormData(form),email=String(fd.get('email')||'').trim(),password=String(fd.get('password')||''),confirmPassword=String(fd.get('confirmPassword')||''),button=form.querySelector('button');
    if(password!==confirmPassword){toast('As senhas não conferem.');return;}
    if(button){button.disabled=true;button.textContent='Criando conta…';}
    try{
      if(!pendingCreated){
        const created=await api('register',{method:'POST',body:{role:'athlete',name:String(state.profile?.name||'').trim(),email,password}});
        if(created.user?.role!=='athlete')throw new Error('Não foi possível criar a conta de aluno.');
        pendingCreated={token:created.token,user:created.user};
      }
      await api('submit_profile',{method:'POST',bearer:pendingCreated.token,body:{state:safeStateForCloud(),plan:Array.isArray(state.plan)?state.plan:[]}});
      localStorage.setItem(TOKEN_KEY,pendingCreated.token);
      if(pendingCreated.user?.id)localStorage.setItem(CLOUD_USER_KEY,pendingCreated.user.id);
      state.onboarded=true;persistState();setRegistrationStage('');
      location.reload();
    }catch(error){toast(error.message||'Não foi possível finalizar o cadastro.');if(button){button.disabled=false;button.textContent=pendingCreated?'Tentar finalizar cadastro':'Criar minha conta';}}
  }
  async function restoreAfterReinstall(){
    if(restoring)return;restoring=true;renderRestoring();
    try{await hydrateAccount(token());location.reload();}
    catch(error){
      if(error.status===401){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(CLOUD_USER_KEY);restoring=false;renderLogin();return;}
      restoring=false;toast('Não foi possível recuperar seus dados agora.');renderRestoring();
    }
  }

  const previousRender=render;
  render=function(){
    if(!token()){
      const stage=registrationStage();
      if(stage==='onboarding'&&state?.onboarded){setRegistrationStage('account');return renderCreateAccount();}
      if(stage==='account')return renderCreateAccount();
      // Background renders must not dismiss an assessment explicitly opened by the user.
      if(stage==='onboarding'&&document.getElementById('onboardingDialog')?.open)return;
      setRegistrationStage('');
      return renderLogin();
    }
    if(!state?.onboarded){restoreAfterReinstall();return;}
    setGated(false);return previousRender();
  };

  const style=document.createElement('style');
  style.textContent=`
    .vf-entry-v8 .vf-entry-divider{display:flex;align-items:center;gap:12px;margin:16px 0;color:var(--muted);font-size:11px;font-weight:800}.vf-entry-v8 .vf-entry-divider:before,.vf-entry-v8 .vf-entry-divider:after{content:"";height:1px;background:var(--line);flex:1}.vf-entry-v8 .vf-entry-new{width:100%}.vf-entry-v8 .vf-entry-helper{display:block;text-align:center;color:var(--muted);line-height:1.5;margin-top:10px}.vf-entry-ready{display:flex;gap:11px;align-items:center;background:#f7fbef;border:1px solid #dfe8c9;border-radius:18px;padding:13px 14px;margin:16px 0}.vf-entry-ready>span{width:34px;height:34px;border-radius:12px;background:#e7f5c6;display:grid;place-items:center;font-weight:950}.vf-entry-ready strong,.vf-entry-ready small{display:block}.vf-entry-ready small{color:var(--muted);margin-top:3px;line-height:1.4}@media(max-width:560px){.vf-entry-v8 .vf-gate-card{padding:22px 18px}.vf-entry-v8 .vf-gate-card h1{font-size:36px}}
  `;
  document.head.appendChild(style);

  const onboarding=document.getElementById('onboardingDialog');
  onboarding?.addEventListener('cancel',()=>{if(registrationStage()==='onboarding'&&!state?.onboarded){setRegistrationStage('');queueMicrotask(()=>render());}});
  queueMicrotask(()=>{try{render()}catch{}});
})();
