function renderProgress(){
  const sessions=state.sessions.slice(-8); const maxV=Math.max(...sessions.map(s=>s.volume),1);
  const allEx=state.sessions.flatMap(s=>s.exercises||[]); const best={}; allEx.forEach(e=>{const m=Math.max(...e.completedSets.map(s=>s.load||0),0);best[e.name]=Math.max(best[e.name]||0,m)});
  const effortCounts={easy:0,moderate:0,hard:0};allEx.forEach(e=>{if(e.effort)effortCounts[e.effort]++});
  return `<section class="workout-hero"><div><span class="eyebrow">EVOLUÇÃO</span><h1>Seu progresso, semana após semana.</h1><p>A carga, o volume e o esforço alimentam as próximas decisões da AION.</p></div><span class="pill">${state.sessions.length+state.runSessions.length} sessões</span></section>
  <div class="grid two"><div class="card"><div class="card-head"><div><h2>Volume por treino</h2><p>kg × repetições</p></div></div>${sessions.length?`<div class="chart">${sessions.map((s,i)=>`<div class="bar" style="height:${Math.max(8,s.volume/maxV*100)}%"><span>${new Date(s.date).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</span></div>`).join('')}</div>`:'<p style="color:#777">Conclua seu primeiro treino para começar o gráfico.</p>'}</div>
  <div class="card"><div class="card-head"><div><h2>Melhores cargas</h2><p>Maior carga registrada</p></div></div><div class="trend-list">${Object.entries(best).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([n,v])=>`<div class="trend-row"><span>${n}</span><strong>${v} kg</strong></div>`).join('')||'<p style="color:#777">Sem dados ainda.</p>'}</div></div></div>
  <div class="grid two" style="margin-top:18px"><div class="card"><div class="card-head"><div><h2>Percepção de esforço</h2><p>Base para progressão automática</p></div></div><div class="stats-row" style="grid-template-columns:repeat(3,1fr)"><div class="stat-card"><span>Fácil</span><strong>${effortCounts.easy}</strong><small>tende a progredir</small></div><div class="stat-card"><span>Moderado</span><strong>${effortCounts.moderate}</strong><small>zona-alvo</small></div><div class="stat-card"><span>Difícil</span><strong>${effortCounts.hard}</strong><small>consolidar</small></div></div></div><div class="card aion-card"><div class="card-head"><div><h2>Leitura AION</h2><p>Próxima melhor ação</p></div></div><div class="insight">${aionInsight()}</div></div></div>`
}

function aionInsight(){
  const last=state.sessions.at(-1); if(!last)return `<strong>Plano inicial pronto.</strong> Complete o primeiro treino para eu começar a calibrar suas cargas e volume com base no esforço real.`;
  const easy=last.exercises.filter(e=>e.effort==='easy'), hard=last.exercises.filter(e=>e.effort==='hard');
  const pr=last.exercises.filter(e=>e.priority);
  if(easy.length>hard.length)return `<strong>Boa margem de progressão.</strong> ${easy.length} exercício(s) foram classificados como fáceis. Mantendo a técnica e a faixa de repetições, as próximas cargas sugeridas vão subir gradualmente.${pr.length?` O foco em ${muscleNames[state.profile.priorityMuscle]} permanece preservado.`:''}`;
  if(hard.length>easy.length)return `<strong>Recuperação e consolidação.</strong> Seu último treino teve ${hard.length} exercício(s) difíceis. Em vez de subir tudo, vou manter as principais cargas e buscar melhor execução/repetições antes da próxima progressão.`;
  return `<strong>Progressão equilibrada.</strong> Seu esforço ficou majoritariamente na faixa moderada. É um bom sinal para manter o plano e progredir apenas nos movimentos em que você completar o topo da faixa de repetições.`;
}

