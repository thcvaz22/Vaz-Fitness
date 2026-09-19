// Vaz Fitness v10 — solicitação segura de novo treino, descansos na aba Treinos e sessões extras.
(()=>{
  const TOKEN_KEY='vazFitness.authToken';
  const dayNames=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const selectedRestDays=()=>[...new Set((state.profile.restDays||[]).map(Number).filter(d=>Number.isInteger(d)&&d>=0&&d<=6))].slice(0,5).sort((a,b)=>a-b);
  const trainingDays=()=>Math.max(2,Math.min(6,Number(state.profile.days)||4));
  const maxRestDays=()=>7-trainingDays();
  const isRestDayToday=()=>selectedRestDays().includes(new Date().getDay());
  function applyPlanDayOverrides(){
    const map=state.planDayOverrides&&typeof state.planDayOverrides==='object'?state.planDayOverrides:{},ids=new Set((state.plan||[]).map(x=>String(x.id)));
    Object.keys(map).forEach(id=>{if(!ids.has(String(id)))delete map[id]});
    (state.plan||[]).forEach(item=>{const day=Number(map[item.id]);if(Number.isInteger(day)&&day>=0&&day<=6&&Number(item.day)!==day){item.day=day;delete item.scheduledDate}});
    state.planDayOverrides=map;
  }
  const api=async(action,{method='GET',body=null}={})=>{
    const token=localStorage.getItem(TOKEN_KEY)||'';if(!token)throw new Error('Entre na sua conta para enviar a solicitação.');
    const r=await fetch(`${window.VAZ_API_BASE||''}/api/vf?action=${encodeURIComponent(action)}`,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:body?JSON.stringify(body):undefined});
    const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||'Não foi possível enviar a solicitação.');return d;
  };
  function restOptions(values=selectedRestDays()){
    return dayNames.map((name,day)=>`<label><input type="checkbox" name="requestRestDays" value="${day}" ${values.includes(day)?'checked':''}><span>${name.slice(0,3)}</span></label>`).join('');
  }
  function restTrainingCard(){
    const days=selectedRestDays(),todayRest=isRestDayToday();
    return `<div class="card vf-rest-card vf-training-rest-card"><div class="card-head"><div><h2>Dias de descanso</h2><p>Defina sua semana sem alterar os exercícios do plano.</p></div><span class="pill">${days.length} selecionado(s)</span></div>
      <div class="vf-rest-profile">${dayNames.map((name,day)=>`<label><input type="checkbox" data-rest-day value="${day}" ${days.includes(day)?'checked':''}><span>${name.slice(0,3)}</span></label>`).join('')}</div>
      <div class="vf-rest-card-foot"><small>Com ${trainingDays()} dias de treino, escolha até ${maxRestDays()} dia(s) de descanso. Depois, use “Remanejar treinos” para redistribuir somente os dias.</small>
      <button type="button" class="btn ghost" data-remap-workouts>↔ Remanejar treinos</button></div>
      ${todayRest?`<div class="vf-rest-today"><div><strong>Hoje é um dia de descanso planejado.</strong><span>Se quiser treinar, escolha um treino do seu plano. A sessão será registrada como treino extra e o treino original continuará no planejamento.</span></div><button type="button" class="btn primary" data-extra-workout-open>+ Selecionar treino extra</button></div>`:''}
    </div>`;
  }
  function requestStatusCard(){
    const r=state.planChangeRequest;if(!r||!['pending','reviewing'].includes(r.status))return '';
    return `<div class="card vf-plan-request-status"><div><span class="eyebrow">SOLICITAÇÃO ENVIADA</span><h2>Seu treino atual continua ativo.</h2><p>O personal recebeu o motivo da mudança e seus dias de descanso. O plano só será alterado depois que ele revisar e liberar a nova versão.</p></div><span class="pill">${r.status==='reviewing'?'EM ANÁLISE':'AGUARDANDO'}</span></div>`;
  }

  const baseProfile=renderProfile;
  renderProfile=function(){
    let html=baseProfile();
    html=html.replace(/<button class="btn dark" data-regenerate>[^<]*<\/button>/,'<button class="btn dark" data-request-plan>Gerar novo treino</button>');
    html=html.replace(/<button class="btn danger-soft" data-reset>[^<]*<\/button>/,'');
    return `${requestStatusCard()}${html}`;
  };

  const baseWorkout=renderWorkout;
  renderWorkout=function(){
    const html=baseWorkout();
    const card=restTrainingCard();
    const firstEnd=html.indexOf('</section>');
    return firstEnd>=0?html.slice(0,firstEnd+10)+card+html.slice(firstEnd+10):card+html;
  };

  function openRequestDialog(){
    const d=document.createElement('dialog');d.className='dialog vf-request-dialog';d.innerHTML=`<form data-plan-request-form><div class="vf-request-head"><div><span class="eyebrow">NOVO TREINO</span><h2>Solicitar mudança de plano</h2><p>Seu treino atual não será alterado agora. A solicitação será enviada para o personal revisar.</p></div><button type="button" class="training-detail-close" data-close>✕</button></div><label>Por que você quer um novo treino?<textarea name="reason" rows="4" minlength="8" maxlength="500" required placeholder="Ex.: mudei meus horários, quero trocar o objetivo, senti dificuldade em alguns exercícios…"></textarea></label><fieldset class="vf-request-rest"><legend>Dias de descanso</legend><div>${restOptions()}</div><small>Para ${trainingDays()} dias de treino, escolha no máximo ${maxRestDays()} dia(s).</small></fieldset><label class="check-row vf-confirm-request"><input type="checkbox" name="confirmed" required><span>Tenho certeza de que quero enviar esta solicitação ao meu personal.</span></label><div class="dialog-actions"><button type="button" class="btn ghost" data-close>Cancelar</button><button type="submit" class="btn primary">Enviar solicitação</button></div></form>`;document.body.appendChild(d);d.showModal();d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{d.close();d.remove()});
    d.querySelectorAll('input[name="requestRestDays"]').forEach(input=>input.onchange=()=>{const checked=[...d.querySelectorAll('input[name="requestRestDays"]:checked')];if(checked.length>maxRestDays()){input.checked=false;toast(`Escolha no máximo ${maxRestDays()} dia(s) de descanso.`)}});
    d.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),button=e.currentTarget.querySelector('button[type="submit"]'),restDays=f.getAll('requestRestDays').map(Number).slice(0,5);if(restDays.length>maxRestDays())return toast(`Escolha no máximo ${maxRestDays()} dia(s) de descanso.`);button.disabled=true;button.textContent='Enviando…';try{const data=await api('plan_change_request',{method:'POST',body:{reason:String(f.get('reason')||'').trim(),restDays}});state.profile.restDays=[...new Set(restDays)].sort((a,b)=>a-b);state.profile.restDaysUpdatedAt=Date.now();state.weekOverrides={};state.remapRequests=[];state.weekOverridesResetPending=true;state.planChangeRequest={...data.request,createdAt:new Date().toISOString()};save();d.close();d.remove();render();toast('Solicitação enviada. Seu treino atual foi mantido.')}catch(err){button.disabled=false;button.textContent='Enviar solicitação';toast(err.message)}};
  }

  function applyRestSelection(input){
    const inputs=[...document.querySelectorAll('[data-rest-day]')],checked=inputs.filter(x=>x.checked);
    if(checked.length>maxRestDays()){
      input.checked=false;toast(`Com ${trainingDays()} dias de treino, escolha no máximo ${maxRestDays()} dia(s) de descanso.`);return;
    }
    state.profile.restDays=[...new Set(checked.map(x=>Number(x.value)))].sort((a,b)=>a-b);
    state.profile.restDaysUpdatedAt=Date.now();
    state.weekOverrides={};
    state.remapRequests=[];
    state.weekOverridesResetPending=true;
    save();
    render();
    toast('Dias de descanso substituídos. Toque em “Remanejar treinos” para redistribuir o plano.');
  }

  function confirmRemapWorkouts(){
    return new Promise(resolve=>{
      document.querySelector('#vfRemapConfirmDialog')?.remove();
      const brand=document.querySelector('.brand-mark');
      const brandHtml=brand?.innerHTML?.trim()||'↔';
      const systemName=document.querySelector('.brand strong')?.textContent?.trim()||document.title||'Vaz Fitness';
      const d=document.createElement('dialog');
      d.id='vfRemapConfirmDialog';
      d.className='dialog vf-brand-confirm';
      d.innerHTML=`<div class="vf-brand-confirm-sheet">
        <div class="vf-brand-confirm-head">
          <div class="vf-brand-confirm-icon" aria-hidden="true">${brandHtml}</div>
          <div><span class="eyebrow">${escapeHtml(systemName)}</span><h2>Remanejar treinos?</h2></div>
        </div>
        <p>Os dias dos treinos serão redistribuídos conforme seus novos dias de descanso, mantendo exatamente os mesmos exercícios e prescrições.</p>
        <div class="vf-brand-confirm-note"><span>✓</span><div><strong>Seu treino não será recriado.</strong><small>Apenas os dias da semana serão reorganizados.</small></div></div>
        <div class="vf-brand-confirm-actions">
          <button type="button" class="btn vf-brand-cancel" data-remap-cancel>Cancelar</button>
          <button type="button" class="btn vf-brand-confirm-btn" data-remap-confirm>Confirmar remanejamento</button>
        </div>
      </div>`;
      const finish=value=>{if(d.open)try{d.close()}catch{};d.remove();resolve(value)};
      d.addEventListener('cancel',event=>{event.preventDefault();finish(false)});
      d.addEventListener('click',event=>{if(event.target===d)finish(false)});
      d.querySelector('[data-remap-cancel]')?.addEventListener('click',()=>finish(false));
      d.querySelector('[data-remap-confirm]')?.addEventListener('click',()=>finish(true));
      document.body.appendChild(d);
      const modalIcon=d.querySelector('.vf-brand-confirm-icon');
      const brandBg=brand?getComputedStyle(brand).backgroundImage:'none';
      if(modalIcon&&brandBg&&brandBg!=='none'){
        modalIcon.innerHTML='';
        modalIcon.style.backgroundImage=brandBg;
        modalIcon.style.backgroundSize='contain';
        modalIcon.style.backgroundRepeat='no-repeat';
        modalIcon.style.backgroundPosition='center';
      }
      d.showModal();
    });
  }

  async function remapWorkouts(){
    const rest=new Set(selectedRestDays()),allowed=[1,2,3,4,5,6,0].filter(d=>!rest.has(d));
    const workouts=(state.plan||[]).filter(x=>x&&x.status!=='abandoned'&&['strength','run'].includes(x.type));
    if(!allowed.length)return toast('Selecione menos dias de descanso.');
    if(!workouts.length)return toast('Não há treinos no plano para remanejar.');
    if(!await confirmRemapWorkouts())return;
    state.planDayOverrides={};
    state.weekOverrides={};
    state.remapRequests=[];
    state.weekOverridesResetPending=true;
    workouts.forEach((item,index)=>{item.day=allowed[index%allowed.length];state.planDayOverrides[item.id]=item.day;delete item.scheduledDate});
    save();
    try{window.VazCalendar?.reconcile?.()}catch{}
    try{
      const reset=await fetch(`${window.VAZ_API_BASE||''}/api/health?scope=remap&action=reset_overrides`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem(TOKEN_KEY)||''}`},body:JSON.stringify({reason:'rest_days_changed'})});
      if(reset.ok){state.weekOverridesResetPending=false;save();}
    }catch{}
    try{await window.VazCloudSync?.syncNow?.()}catch{}
    render();
    toast('Treinos remanejados. Os descansos antigos foram substituídos pelos novos.');
  }

  function localDateKey(value){
    const d=value?new Date(value):new Date();if(Number.isNaN(d.getTime()))return '';
    const pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function extraWorkoutOptions(){
    return (state.plan||[]).filter(x=>x&&['strength','run'].includes(x.type)&&x.status!=='abandoned'&&!x.generatedExtra);
  }
  function completedToday(){
    const today=localDateKey();
    return [...(state.sessions||[]),...(state.runSessions||[])].filter(s=>(s.localDate||localDateKey(s.date))===today).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  }
  function futureOptions(){
    return typeof window.VazCycleCalendar?.upcomingOccurrences==='function'?window.VazCycleCalendar.upcomingOccurrences(14):[];
  }
  function startChosenExtra(item,{mode='extra',anticipatedFromDate=null}={}){
    if(!item)return;
    state.pendingExtraWorkout={planId:item.id,selectedAt:Date.now(),executedOnRestDay:isRestDayToday(),day:new Date().getDay(),mode,anticipatedFromDate};
    save();startItem(item.id);
  }
  function generatedExtraPlan(){
    const recent=completedToday(),trainedMuscles=new Set(recent.flatMap(s=>(s.exercises||[]).map(e=>e.muscle).filter(Boolean)));
    const candidates=extraWorkoutOptions().filter(x=>x.type==='strength').flatMap(x=>x.exercises||[]);
    const seen=new Set(),unique=candidates.filter(e=>e?.id&&!seen.has(e.id)&&(seen.add(e.id),true));
    const preferred=unique.filter(e=>!e.muscle||!trainedMuscles.has(e.muscle));
    const ordered=[...preferred,...unique.filter(e=>!preferred.includes(e))];
    const exercises=ordered.slice(0,Math.max(3,Math.min(5,Number(state.profile?.minutes)<=30?4:5))).map(e=>({...JSON.parse(JSON.stringify(e)),sets:Math.max(2,Math.min(3,Number(e.sets)||3)),load:Number(e.load)||0,rest:Math.max(45,Number(e.rest)||60)}));
    if(exercises.length>=3)return {id:`extra-gen-${Date.now()}`,type:'strength',name:'Treino extra complementar',day:new Date().getDay(),duration:Math.min(45,Number(state.profile?.minutes)||45),exercises,status:'pending',generatedExtra:true};
    return {id:`extra-run-${Date.now()}`,type:'run',name:'Corrida extra leve',day:new Date().getDay(),duration:25,intensity:'Leve',pace:typeof suggestRunPace==='function'?suggestRunPace('Leve'):(state.profile?.easyPace||'5:30'),status:'pending',generatedExtra:true};
  }
  function startGeneratedExtra(item=generatedExtraPlan()){
    if(item.type==='run'){
      state.pendingExtraWorkout={planId:item.id,selectedAt:Date.now(),executedOnRestDay:isRestDayToday(),day:new Date().getDay(),mode:'generated'};
      save();startRun(item);return;
    }
    state.current={planId:null,name:item.name,startedAt:Date.now(),exercises:(item.exercises||[]).map(e=>({...e,completedSets:[],effort:null})),currentIndex:0,extraWorkout:true,generatedExtra:true,executedOnRestDay:isRestDayToday(),anticipatedWorkout:false,anticipatedFromDate:null,originalPlanDay:new Date().getDay(),originalPlanId:null};
    currentExerciseIndex=0;seconds=0;save();activeView='workout';startTimer();render();
  }
  function openExtraWorkoutDialog(){
    const options=extraWorkoutOptions(),future=futureOptions();
    document.querySelector('#vfExtraWorkoutDialog')?.remove();
    const d=document.createElement('dialog');d.id='vfExtraWorkoutDialog';d.className='dialog vf-extra-dialog';
    d.innerHTML=`<div class="vf-extra-sheet"><div class="vf-request-head"><div><span class="eyebrow">TREINO EXTRA</span><h2>O que você quer fazer hoje?</h2><p>Você pode repetir um treino ativo sem mexer no calendário, antecipar um treino futuro ou gerar uma sessão complementar.</p></div><button type="button" class="training-detail-close" data-close>✕</button></div>
      <div class="vf-extra-mode-grid">
        <button type="button" class="vf-extra-mode active" data-extra-mode="active"><strong>Treino ativo</strong><span>Faça um treino do seu plano como extra. A data original permanece.</span></button>
        <button type="button" class="vf-extra-mode" data-extra-mode="anticipate"><strong>Antecipar treino</strong><span>Faça hoje um treino futuro e retire essa ocorrência da data original.</span></button>
        <button type="button" class="vf-extra-mode" data-extra-mode="generate"><strong>Gerar treino extra</strong><span>Crie uma sessão complementar com volume moderado a partir do seu plano.</span></button>
      </div>
      <div class="vf-extra-panel" data-extra-panel="active"><div class="vf-extra-list">${options.map(item=>`<button type="button" class="vf-extra-option" data-extra-plan="${item.id}"><div><span class="vf-extra-type">${item.type==='run'?'CORRIDA':'FORÇA'}</span><strong>${item.name}</strong><small>Será registrado somente como treino extra hoje.</small></div><b>Fazer ›</b></button>`).join('')||'<div class="coach-chart-empty">Nenhum treino ativo disponível.</div>'}</div></div>
      <div class="vf-extra-panel" data-extra-panel="anticipate" hidden><div class="vf-extra-list">${future.map(item=>`<button type="button" class="vf-extra-option" data-anticipate-plan="${item.id}" data-anticipate-date="${item._occurrenceDate}"><div><span class="vf-extra-type">ANTECIPAR</span><strong>${item.name}</strong><small>Programado para ${new Date(item._occurrenceDate+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'})} • essa data ficará como descanso</small></div><b>Antecipar ›</b></button>`).join('')||'<div class="coach-chart-empty">Não há treino futuro disponível para antecipar neste ciclo.</div>'}</div></div>
      <div class="vf-extra-panel" data-extra-panel="generate" hidden><div class="vf-generated-extra"><div><span class="eyebrow">SESSÃO COMPLEMENTAR</span><h3>Gerar um treino extra</h3><p>O sistema usa exercícios já presentes no seu plano e reduz o volume. Quando possível, prioriza grupos musculares que ainda não foram trabalhados hoje.</p></div><button type="button" class="btn primary" data-preview-extra>Gerar treino</button></div><div id="vfGeneratedExtraPreview"></div></div>
    </div>`;
    document.body.appendChild(d);d.showModal();
    const close=()=>{d.close();d.remove()};
    d.querySelector('[data-close]')?.addEventListener('click',close);d.addEventListener('click',e=>{if(e.target===d)close()});
    d.querySelectorAll('[data-extra-mode]').forEach(b=>b.onclick=()=>{
      d.querySelectorAll('[data-extra-mode]').forEach(x=>x.classList.toggle('active',x===b));
      d.querySelectorAll('[data-extra-panel]').forEach(x=>x.hidden=x.dataset.extraPanel!==b.dataset.extraMode);
    });
    d.querySelectorAll('[data-extra-plan]').forEach(button=>button.addEventListener('click',()=>{const item=options.find(x=>String(x.id)===String(button.dataset.extraPlan));close();startChosenExtra(item,{mode:'extra'})}));
    d.querySelectorAll('[data-anticipate-plan]').forEach(button=>button.addEventListener('click',()=>{
      const date=button.dataset.anticipateDate,item=future.find(x=>String(x.id)===String(button.dataset.anticipatePlan)&&x._occurrenceDate===date);if(!item)return;
      close();startChosenExtra(item,{mode:'anticipate',anticipatedFromDate:date});
    }));
    const renderGeneratedPreview=()=>{
      const item=generatedExtraPlan(),host=d.querySelector('#vfGeneratedExtraPreview');if(!host)return;
      const body=item.type==='run'
        ? `<div class="vf-extra-preview-list"><span>Corrida leve</span><strong>${item.duration} min • ${item.pace}/km</strong><small>Intensidade leve, pensada como sessão complementar.</small></div>`
        : `<div class="vf-extra-preview-list">${(item.exercises||[]).map(e=>`<div><span>${escapeHtml(muscleNames[e.muscle]||e.muscle||'Exercício')}</span><strong>${escapeHtml(e.name)}</strong><small>${e.sets}× ${escapeHtml(e.reps)} • descanso ${e.rest}s</small></div>`).join('')}</div>`;
      host.innerHTML=`<div class="vf-extra-preview"><div class="vf-page-head"><div><span class="eyebrow">PRÉVIA DO TREINO</span><h3>${escapeHtml(item.name)}</h3><p>Confira antes de iniciar.</p></div></div>${body}<div class="vf-extra-preview-actions"><button type="button" class="btn ghost" data-regenerate-extra>Gerar outro</button><button type="button" class="btn primary" data-start-generated-extra>Iniciar treino</button></div></div>`;
      host.querySelector('[data-regenerate-extra]')?.addEventListener('click',renderGeneratedPreview);
      host.querySelector('[data-start-generated-extra]')?.addEventListener('click',()=>{close();startGeneratedExtra(item)});
    };
    d.querySelector('[data-preview-extra]')?.addEventListener('click',renderGeneratedPreview);
  }

  function normalizeRestDayStartButtons(){
    if(!isRestDayToday())return;
    document.querySelectorAll('[data-start]').forEach(button=>{
      button.removeAttribute('data-start');
      button.setAttribute('data-extra-workout-open','');
      button.textContent='＋ Selecionar treino extra';
    });
    document.querySelectorAll('[data-extra-run]').forEach(button=>{
      button.removeAttribute('data-extra-run');
      button.setAttribute('data-extra-workout-open','');
      button.textContent='＋ Selecionar treino extra';
    });
  }

  const baseStartItem=startItem;
  startItem=function(id){
    const pending=state.pendingExtraWorkout,valid=pending&&String(pending.planId)===String(id)&&Date.now()-Number(pending.selectedAt||0)<30*60*1000;
    if((isRestDayToday()||!todaysItem())&&!valid){openExtraWorkoutDialog();return;}
    baseStartItem(id);
  };

  applyPlanDayOverrides();
  const baseRenderAll=render;
  render=function(){applyPlanDayOverrides();return baseRenderAll();};

  const baseBind=bindDynamic;
  bindDynamic=function(){
    normalizeRestDayStartButtons();
    baseBind();
    document.querySelector('[data-request-plan]')?.addEventListener('click',openRequestDialog);
    document.querySelectorAll('[data-rest-day]').forEach(input=>input.onchange=()=>applyRestSelection(input));
    document.querySelectorAll('[data-remap-workouts]').forEach(button=>button.onclick=remapWorkouts);
    document.querySelectorAll('[data-extra-workout-open]').forEach(button=>button.onclick=openExtraWorkoutDialog);
  };

  const style=document.createElement('style');style.textContent=`
    .vf-plan-request-status{display:flex;justify-content:space-between;gap:15px;align-items:flex-start;border-color:#e1c04b;background:#fffbed;margin-bottom:18px}.vf-plan-request-status h2{margin:5px 0}.vf-plan-request-status p{margin:0;color:var(--muted);line-height:1.55}
    .vf-rest-profile,.vf-request-rest>div{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.vf-rest-profile label,.vf-request-rest label{margin:0;min-width:0}.vf-rest-profile input,.vf-request-rest input{position:absolute;opacity:0}.vf-rest-profile span,.vf-request-rest label span{display:grid;place-items:center;padding:10px 3px;border:1px solid var(--line);border-radius:12px;font-size:10px;font-weight:850}.vf-rest-profile input:checked+span,.vf-request-rest input:checked+span{background:#191919;color:#fff;border-color:#191919}
    .vf-training-rest-card{margin:14px 0 18px}.vf-rest-card-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px}.vf-rest-card-foot small{display:block;color:var(--muted);line-height:1.45;max-width:650px}.vf-rest-today{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:13px;border:1px solid #ead273;background:#fff9df;border-radius:16px}.vf-rest-today strong,.vf-rest-today span{display:block}.vf-rest-today strong{font-size:12px}.vf-rest-today span{font-size:10px;color:var(--muted);line-height:1.45;margin-top:3px}
    .vf-request-dialog{width:min(650px,calc(100% - 20px));padding:22px}.vf-request-head{display:flex;justify-content:space-between;gap:12px}.vf-request-head h2{font-size:26px;margin:6px 0}.vf-request-head p{color:var(--muted);line-height:1.5}.vf-request-dialog textarea{width:100%;border:1px solid var(--line);border-radius:14px;padding:12px;font:inherit;resize:vertical;margin-top:6px}.vf-request-rest{border:1px solid var(--line);border-radius:16px;padding:13px;margin:14px 0}.vf-request-rest legend{font-weight:850;padding:0 5px}.vf-confirm-request{margin-top:12px}
    .vf-brand-confirm{width:min(520px,calc(100% - 24px));padding:0;background:transparent;box-shadow:none}.vf-brand-confirm::backdrop{background:rgba(10,10,10,.58);backdrop-filter:blur(8px)}.vf-brand-confirm-sheet{background:var(--white,#fff);color:var(--ink,#222);border:1px solid var(--line,#ececec);border-radius:28px;padding:22px;box-shadow:0 28px 90px rgba(0,0,0,.28)}.vf-brand-confirm-head{display:flex;align-items:center;gap:13px}.vf-brand-confirm-head h2{font-size:24px;margin:3px 0 0;line-height:1.1}.vf-brand-confirm-head .eyebrow{color:var(--ink);opacity:.62;letter-spacing:.11em}.vf-brand-confirm-icon{width:52px;height:52px;flex:0 0 52px;border-radius:17px;background:var(--yellow);color:var(--brand-on-primary,#171717);display:grid;place-items:center;box-shadow:0 10px 26px var(--brand-primary-shadow,rgba(0,0,0,.12));font-weight:900}.vf-brand-confirm-icon svg{width:28px;height:28px}.vf-brand-confirm-sheet>p{font-size:13px;line-height:1.6;color:var(--muted);margin:18px 0}.vf-brand-confirm-note{display:flex;gap:10px;align-items:center;padding:12px;border-radius:16px;background:var(--yellow-soft);border:1px solid var(--line)}.vf-brand-confirm-note>span{width:31px;height:31px;border-radius:11px;background:var(--yellow);color:var(--brand-on-primary,#171717);display:grid;place-items:center;font-weight:950}.vf-brand-confirm-note strong,.vf-brand-confirm-note small{display:block}.vf-brand-confirm-note strong{font-size:11px}.vf-brand-confirm-note small{font-size:9px;color:var(--muted);margin-top:2px;line-height:1.4}.vf-brand-confirm-actions{display:grid;grid-template-columns:1fr 1.45fr;gap:9px;margin-top:18px}.vf-brand-cancel{background:var(--brand-accent-soft,#f3f3f3);color:var(--ink)}.vf-brand-confirm-btn{background:var(--yellow);color:var(--brand-on-primary,#171717);box-shadow:0 10px 25px var(--brand-primary-shadow,rgba(0,0,0,.12))}.vf-brand-confirm-btn:hover,.vf-brand-cancel:hover{transform:translateY(-1px)}
    .vf-extra-dialog{width:min(650px,calc(100% - 20px));padding:0;overflow:hidden}.vf-extra-sheet{padding:20px}.vf-extra-list{display:grid;gap:8px;margin-top:14px;max-height:58vh;overflow:auto}.vf-extra-option{width:100%;border:1px solid var(--line);background:#fff;border-radius:16px;padding:13px;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;color:var(--ink)}.vf-extra-option:hover{border-color:#d0ad00;background:#fffdf2}.vf-extra-option strong,.vf-extra-option small,.vf-extra-type{display:block}.vf-extra-option strong{font-size:13px;margin:3px 0}.vf-extra-option small{font-size:10px;color:var(--muted)}.vf-extra-type{font-size:8px;font-weight:900;letter-spacing:.08em;color:#876d00}.vf-extra-option b{font-size:10px;white-space:nowrap}.vf-extra-mode-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:14px 0}.vf-extra-mode{border:1px solid var(--line);background:#fff;border-radius:16px;padding:12px;text-align:left;color:var(--ink)}.vf-extra-mode strong,.vf-extra-mode span{display:block}.vf-extra-mode strong{font-size:11px}.vf-extra-mode span{font-size:9px;line-height:1.4;color:var(--muted);margin-top:4px}.vf-extra-mode.active{border-color:#d1ad00;background:#fff9d9}.vf-generated-extra{border:1px solid #ead273;background:#fff9df;border-radius:18px;padding:15px;display:flex;align-items:center;justify-content:space-between;gap:14px}.vf-generated-extra h3{margin:4px 0}.vf-generated-extra p{font-size:10px;line-height:1.5;color:var(--muted);max-width:460px}.vf-extra-preview{margin-top:10px;border:1px solid var(--line);border-radius:18px;padding:14px;background:#fff}.vf-extra-preview h3{margin:4px 0}.vf-extra-preview p{margin:0;color:var(--muted);font-size:10px}.vf-extra-preview-list{display:grid;gap:7px;margin-top:10px}.vf-extra-preview-list>div,.vf-extra-preview-list:not(:has(>div)){border:1px solid var(--line);border-radius:13px;padding:9px}.vf-extra-preview-list span,.vf-extra-preview-list strong,.vf-extra-preview-list small{display:block}.vf-extra-preview-list span{font-size:8px;font-weight:900;color:#876d00;text-transform:uppercase}.vf-extra-preview-list strong{font-size:11px;margin:2px 0}.vf-extra-preview-list small{font-size:9px;color:var(--muted)}.vf-extra-preview-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:11px}
    @media(max-width:600px){.vf-extra-mode-grid{grid-template-columns:1fr}.vf-generated-extra{align-items:stretch;flex-direction:column}.vf-generated-extra .btn{width:100%}.vf-extra-preview-actions{flex-direction:column}.vf-extra-preview-actions .btn{width:100%}.vf-brand-confirm-sheet{padding:18px}.vf-brand-confirm-actions{grid-template-columns:1fr}.vf-brand-confirm-btn{order:-1}.vf-rest-profile,.vf-request-rest>div{grid-template-columns:repeat(4,minmax(0,1fr))}.vf-plan-request-status,.vf-rest-card-foot,.vf-rest-today{flex-direction:column;align-items:stretch}.vf-rest-card-foot .btn,.vf-rest-today .btn{width:100%}.vf-extra-sheet{padding:16px}.vf-extra-option{align-items:flex-start}.vf-extra-option b{display:none}}
  `;document.head.appendChild(style);
})();
