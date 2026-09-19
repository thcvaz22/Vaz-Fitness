function setView(view){
  activeView=view;
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.nav===view));
  render();
}
function render(){
  const v=document.getElementById('view');
  if(activeView==='home') v.innerHTML=renderHome();
  if(activeView==='workout') v.innerHTML=state.current?renderLive():renderWorkout();
  if(activeView==='progress') v.innerHTML=renderProgress();
  if(activeView==='aion') v.innerHTML=renderAion();
  if(activeView==='profile') v.innerHTML=renderProfile();
  bindDynamic();
}

function renderHome(){
  const today=todaysItem();
  const configuredRest=Array.isArray(state.profile?.restDays)&&state.profile.restDays.map(Number).includes(new Date().getDay());
  const todayRest=!today&&configuredRest;
  const strengthDone=state.sessions.length;
  const runDone=state.runSessions.length;
  const mins=state.sessions.reduce((a,s)=>a+(s.duration||0),0)+state.runSessions.reduce((a,s)=>a+(s.duration||0),0);
  const insight=aionInsight();
  return `
    <section class="hero">
      <div class="hero-card">
        <span class="eyebrow">PLANO ADAPTATIVO</span>
        <h1>${greeting()}, ${state.profile.name}.<br>Vamos evoluir hoje?</h1>
        <p>${todayRest?'Hoje é seu dia de descanso planejado. O repouso ajuda na recuperação muscular, na reposição de energia e na qualidade do próximo treino. Se estiver se sentindo bem, você pode optar apenas por uma atividade leve.':today?`${today.type==='run'?'Corrida':'Musculação'} programada: <strong>${today.name}</strong>. As orientações abaixo seguem exatamente este treino e qualquer remanejamento já aplicado.`:'Hoje não há treino programado no seu ciclo. Aproveite para recuperar o corpo e se preparar para a próxima sessão.'}</p>
        <div class="hero-actions">
          ${todayRest?`<button class="btn primary" data-extra-workout-open>＋ Selecionar treino extra</button>`:today?`<button class="btn primary" data-start="${today.id}">▶ Iniciar ${today.type==='run'?'corrida':'treino'}</button><button class="btn white" data-skip="${today.id}">Não vou treinar hoje</button>`:`<button class="btn primary" data-extra-workout-open>＋ Selecionar treino extra</button>`}
        </div>
      </div>
      <div class="score-card">
        <div class="score-top"><div><span class="eyebrow">FITNESS SCORE</span><div class="score-value">${state.score}</div></div><span class="score-badge">↗ +${Math.min(6,state.sessions.length)}</span></div>
        <div class="meter"><span style="width:${state.score}%"></span></div>
        <div class="score-meta"><div class="mini-stat"><small>Consistência</small><strong>${Math.min(99,78+state.sessions.length*2)}%</strong></div><div class="mini-stat"><small>Força</small><strong>${Math.min(99,75+state.sessions.length)}</strong></div><div class="mini-stat"><small>Cardio</small><strong>${Math.min(99,72+runDone*2)}</strong></div></div>
      </div>
    </section>
    <section class="stats-row">
      <div class="stat-card"><span>Treinos registrados</span><strong>${strengthDone}</strong><small>musculação</small></div>
      <div class="stat-card"><span>Corridas</span><strong>${runDone}</strong><small>sessões</small></div>
      <div class="stat-card"><span>Tempo ativo</span><strong>${Math.floor(mins/60)}h ${mins%60}m</strong><small>histórico</small></div>
      <div class="stat-card"><span>Prioridade</span><strong style="font-size:18px">${muscleNames[state.profile.priorityMuscle]||'—'}</strong><small>ciclo atual</small></div>
    </section>
    <section class="grid two" style="margin-top:18px">
      <div class="card"><div class="card-head"><div><h2>Sua semana</h2><p>Plano reorganizável pela AION</p></div><span class="pill">${state.profile.days} dias base</span></div><div class="plan-list">${state.plan.slice(0,7).map(renderPlanItem).join('')}</div></div>
      <div class="card aion-card"><div class="card-head"><div style="display:flex;gap:12px;align-items:center"><div class="aion-logo">AION</div><div><h2>Personal IA</h2><p>Análise do seu momento</p></div></div><span class="pill">ATIVO</span></div><div class="insight">${insight}</div><div class="hero-actions"><button class="btn dark" data-nav="aion">Conversar com AION</button><button class="btn ghost" data-nav="progress">Ver evolução</button></div></div>
    </section>`;
}
function greeting(){const h=new Date().getHours();return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'}
function renderPlanItem(p){
  const runMeta=p.type==='run'&&p.runStructure?` • ${({intervals:'intervalado',sprints:'tiros',progressive:'progressivo',tempo:'tempo',long:'longão',recovery:'recuperação',easy:'leve',fartlek:'fartlek'})[p.runStructure.workoutType]||'estruturado'}`:'';
  return `<div class="plan-item ${p.day===new Date().getDay()?'today':''} ${p.status==='done'?'done':''} ${p.status==='skipped'?'skipped':''}"><div class="day-dot">${weekdayNames[p.day]}</div><div class="plan-copy"><strong>${p.name}</strong><small>${p.type==='run'?`${p.duration} min • ${p.pace}/km${runMeta}`:`${p.exercises.length} exercícios • ~${p.duration} min`}</small></div><div class="plan-tag">${p.status==='done'?'CONCLUÍDO':p.status==='skipped'?'REAJUSTADO':p.type==='run'?'CORRIDA':'FORÇA'}</div></div>`
}

function renderWorkout(){
  const today=todaysItem();
  const strength=state.plan.filter(x=>x.type==='strength');
  return `<section class="workout-hero"><div><span class="eyebrow">TREINO</span><h1>${today?today.name:'Plano concluído'}</h1><p>${today?today.type==='run'?`Pace sugerido ${today.pace}/km • intensidade ${today.intensity}`:`Ênfase do ciclo: ${muscleNames[state.profile.priorityMuscle]}. ${today.exercises.length} exercícios em até ${today.duration} min.`:'Gere uma nova semana para continuar.'}</p></div>${today?`<button class="btn dark" data-start="${today.id}">▶ Iniciar agora</button>`:`<button class="btn primary" data-regenerate>Gerar semana</button>`}</section>
  ${today?.type==='run'&&today.runStructure&&typeof window.renderStructuredRunPlan==='function'?window.renderStructuredRunPlan(today.runStructure,{compact:true}):''}
  <div class="grid two"><div class="card"><div class="card-head"><div><h2>Planejamento</h2><p>Musculação e corrida integradas</p></div></div><div class="plan-list">${state.plan.map(renderPlanItem).join('')}</div></div>
  <div class="card"><div class="card-head"><div><h2>Próximo treino de força</h2><p>Progressão orientada por esforço</p></div></div><div class="workout-list">${(strength.find(x=>x.status==='pending')?.exercises||[]).map(e=>`<div class="exercise-row"><div class="exercise-icon">${e.icon}</div><div><strong>${e.name}</strong><small>${muscleNames[e.muscle]}${e.priority?' • prioridade do ciclo':''}</small></div><div class="exercise-meta"><strong>${e.sets}× ${e.reps}</strong><small>${e.load?`Sug. ${e.load} kg`:'Corporal'}</small></div></div>`).join('')||'<p style="color:#777">Nenhum treino pendente.</p>'}</div></div></div>`
}

function startItem(id){
  const item=state.plan.find(x=>x.id===id); if(!item)return;
  const pending=state.pendingExtraWorkout,extra=!!(pending&&String(pending.planId)===String(id)&&Date.now()-Number(pending.selectedAt||0)<30*60*1000);
  if(item.type==='run'){ startRun(item); return; }
  state.current={planId:id,startedAt:Date.now(),exercises:item.exercises.map(e=>({...e,completedSets:[],effort:null})),currentIndex:0,extraWorkout:extra,executedOnRestDay:extra&&!!pending.executedOnRestDay,originalPlanDay:item.day,originalPlanId:item.id};
  if(extra)state.pendingExtraWorkout=null;
  currentExerciseIndex=0; seconds=0; save(); activeView='workout'; startTimer(); render();
}
function startTimer(){clearInterval(workoutTimer);workoutTimer=setInterval(()=>{seconds++;const el=document.getElementById('liveTimer');if(el)el.textContent=formatTime(seconds)},1000)}
function formatTime(s){return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
function renderLive(){
  const c=state.current; const ex=c.exercises[c.currentIndex]; if(!ex)return '';
  return `<section class="live-shell"><div class="timer-head"><div><span class="eyebrow">TREINO AO VIVO</span><h2 style="margin:4px 0">${state.plan.find(x=>x.id===c.planId)?.name||'Treino'}</h2></div><div class="live-timer" id="liveTimer">${formatTime(seconds)}</div></div>
  <div class="live-card"><span class="eyebrow">EXERCÍCIO ${c.currentIndex+1} DE ${c.exercises.length}</span><h1 class="exercise-title">${ex.name}</h1><div class="muscle-chips"><span>${muscleNames[ex.muscle]}</span>${ex.secondary.map(m=>`<span>${muscleNames[m]||m}</span>`).join('')}${ex.priority?'<span>★ prioridade</span>':''}</div>
  <div class="video-placeholder"><button class="play-btn" data-video-id="${ex.id}" title="Ver execução">▶</button><div class="video-label"><strong>Ver execução</strong><span>Ilustração animada + instruções</span></div></div>
  <div class="set-table">${Array.from({length:ex.sets},(_,i)=>renderSetRow(ex,i)).join('')}</div>
  <div class="rest-banner"><span>Descanso sugerido</span><strong>${ex.rest}s</strong></div>
  <div class="live-actions"><button class="btn ghost" data-finish-early>Encerrar treino</button><button class="btn primary" data-complete-exercise="${ex.id}">Concluir exercício</button></div></div></section>`
}
function renderSetRow(ex,i){
  const prev=ex.completedSets?.[i];
  return `<div class="set-row"><span>${i+1}</span><input type="number" inputmode="decimal" step="0.5" value="${prev?.load ?? ex.load}" data-set-load="${i}" aria-label="Carga da série ${i+1}"><input type="number" inputmode="numeric" value="${prev?.reps ?? repTarget(ex.reps)}" data-set-reps="${i}" aria-label="Repetições da série ${i+1}"><button class="set-check ${prev?'done':''}" data-set-done="${i}">${prev?'✓':'○'}</button></div>`
}