function renderAion(){
  return `<section class="aion-page"><div class="card aion-profile"><div class="aion-orb">AION</div><h1>Seu personal contextual.</h1><p>Eu uso objetivo, treino atual, histórico de carga, percepção de esforço, corridas e faltas para orientar suas próximas decisões.</p><div class="insight" style="color:#222">${aionInsight()}</div><div class="hero-actions"><button class="btn primary" data-aion-quick="Tenho só 35 minutos hoje. Ajuste meu treino.">Treino express</button><button class="btn white" data-aion-quick="Quero aumentar o foco no meu músculo prioritário.">Aumentar foco</button></div></div><div class="card chat"><div class="card-head"><div><h2>AION IA</h2><p>Converse naturalmente sobre seu treino</p></div><span class="pill">GEMINI + CONTEXTO</span></div><div class="messages" id="messages">${state.chat.map(m=>`<div class="message ${m.role}">${escapeHtml(m.text)}</div>`).join('')}</div><form class="chat-form" id="chatForm"><input id="chatInput" placeholder="Ex.: estou cansado, adapta meu treino de hoje" autocomplete="off"><button>➜</button></form></div></section>`
}
function aionRespond(text){
  const q=text.toLowerCase(); const t=todaysItem();
  if(q.includes('35')||q.includes('tempo')||q.includes('rápido')||q.includes('rapido')) return t?.type==='strength'?`Ajustei a lógica para um treino express: mantenha os ${Math.min(3,t.exercises.length)} movimentos prioritários, reduza acessórios e use descansos de 60–90s. O foco principal (${muscleNames[state.profile.priorityMuscle]}) será preservado.`:'Na corrida, reduza a duração mantendo a intenção da sessão. Se for intervalado, diminua o número de repetições, não transforme o treino em sprint máximo.';
  if(q.includes('cans')||q.includes('sono')||q.includes('recuper'))return 'Hoje eu reduziria a exigência: mantenha a técnica, não force progressão de carga e considere 1 série a menos nos acessórios. Se houver dor incomum ou sintomas, interrompa e procure orientação profissional.';
  if(q.includes('ombro')||q.includes('prior')||q.includes('foco'))return `Seu foco atual é ${muscleNames[state.profile.priorityMuscle]}. O plano já acrescenta volume estratégico nesse grupo sem abandonar os demais. Posso redistribuir mais volume, mas evito concentrar tudo em um único dia para preservar recuperação.`;
  if(q.includes('carga')||q.includes('peso'))return 'A progressão considera o peso usado, repetições concluídas e seu esforço. Fácil: tendência de +5%; moderado: pequena progressão quando você atinge o topo da faixa; difícil: mantenho a carga até consolidar.';
  if(q.includes('corr'))return `Seu pace confortável cadastrado é ${state.profile.easyPace}/km. Após cada sessão eu cruzo pace realizado e esforço percebido para sugerir a próxima faixa sem acelerar a progressão além do que você tolera.`;
  return `${aionInsight().replace(/<[^>]+>/g,'')} Se quiser, pergunte sobre carga, recuperação, corrida, tempo disponível ou prioridade muscular.`;
}

function renderProfile(){
  const p=state.profile;return `<section class="profile-grid"><div class="card profile-card"><div class="profile-avatar">${p.name.slice(0,2).toUpperCase()}</div><h2>${p.name}</h2><p style="color:#777">${p.level==='advanced'?'Avançado':p.level==='beginner'?'Iniciante':'Intermediário'} • ${p.mode==='hybrid'?'Híbrido':p.mode==='run'?'Corrida':'Musculação'}</p><button class="btn primary" data-edit-profile>Refazer avaliação</button></div><div class="card"><div class="card-head"><div><h2>Plano atual</h2><p>Parâmetros que orientam a AION</p></div></div><div class="detail-list"><div class="detail-row"><span>Modalidade</span><strong>${p.mode==='hybrid'?'Híbrido':p.mode==='run'?'Corrida':'Musculação'}</strong></div><div class="detail-row"><span>Objetivo</span><strong>${goalName(p.goal)}</strong></div><div class="detail-row"><span>Frequência</span><strong>${p.days} dias/semana</strong></div><div class="detail-row"><span>Tempo por treino</span><strong>${p.minutes} min</strong></div><div class="detail-row"><span>Ênfase</span><strong>${muscleNames[p.priorityMuscle]}</strong></div><div class="detail-row"><span>Pace confortável</span><strong>${p.easyPace}/km</strong></div></div><div class="hero-actions"><button class="btn dark" data-regenerate>Regerar plano</button><button class="btn danger-soft" data-reset>Limpar dados demo</button></div></div></section>`
}
function goalName(g){return ({hypertrophy:'Hipertrofia',recomp:'Recomposição corporal',strength:'Força',conditioning:'Condicionamento','5k':'Melhorar 5 km','10k':'Melhorar 10 km','21k':'Meia maratona'})[g]||g}

function bindDynamic(){
  document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>setView(b.dataset.nav));
  document.querySelectorAll('[data-start]').forEach(b=>b.onclick=()=>startItem(b.dataset.start));
  document.querySelectorAll('[data-skip]').forEach(b=>b.onclick=()=>skipItem(b.dataset.skip));
  document.querySelectorAll('[data-regenerate]').forEach(b=>b.onclick=()=>{generatePlan();render();toast('Nova semana gerada pela AION.')});
  document.querySelectorAll('[data-set-done]').forEach(b=>b.onclick=()=>completeSet(+b.dataset.setDone));
  document.querySelectorAll('[data-complete-exercise]').forEach(b=>b.onclick=completeExercise);
  document.querySelectorAll('[data-finish-early]').forEach(b=>b.onclick=finishWorkout);
  document.querySelectorAll('[data-video-id]').forEach(b=>b.onclick=()=>{const ex=exerciseLibrary.find(x=>x.id===b.dataset.videoId);if(ex)showExerciseMedia(ex)});
  document.querySelectorAll('[data-aion-quick]').forEach(b=>b.onclick=()=>sendChat(b.dataset.aionQuick));
  document.querySelector('[data-edit-profile]')?.addEventListener('click',()=>openOnboarding());
  document.querySelector('[data-reset]')?.addEventListener('click',()=>{if(confirm('Limpar todos os dados locais do Vaz Fitness?')){localStorage.removeItem(DB_KEY);location.reload()}});
  const form=document.getElementById('chatForm'); if(form)form.onsubmit=e=>{e.preventDefault();const inp=document.getElementById('chatInput');if(inp.value.trim())sendChat(inp.value.trim());inp.value=''};
}
async function sendChat(text){
  state.chat.push({role:'user',text});
  state.chat.push({role:'ai',text:'AION está analisando seu contexto…',pending:true});
  save();if(activeView!=='aion')activeView='aion';render();
  try{
    const response=await fetch('/api/aion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,context:buildAionContext()})});
    if(!response.ok)throw new Error('AION externa indisponível');
    const data=await response.json();
    state.chat[state.chat.length-1]={role:'ai',text:data.message||aionRespond(text)};
  }catch(err){
    state.chat[state.chat.length-1]={role:'ai',text:`${aionRespond(text)}\n\nModo local ativo: não consegui acessar o Gemini agora.`};
  }
  save();render();setTimeout(()=>{const m=document.getElementById('messages');if(m)m.scrollTop=m.scrollHeight},30);
}
function buildAionContext(){
  const today=todaysItem();
  return {
    profile:state.profile,
    today:today?{type:today.type,name:today.name,duration:today.duration,pace:today.pace,intensity:today.intensity,exercises:today.exercises?.map(e=>({name:e.name,muscle:e.muscle,secondary:e.secondary,sets:e.sets,reps:e.reps,load:e.load,priority:e.priority}))}:null,
    recentStrength:state.sessions.slice(-4).map(s=>({date:s.date,name:s.name,duration:s.duration,volume:s.volume,exercises:s.exercises.map(e=>({name:e.name,effort:e.effort,nextLoad:e.nextLoad,sets:e.completedSets}))})),
    recentRuns:state.runSessions.slice(-4),
    skipped:state.skipped.slice(-3),
    score:state.score
  };
}

function openOnboarding(){const d=document.getElementById('onboardingDialog'); currentStep=1; showStep(); d.showModal()}
let currentStep=1;
function showStep(){
  document.querySelectorAll('.step').forEach(s=>s.classList.toggle('active',+s.dataset.step===currentStep));
  document.getElementById('stepCounter').textContent=`${currentStep}/4`;
  document.getElementById('prevStep').style.visibility=currentStep===1?'hidden':'visible';
  document.getElementById('nextStep').classList.toggle('hidden',currentStep===4);
  document.getElementById('finishOnboarding').classList.toggle('hidden',currentStep!==4);
  document.querySelector('.progress-ring').style.background=`conic-gradient(var(--yellow) ${currentStep*25}%,#eee 0)`;
}
document.getElementById('nextStep').onclick=()=>{currentStep=Math.min(4,currentStep+1);showStep()};
document.getElementById('prevStep').onclick=()=>{currentStep=Math.max(1,currentStep-1);showStep()};
document.getElementById('onboardingForm').onsubmit=e=>{
  e.preventDefault();const fd=new FormData(e.currentTarget);state.profile={...state.profile,mode:fd.get('mode'),goal:fd.get('goal'),level:fd.get('level'),priorityMuscle:fd.get('priorityMuscle'),days:+fd.get('days'),minutes:+fd.get('minutes'),location:fd.get('location'),runLevel:fd.get('runLevel'),easyPace:fd.get('easyPace')||'5:30'};state.onboarded=true;generatePlan();save();document.getElementById('onboardingDialog').close();render();toast('Plano personalizado gerado!')
};
document.querySelectorAll('[data-effort]').forEach(b=>b.onclick=()=>applyEffort(b.dataset.effort));
document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>setView(b.dataset.nav));

// Mobile UX fixes: scrollable dialogs and clearer live-workout fields.
(function installMobileUxFixes(){
  const style=document.createElement('style');
  style.id='vaz-mobile-ux-fixes';
  style.textContent=`
    .dialog{
      max-height:calc(100dvh - 20px)!important;
      overflow-y:auto!important;
      overscroll-behavior:contain;
      -webkit-overflow-scrolling:touch;
      scrollbar-gutter:stable;
    }
    .onboarding-dialog,.media-dialog,.summary-dialog,.effort-dialog{max-height:94dvh!important}
    .onboarding-form,.effort-content,.summary-wrap,#mediaContent{padding-bottom:max(28px,env(safe-area-inset-bottom))}
    .onboarding-dialog .dialog-actions{
      position:sticky;
      bottom:0;
      z-index:5;
      background:linear-gradient(180deg,rgba(255,255,255,.78),#fff 28%);
      border-top:1px solid var(--line);
      padding:14px 0 max(14px,env(safe-area-inset-bottom));
      margin-top:12px;
    }
    .live-shell{padding-bottom:120px}
    .set-table-head{
      display:grid;
      grid-template-columns:42px minmax(0,1fr) minmax(0,1fr) 48px;
      gap:8px;
      align-items:end;
      padding:0 9px 4px;
      margin-top:2px;
      color:#aaa;
      font-size:10px;
      line-height:1.15;
      font-weight:800;
      letter-spacing:.01em;
    }
    .set-table-head span:nth-child(4){text-align:center}
    .set-row{grid-template-columns:42px minmax(0,1fr) minmax(0,1fr) 48px!important}
    .set-index{font-weight:800;color:#fff!important;text-align:center}
    @media(max-width:520px){
      .dialog{max-width:calc(100% - 20px)!important;border-radius:26px}
      .onboarding-form{padding:26px 22px}
      .dialog-head{gap:14px}
      .dialog-head h1{font-size:29px;line-height:1.1}
      .live-card{padding:22px 18px}
      .set-table-head{grid-template-columns:36px minmax(0,1fr) minmax(0,1fr) 44px;padding-inline:6px;font-size:9px}
      .set-row{grid-template-columns:36px minmax(0,1fr) minmax(0,1fr) 44px!important;padding:8px 6px!important}
      .set-row input{padding:10px 8px!important;text-align:center}
      .set-check{width:36px;height:36px}
    }
  `;
  document.head.appendChild(style);
})();

function renderLive(){
  const c=state.current; const ex=c.exercises[c.currentIndex]; if(!ex)return '';
  return `<section class="live-shell"><div class="timer-head"><div><span class="eyebrow">TREINO AO VIVO</span><h2 style="margin:4px 0">${state.plan.find(x=>x.id===c.planId)?.name||'Treino'}</h2></div><div class="live-timer" id="liveTimer">${formatTime(seconds)}</div></div>
  <div class="live-card"><span class="eyebrow">EXERCÍCIO ${c.currentIndex+1} DE ${c.exercises.length}</span><h1 class="exercise-title">${ex.name}</h1><div class="muscle-chips"><span>${muscleNames[ex.muscle]}</span>${ex.secondary.map(m=>`<span>${muscleNames[m]||m}</span>`).join('')}${ex.priority?'<span>★ prioridade</span>':''}</div>
  <div class="video-placeholder"><button class="play-btn" data-video-id="${ex.id}" title="Ver execução">▶</button><div class="video-label"><strong>Ver execução</strong><span>Ilustração animada + instruções</span></div></div>
  <div class="set-table"><div class="set-table-head" aria-hidden="true"><span>Série</span><span>Peso (kg)</span><span>Repetições</span><span>Feito</span></div>${Array.from({length:ex.sets},(_,i)=>renderSetRow(ex,i)).join('')}</div>
  <div class="rest-banner"><span>Descanso sugerido</span><strong>${ex.rest}s</strong></div>
  <div class="live-actions"><button class="btn ghost" data-finish-early>Encerrar treino</button><button class="btn primary" data-complete-exercise="${ex.id}">Concluir exercício</button></div></div></section>`
}
function renderSetRow(ex,i){
  const prev=ex.completedSets?.[i];
  return `<div class="set-row"><span class="set-index" aria-label="Série ${i+1}">${i+1}</span><input type="number" inputmode="decimal" step="0.5" value="${prev?.load ?? ex.load}" data-set-load="${i}" aria-label="Peso em quilogramas da série ${i+1}" title="Peso (kg)"><input type="number" inputmode="numeric" value="${prev?.reps ?? repTarget(ex.reps)}" data-set-reps="${i}" aria-label="Repetições da série ${i+1}" title="Repetições"><button class="set-check ${prev?'done':''}" data-set-done="${i}" aria-label="Marcar série ${i+1} como concluída">${prev?'✓':'○'}</button></div>`
}

if(!state.onboarded || !state.plan.length){ if(state.onboarded&&!state.plan.length)generatePlan(); setTimeout(()=>{if(!state.onboarded)openOnboarding();},250); }
render();
