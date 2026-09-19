// Vaz Fitness v9 — arquitetura de informação, foco do dia, pré-corrida, metas unificadas e métricas guiadas.
(function installUxV9(){
  if(window.__VAZ_UX_V9__)return;
  window.__VAZ_UX_V9__=true;

  const pad=n=>String(n).padStart(2,'0');
  const safe=v=>escapeHtml(v==null?'':String(v));
  const todayKey=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
  const dateKey=v=>{const d=v instanceof Date?v:new Date(v||0);return Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
  const uid=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const TOKEN_KEY='vazFitness.authToken';

  function ensureV9State(){
    state.personalGoalsV9=Array.isArray(state.personalGoalsV9)?state.personalGoalsV9:[];
    state.suggestedGoalsV9=Array.isArray(state.suggestedGoalsV9)?state.suggestedGoalsV9:[];
    state.bodyMeasurements=Array.isArray(state.bodyMeasurements)?state.bodyMeasurements:[];
    state.medalHall=Array.isArray(state.medalHall)?state.medalHall:[];
    state.monthlyChallenges=Array.isArray(state.monthlyChallenges)?state.monthlyChallenges:[];
    state.goals=state.goals||{};
    state.profile=state.profile||{};
    if(!state.v9GoalsMigrated){
      (state.customGameGoals||[]).forEach(g=>{
        if(state.personalGoalsV9.some(x=>x.id===g.id))return;
        state.personalGoalsV9.push({...g,source:'legacy',createdAt:g.createdAt||new Date().toISOString()});
      });
      state.v9GoalsMigrated=true;
    }
    refreshSuggestedGoals();
    evaluatePersonalGoals();
  }

  function planSignature(){
    return JSON.stringify((state.plan||[]).map(p=>({id:p.basePlanId||p.id,name:p.name,type:p.type,day:p.day,split:p.splitLetter||'',duration:p.duration,ex:(p.exercises||[]).map(e=>e.id||e.name)})));
  }
  function cycleInfo(){
    const c=state.trainingCycle||{},days=[30,45,60,90].includes(Number(c.days))?Number(c.days):30;
    let start=String(c.startedAt||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(start)){const d=new Date();d.setDate(d.getDate()-((d.getDay()+6)%7));start=dateKey(d)}
    let end=String(c.endsAt||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(end)){const d=new Date(`${start}T12:00:00`);d.setDate(d.getDate()+days-1);end=dateKey(d)}
    return {days,start,end};
  }
  function sessionLocalDate(s){return s?.localDate||dateKey(s?.date)}
  function inCycleSessions(list){const c=cycleInfo();return (list||[]).filter(s=>{const k=sessionLocalDate(s);return k>=c.start&&k<=c.end})}
  function currentWeekSessions(){
    const d=new Date();d.setHours(12,0,0,0);const mon=new Date(d);mon.setDate(d.getDate()-((d.getDay()+6)%7));const sun=new Date(mon);sun.setDate(mon.getDate()+6);
    const a=dateKey(mon),b=dateKey(sun);return [...(state.sessions||[]),...(state.runSessions||[])].filter(s=>{const k=sessionLocalDate(s);return k>=a&&k<=b});
  }
  function currentMonthRuns(){const p=todayKey().slice(0,7);return (state.runSessions||[]).filter(r=>sessionLocalDate(r).startsWith(p))}
  function parsePace(v){const m=String(v||'').trim().match(/^(\d{1,2}):(\d{1,2})$/);return m?Number(m[1])*60+Number(m[2]):null}
  function paceText(sec){if(!Number.isFinite(sec))return '—';return `${Math.floor(sec/60)}:${String(Math.round(sec%60)).padStart(2,'0')}`}
  function bestPace(){const a=(state.runSessions||[]).map(r=>parsePace(r.pace)).filter(Boolean);return a.length?Math.min(...a):null}
  function bestLoad(exId){let best=0;(state.sessions||[]).forEach(s=>(s.exercises||[]).forEach(e=>{if(!exId||e.id===exId)(e.completedSets||[]).forEach(x=>best=Math.max(best,Number(x.load)||0))}));return best}
  function latestMeasurement(){return state.bodyMeasurements.at(-1)||null}

  function suggestedGoalTemplates(){
    const p=state.profile||{},c=cycleInfo(),weeks=Math.max(1,c.days/7),days=Math.max(2,Number(p.days)||4),out=[];
    out.push({id:'consistency',title:'Fechar o ciclo com consistência',description:`Concluir pelo menos ${Math.max(4,Math.round(days*weeks*.85))} sessões neste ciclo.`,metric:'cycleSessions',target:Math.max(4,Math.round(days*weeks*.85)),medalKind:'calendar'});
    out.push({id:'feedback',title:'Escutar o corpo',description:'Registrar percepção pós-treino para melhorar os próximos ajustes.',metric:'feedbacksCycle',target:Math.max(4,Math.round(days*weeks*.55)),medalKind:'mind'});
    if(p.mode!=='strength'){
      const monthKm=Number(state.goals?.monthlyRunKm)||Number(p.goal==='42k'?100:p.goal==='21k'?70:p.goal==='10k'?45:30);
      const target=Math.max(10,Math.round(monthKm*c.days/30));
      out.push({id:'run',title:'Quilômetros do ciclo',description:`Somar ${target} km de corrida durante este ciclo.`,metric:'cycleRunKm',target,medalKind:'run'});
    }
    if(p.mode!=='run'){
      const target=Math.max(4,Math.round(days*weeks*(p.mode==='hybrid'?.55:.8)));
      out.push({id:'strength',title:'Força em construção',description:`Concluir ${target} sessões de musculação no ciclo.`,metric:'cycleStrength',target,medalKind:'strength'});
    }
    return out.slice(0,4).map(x=>({...x,difficulty:autoDifficulty(x)}));
  }
  function refreshSuggestedGoals(){
    const sig=planSignature();
    if(!sig||sig==='[]')return;
    if(state.v9PlanSignature===sig&&state.suggestedGoalsV9.length)return;
    state.v9PlanSignature=sig;
    state.suggestedGoalsV9=suggestedGoalTemplates();
    state.v9GoalSuggestionsAt=new Date().toISOString();
  }

  function autoDifficulty(g){
    const t=Number(g.target)||0;
    if(g.metric==='weeklySessions')return t>=6?4:t>=5?3:t>=4?2:1;
    if(['runKm','cycleRunKm'].includes(g.metric))return t>=100?4:t>=60?3:t>=30?2:1;
    if(['cycleSessions','cycleStrength','feedbacksCycle'].includes(g.metric)){const c=cycleInfo(),base=Math.max(1,(Number(state.profile?.days)||4)*c.days/7);const ratio=t/base;return ratio>=.95?4:ratio>=.8?3:ratio>=.6?2:1}
    if(g.metric==='targetWeight'){const cur=Number(latestMeasurement()?.weight||state.profile?.weight)||0,d=Math.abs(cur-t);return d>=15?4:d>=8?3:d>=4?2:1}
    if(g.metric==='targetPace'){const cur=bestPace()||parsePace(state.profile?.easyPace),goal=parsePace(g.targetText||g.target);const d=(cur&&goal)?cur-goal:0;return d>=60?4:d>=30?3:d>=15?2:1}
    if(g.metric==='strengthLoad'){const cur=bestLoad(g.exerciseId),ratio=cur>0?(t-cur)/cur:0;return ratio>=.5?4:ratio>=.3?3:ratio>=.15?2:1}
    if(g.metric==='manual'){const text=`${g.title||''} ${g.description||''}`.toLowerCase();return /maratona|100 km|desafio|recorde|transforma/.test(text)?4:3}
    return 2;
  }
  function difficultyName(n){return ['','Bronze','Prata','Ouro','Lendária'][clamp(n,1,4)]}
  function goalProgress(g){
    const target=Number(g.target)||1;let current=0,done=false,label='';
    if(g.metric==='weeklySessions'){current=currentWeekSessions().length;done=current>=target;label=`${current}/${target} treinos nesta semana`;}
    else if(g.metric==='runKm'){current=currentMonthRuns().reduce((a,r)=>a+(Number(r.distance)||0),0);done=current>=target;label=`${current.toFixed(1)}/${target} km neste mês`;}
    else if(g.metric==='cycleSessions'){current=inCycleSessions([...(state.sessions||[]),...(state.runSessions||[])]).length;done=current>=target;label=`${current}/${target} sessões no ciclo`;}
    else if(g.metric==='cycleStrength'){current=inCycleSessions(state.sessions||[]).length;done=current>=target;label=`${current}/${target} treinos de força`;}
    else if(g.metric==='cycleRunKm'){current=inCycleSessions(state.runSessions||[]).reduce((a,r)=>a+(Number(r.distance)||0),0);done=current>=target;label=`${current.toFixed(1)}/${target} km no ciclo`;}
    else if(g.metric==='feedbacksCycle'){current=inCycleSessions([...(state.sessions||[]),...(state.runSessions||[])]).filter(s=>s.sessionFeedback).length;done=current>=target;label=`${current}/${target} feedbacks`;}
    else if(g.metric==='targetWeight'){
      const cur=Number(latestMeasurement()?.weight||state.profile?.weight)||0,start=Number(g.startValue)||cur;current=cur;
      done=g.direction==='up'?cur>=target:cur<=target;
      const span=Math.abs(start-target)||1,p=Math.max(0,Math.min(1,Math.abs(start-cur)/span));
      return {current,target,pct:done?100:Math.round(p*100),done,label:`${cur?cur.toFixed(1):'—'} kg → ${target.toFixed(1)} kg`};
    }else if(g.metric==='targetPace'){
      const cur=bestPace(),goal=parsePace(g.targetText||g.target);done=!!(cur&&goal&&cur<=goal);const start=Number(g.startValue)||parsePace(state.profile?.easyPace)||cur||goal||1;
      const pct=cur&&goal?Math.round(Math.max(0,Math.min(1,(start-cur)/Math.max(1,start-goal)))*100):0;
      return {current:cur||0,target:goal||0,pct:done?100:pct,done,label:`${paceText(cur)} → ${paceText(goal)}/km`};
    }else if(g.metric==='strengthLoad'){
      current=bestLoad(g.exerciseId);done=current>=target;label=`${current||0} → ${target} kg`;
    }else if(g.metric==='manual'){
      done=!!g.manualDone;current=done?1:0;label=done?'Meta concluída':'Conclusão manual';
    }
    return {current,target,pct:done?100:Math.round(Math.max(0,Math.min(1,current/target))*100),done,label};
  }
  function medalKindFor(g){return g.medalKind||(['runKm','cycleRunKm','targetPace'].includes(g.metric)?'run':['strengthLoad','cycleStrength'].includes(g.metric)?'strength':g.metric==='targetWeight'?'body':g.metric==='feedbacksCycle'?'mind':'star')}
  function evaluatePersonalGoals(){
    state.personalGoalsV9.forEach(g=>{
      if(!g.difficulty)g.difficulty=autoDifficulty(g);
      const p=goalProgress(g);
      if(p.done&&!g.completedAt){g.completedAt=new Date().toISOString();}
      if(g.completedAt&&!state.medalHall.some(m=>m.challengeId===g.id)){
        state.medalHall.push({id:`medal-${g.id}`,challengeId:g.id,title:g.title,description:g.description||'',difficulty:g.difficulty,kind:medalKindFor(g),earnedAt:g.completedAt,month:todayKey().slice(0,7),source:'personal-goal'});
      }
    });
    state.medalHall=state.medalHall.slice(-240);
  }
  function mirrorGoalToCoach(g){
    if(g.metric==='weeklySessions')state.goals.weeklySessions=Number(g.target)||state.goals.weeklySessions;
    if(g.metric==='runKm')state.goals.monthlyRunKm=Number(g.target)||state.goals.monthlyRunKm;
    if(g.metric==='targetWeight')state.goals.targetWeight=Number(g.target)||state.goals.targetWeight;
    if(g.metric==='targetPace')state.goals.targetPace=g.targetText||state.goals.targetPace;
    if(g.metric==='strengthLoad'){state.goals.strengthExercise=g.exerciseId||state.goals.strengthExercise;state.goals.strengthLoad=Number(g.target)||state.goals.strengthLoad;}
  }
  ensureV9State();

  const previousSave=save;
  save=function(){ensureV9State();previousSave();};
  previousSave();

  function motivation(){
    const lines=['Constância transforma intenção em resultado.','Hoje não precisa ser perfeito — precisa ser consistente.','Um treino bem feito vale mais que uma semana de promessas.','Respeite o processo e entregue o melhor que seu corpo permite hoje.','Cada sessão é mais um passo na direção da sua meta.'];
    return lines[new Date().getDate()%lines.length];
  }
  function runGuidance(r){
    const name=String(r?.name||'').toLowerCase(),intensity=String(r?.intensity||'').toLowerCase();
    if(name.includes('interval'))return {objective:'Trabalhar velocidade e capacidade de sustentar ritmos altos com recuperação controlada.',steps:['Aqueça por 8–10 minutos em ritmo leve.','Faça os blocos fortes com técnica estável, sem sair no máximo.','Use a recuperação para baixar a respiração antes do próximo bloco.','Finalize com 5–8 minutos leves.']};
    if(name.includes('long')||name.includes('longão'))return {objective:'Construir resistência aeróbica e tolerância ao tempo em movimento.',steps:['Comece mais leve do que parece necessário.','Mantenha um ritmo sustentável e conversável na maior parte do treino.','Evite acelerar cedo; preserve energia para o final.','Hidrate-se conforme duração e condições do dia.']};
    if(name.includes('tempo'))return {objective:'Sustentar um ritmo controladamente forte e melhorar sua eficiência de corrida.',steps:['Aqueça de forma progressiva.','Entre no ritmo-alvo sem sprintar.','Busque constância de pace e postura.','Desaqueça em ritmo leve ao terminar.']};
    if(name.includes('progress'))return {objective:'Aprender a aumentar o ritmo gradualmente sem quebrar no final.',steps:['Comece leve.','Aumente o ritmo aos poucos ao longo da sessão.','Deixe o trecho mais rápido para o final, ainda sob controle.','Não transforme o progressivo em sprint máximo.']};
    if(intensity.includes('forte'))return {objective:'Estimular velocidade e potência aeróbica com controle.',steps:['Aqueça antes de acelerar.','Mantenha o esforço forte, mas tecnicamente estável.','Respeite qualquer recuperação prevista.','Desaqueça antes de encerrar.']};
    return {objective:'Desenvolver base aeróbica, recuperação e eficiência mantendo esforço confortável.',steps:['Corra em ritmo em que ainda consiga controlar a respiração.','Priorize fluidez e técnica, não velocidade.','Se o corpo estiver pesado, reduza o ritmo sem culpa.','Finalize sentindo que ainda teria pequena margem.']};
  }
  function strengthFocus(t){
    const counts={};(t?.exercises||[]).forEach(e=>{if(e.muscle)counts[e.muscle]=(counts[e.muscle]||0)+Number(e.sets||1)});
    const top=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([m])=>muscleNames[m]||m);
    const focus=top.length?top.join(', '):'força e execução';
    return `O foco de hoje é ${focus}. Priorize amplitude confortável, técnica consistente e séries com boa qualidade antes de pensar em aumentar carga.`;
  }
  function focusText(t){
    if(!t)return 'Hoje o foco é recuperação: sono, hidratação, alimentação e mobilidade leve ajudam a chegar melhor ao próximo treino.';
    if(t.type==='run'){const g=runGuidance(t);return `${g.objective} Meta de ${Number(t.duration)||0} min${t.pace?` com referência de ${safe(t.pace)}/km`:''}.`}
    return strengthFocus(t);
  }
  function metricReminderDue(){
    const c=cycleInfo(),today=todayKey();if(today<c.end)return false;
    const latest=state.bodyMeasurements.at(-1);return !latest||String(latest.date||'')<c.end;
  }

  const priorRenderHome=renderHome;
  renderHome=function(){
    ensureV9State();
    const html=priorRenderHome(),root=document.createElement('div');root.innerHTML=html;
    const t=todaysItem(),check=(state.readinessCheckins||[]).find(x=>String(x.date)===todayKey());
    const card=root.querySelector('.coach-today-card');
    if(card){
      const reminder=metricReminderDue()?`<div class="v9-cycle-metric-reminder"><strong>📏 Ciclo finalizado: hora de atualizar suas métricas.</strong><span>AION recomenda registrar peso e medidas para comparar este ciclo com o próximo.</span><button class="btn ghost compact" data-v9-nav="metrics">Registrar métricas</button></div>`:'';
      card.innerHTML=`<div class="card-head"><div><span class="eyebrow">FOCO DE HOJE</span><h2>${t?safe(t.name):'Recuperação também faz parte'}</h2></div><span class="coach-readiness ${check?'done':''}">${check?`${check.score}% prontidão`:'Ainda não registrado'}</span></div><div class="v9-focus-copy"><p>${focusText(t)}</p><strong>${motivation()}</strong></div>${reminder}<div class="v9-feeling"><span>Como você está se sentindo hoje?</span><button class="btn primary" data-readiness-open>Como estou</button></div>`;
    }
    root.querySelectorAll('[data-nav="aion"]').forEach(b=>b.remove());
    root.querySelectorAll('[data-nav="progress"]').forEach(b=>{b.removeAttribute('data-nav');b.dataset.v9Nav='metrics';b.textContent='Ver métricas';});
    return root.innerHTML;
  };

  const priorRenderRunLive=renderRunLive;
  renderRunLive=function(){
    const r=state.currentRun;
    if(r&&r.status==='ready'){
      const g=runGuidance(r);
      return `<section class="run-live-shell v9-run-preview"><div class="run-live-head"><div><span class="eyebrow">ANTES DE COMEÇAR</span><h1>${safe(r.name)}</h1><p>${safe(r.intensity||'Corrida')} • ${Number(r.plannedDuration)||0} min${r.plannedPace?` • referência ${safe(r.plannedPace)}/km`:''}</p></div><button class="v9-close-run" type="button" data-run-preview-close aria-label="Fechar treino">✕</button></div><div class="card v9-run-objective"><span class="eyebrow">OBJETIVO DO TREINO</span><h2>${safe(g.objective)}</h2><div class="v9-run-instructions"><strong>Como executar</strong><ol>${g.steps.map(x=>`<li>${safe(x)}</li>`).join('')}</ol></div><div class="v9-run-ready-note"><span>GPS e métricas só começam depois que você tocar em iniciar.</span></div><button class="btn primary run-main-btn" data-run-start>▶ Iniciar corrida</button></div></section>`;
    }
    return priorRenderRunLive();
  };

  function stripProfileExtras(html){
    const root=document.createElement('div');root.innerHTML=html;
    root.querySelector('.coach-profile-goals')?.closest('.card')?.remove();
    root.querySelectorAll('.coach-body-card').forEach(x=>x.remove());
    const hall=root.querySelector('.vf-medal-hall');
    const page=root.querySelector('.vf-experience-page');
    if(hall&&page){
      page.innerHTML=`<div class="vf-game-hero"><div><span class="eyebrow">CONQUISTAS</span><h1>Seu Hall de Medalhas.</h1><p>As metas ficam na aba Metas. Aqui você acompanha apenas as medalhas e conquistas que já desbloqueou.</p></div><div class="vf-game-level"><small>MEDALHAS</small><strong>${state.medalHall.length}</strong><span>${state.medalHall.filter(x=>Number(x.difficulty)>=3).length} raras</span></div></div>${hall.outerHTML}`;
    }
    return root.innerHTML;
  }
  const priorRenderProfile=renderProfile;
  renderProfile=function(){ensureV9State();return stripProfileExtras(priorRenderProfile())};

  function renderInjuriesPage(){
    return window.VazExperienceViews?.renderHealth?.()||'<section class="v9-page"><div class="card">Tela de lesões indisponível.</div></section>';
  }
  function renderAchievementsPage(){
    const html=window.VazExperienceViews?.renderAchievements?.();
    if(!html)return '<section class="v9-page"><div class="card">Tela de conquistas indisponível.</div></section>';
    const root=document.createElement('div');root.innerHTML=html;
    const hall=root.querySelector('.vf-medal-hall');
    const earned=state.medalHall||[];
    return `<section class="v9-page v9-achievements-page"><div class="vf-game-hero"><div><span class="eyebrow">CONQUISTAS</span><h1>Seu Hall de Medalhas.</h1><p>Acompanhe as medalhas e conquistas que você desbloqueou ao cumprir suas metas e desafios.</p></div><div class="vf-game-level"><small>MEDALHAS</small><strong>${earned.length}</strong><span>${earned.filter(x=>Number(x.difficulty)>=3).length} raras</span></div></div>${hall?hall.outerHTML:'<div class="card">Hall de Medalhas indisponível.</div>'}</section>`;
  }

  function extractProgress(){const box=document.createElement('div');box.innerHTML=renderProgress();return box}
  function renderCalendarPage(){
    ensureV9State();const box=extractProgress(),cal=box.querySelector('.cycle-calendar-v7')||box.querySelector('.monthly-calendar-card'),goals=box.querySelector('.coach-goals-card');
    if(cal){cal.querySelectorAll('.cycle-marks,.calendar-filter-bar').forEach(x=>x.remove());cal.querySelectorAll('.cycle-day>small').forEach(x=>{if(!x.classList.contains('rest-label'))x.classList.add('v9-day-label')});}
    if(goals){const b=goals.querySelector('[data-goals-edit]');if(b){b.removeAttribute('data-goals-edit');b.dataset.v9Nav='goals';b.textContent='Ver metas';}}
    const recent=[...(state.sessions||[]).map(x=>({...x,_kind:'strength'})),...(state.runSessions||[]).map(x=>({...x,_kind:'run'}))].sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).slice(0,8);
    const history=`<div class="card v9-recent-history" style="margin-top:18px"><div class="card-head"><div><h2>Histórico recente</h2><p>Treinos planejados e extras ficam diferenciados.</p></div></div><div class="v9-history-list">${recent.length?recent.map(s=>`<div class="v9-history-row"><div><strong>${safe(s.name|| (s._kind==='run'?'Corrida':'Treino'))}</strong><small>${s.date?new Date(s.date).toLocaleDateString('pt-BR'):'—'} • ${Number(s.duration)||0} min</small></div><span class="v9-history-badge ${s.extraWorkout?'extra':''}">${s.extraWorkout?'TREINO EXTRA':s._kind==='run'?'CORRIDA':'TREINO'}</span></div>`).join(''):'<div class="coach-chart-empty">Nenhum treino registrado ainda.</div>'}</div></div>`;
    return `<section class="v9-page v9-calendar-page"><div class="workout-hero"><div><span class="eyebrow">CALENDÁRIO</span><h1>Seu ciclo inteiro, sem poluição visual.</h1><p>Treinos, faltas, remanejamentos e atividades concluídas ao longo dos 30, 45, 60 ou 90 dias.</p></div></div>${cal?cal.outerHTML:'<div class="card">Calendário indisponível.</div>'}${history}${goals?`<div style="margin-top:18px">${goals.outerHTML}</div>`:''}</section>`;
  }

  function systemChallengeProgress(c){
    const p=todayKey().slice(0,7),strength=(state.sessions||[]).filter(s=>sessionLocalDate(s).startsWith(p)),runs=(state.runSessions||[]).filter(s=>sessionLocalDate(s).startsWith(p));
    const all=[...strength,...runs],metric=c.metric;let cur=0;
    if(metric==='strengthSessions')cur=strength.length;else if(metric==='runSessions')cur=runs.length;else if(metric==='runKm')cur=runs.reduce((a,r)=>a+(Number(r.distance)||0),0);else if(metric==='activeMinutes')cur=all.reduce((a,s)=>a+(Number(s.duration)||0),0);else if(metric==='feedbacks')cur=all.filter(s=>s.sessionFeedback).length;else cur=all.length;
    const target=Number(c.target)||1;return {current:cur,target,pct:Math.min(100,Math.round(cur/target*100)),done:!!c.completedAt||cur>=target};
  }
  function simpleGoalCard(g,{suggested=false,system=false}={}){
    const p=system?systemChallengeProgress(g):goalProgress(g),tier=g.difficulty||autoDifficulty(g),unit=['runKm','cycleRunKm'].includes(g.metric)?' km':'';
    return `<article class="v9-goal-card ${p.done?'done':''}"><div class="v9-goal-tier tier-${tier}"><span>${tier===4?'★':tier===3?'◆':tier===2?'●':'•'}</span><small>${difficultyName(tier)}</small></div><div class="v9-goal-main"><span class="eyebrow">${system?'DESAFIO DO SISTEMA':suggested?'SUGESTÃO AION':'META PESSOAL'}</span><h3>${safe(g.title)}</h3><p>${safe(g.description||'')}</p><div class="v9-goal-track"><i style="width:${suggested?0:p.pct}%"></i></div><small>${suggested?'Medalha definida automaticamente ao adicionar':system?`${Number(p.current).toFixed(g.metric==='runKm'?1:0)}${unit} / ${p.target}${unit}`:p.label}</small></div><div class="v9-goal-actions">${suggested?`<button class="btn primary compact" data-v9-add-suggestion="${safe(g.id)}">Adicionar</button>`:g.metric==='manual'&&!g.completedAt?`<button class="btn primary compact" data-v9-goal-complete="${safe(g.id)}">Concluir</button>`:''}${!system&&!suggested?`<button class="btn ghost compact" data-v9-goal-remove="${safe(g.id)}">Remover</button>`:''}</div></article>`;
  }
  function renderGoalsPage(){
    ensureV9State();
    const suggestions=(state.suggestedGoalsV9||[]).filter(s=>!state.personalGoalsV9.some(g=>g.suggestionId===s.id&&g.planSignature===state.v9PlanSignature));
    const active=state.personalGoalsV9.filter(g=>!g.completedAt),done=state.personalGoalsV9.filter(g=>g.completedAt);
    return `<section class="v9-page v9-goals-page"><div class="workout-hero"><div><span class="eyebrow">METAS</span><h1>Um lugar único para todos os seus objetivos.</h1><p>Metas pessoais, desafios do sistema e sugestões da AION alimentam as mesmas conquistas e o mesmo Hall de Medalhas.</p></div><button class="btn primary" data-v9-goal-add>+ Nova meta pessoal</button></div>${suggestions.length?`<div class="card v9-suggestions"><div class="card-head"><div><h2>Sugestões para o treino atual</h2><p>Estas metas são renovadas quando seu personal muda o planejamento.</p></div><span class="pill">AION</span></div><div class="v9-goal-list">${suggestions.map(g=>simpleGoalCard(g,{suggested:true})).join('')}</div></div>`:''}<div class="grid two" style="margin-top:18px"><div class="card"><div class="card-head"><div><h2>Metas pessoais</h2><p>Você cria a meta; a AION classifica automaticamente a dificuldade da medalha.</p></div></div><div class="v9-goal-list">${active.length?active.map(g=>simpleGoalCard(g)).join(''):'<div class="coach-chart-empty">Nenhuma meta pessoal ativa.</div>'}</div></div><div class="card"><div class="card-head"><div><h2>Desafios do mês</h2><p>Desafios automáticos compatíveis com seu perfil e rotina.</p></div></div><div class="v9-goal-list">${state.monthlyChallenges.length?state.monthlyChallenges.map(g=>simpleGoalCard(g,{system:true})).join(''):'<div class="coach-chart-empty">Os desafios aparecerão assim que seu ciclo estiver ativo.</div>'}</div></div></div>${done.length?`<div class="card" style="margin-top:18px"><div class="card-head"><div><h2>Metas concluídas</h2><p>As medalhas correspondentes já estão no seu Hall.</p></div></div><div class="v9-goal-list compact">${done.slice(-8).reverse().map(g=>simpleGoalCard(g)).join('')}</div></div>`:''}</section>`;
  }

  function measureSvg(kind){
    const y={chest:48,waist:67,hip:83,arm:58,thigh:105}[kind]||67;
    const side=kind==='arm';
    return `<svg class="v9-measure-svg" viewBox="0 0 120 145" role="img" aria-label="Ilustração de medição"><circle cx="60" cy="18" r="11"/><path d="M44 34 Q60 29 76 34 L82 82 Q73 94 70 132 M76 43 L96 75 M44 43 L24 75 M50 82 L47 132" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>${side?`<circle cx="91" cy="65" r="13" fill="none" stroke="var(--yellow)" stroke-width="4" stroke-dasharray="4 3"/>`:`<path d="M${kind==='thigh'?47:36} ${y} Q60 ${y-5} ${kind==='thigh'?72:84} ${y}" fill="none" stroke="var(--yellow)" stroke-width="5" stroke-linecap="round"/><circle cx="60" cy="${y}" r="3" fill="var(--yellow)"/>`}</svg>`;
  }
  function guideCard(kind,title,text){return `<article class="v9-measure-guide">${measureSvg(kind)}<div><strong>${title}</strong><p>${text}</p></div></article>`}
  function measurementTrend(){
    const vals=state.bodyMeasurements.slice(-8).filter(x=>Number(x.weight)>0);if(vals.length<2)return '<div class="coach-chart-empty">Faça ao menos dois registros para visualizar a tendência.</div>';
    const nums=vals.map(x=>Number(x.weight)),min=Math.min(...nums),max=Math.max(...nums),span=Math.max(.1,max-min),w=420,h=120,p=12;
    const pts=nums.map((v,i)=>`${p+(w-2*p)*(i/(nums.length-1))},${h-p-(h-2*p)*((v-min)/span)}`).join(' ');
    return `<svg class="v9-trend" viewBox="0 0 ${w} ${h}" role="img" aria-label="Evolução do peso"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="v9-trend-labels"><span>${nums[0].toFixed(1)} kg</span><strong>${nums.at(-1).toFixed(1)} kg</strong></div>`;
  }
  const measureGuidePartsV13=[
    {id:'chest',label:'Peitoral',hot:'50,27',img:'assets/measurement-chest.jpg',text:'Passe a fita ao redor do tórax na linha dos mamilos, paralela ao chão, com os braços relaxados.'},
    {id:'waist',label:'Cintura',hot:'50,40',img:'assets/measurement-waist.jpg',text:'Use a linha do umbigo ou o mesmo ponto definido na primeira avaliação. Não prenda a respiração e não aperte a fita.'},
    {id:'hip',label:'Quadril',hot:'50,51',img:'assets/measurement-hip.jpg',text:'Meça a região mais larga dos glúteos. A fita deve permanecer horizontal em toda a volta.'},
    {id:'arm',label:'Braço',hot:'31,32',img:'assets/measurement-arm.jpg',text:'Com o braço relaxado ao lado do corpo, meça o ponto médio entre ombro e cotovelo. A fita envolve o braço na horizontal.'},
    {id:'thigh',label:'Coxa',hot:'44,68',img:'assets/measurement-thigh.jpg',text:'Meça sempre no mesmo ponto entre a virilha e a patela, com a perna relaxada e a fita paralela ao chão.'}
  ];
  function renderMeasureGuideV13(){
    const first=measureGuidePartsV13[0];
    return `<div class="v13-measure-guide" data-measure-root>
      <div class="v13-measure-main">
        <img src="assets/measurement-overview.jpg" alt="Homem em retrato demonstrando os pontos de medição corporal" onerror="this.onerror=null;this.src='assets/body-measurement-guide-v4.svg'">
        ${measureGuidePartsV13.map(p=>{const [x,y]=p.hot.split(',');return `<button type="button" class="v13-measure-hotspot" style="left:${x}%;top:${y}%" data-measure-part="${p.id}" aria-label="Ver como medir ${p.label}"><span></span><small>${p.label}</small></button>`}).join('')}
      </div>
      <div class="v13-measure-thumbs" aria-label="Escolha a região para ver em detalhe">
        ${measureGuidePartsV13.map((p,i)=>`<button type="button" class="v13-measure-thumb ${i===0?'active':''}" data-measure-part="${p.id}"><img src="${p.img}" alt="Como medir ${p.label}" loading="lazy"><strong>${p.label}</strong></button>`).join('')}
      </div>
      <div class="v13-measure-detail" data-measure-detail>
        <div class="v13-measure-photo"><img data-measure-detail-img src="${first.img}" alt="Como medir ${first.label}"></div>
        <div><span class="eyebrow">COMO MEDIR</span><h3 data-measure-title>${first.label}</h3><p data-measure-text>${first.text}</p><small>Fita firme, sem comprimir a pele. Repita sempre no mesmo ponto e em condições semelhantes.</small></div>
      </div>
    </div>`;
  }
  function selectMeasureGuideV13(id){
    const part=measureGuidePartsV13.find(x=>x.id===id)||measureGuidePartsV13[0],root=document.querySelector('[data-measure-root]');if(!root)return;
    root.querySelectorAll('[data-measure-part]').forEach(b=>b.classList.toggle('active',b.dataset.measurePart===part.id));
    const img=root.querySelector('[data-measure-detail-img]');if(img){img.src=part.img;img.alt='Como medir '+part.label}
    const title=root.querySelector('[data-measure-title]'),text=root.querySelector('[data-measure-text]');if(title)title.textContent=part.label;if(text)text.textContent=part.text;
  }

  function renderMetricsPage(){
    ensureV9State();const last=latestMeasurement()||{},box=extractProgress(),aion=box.querySelector('.coach-aion-progress');
    if(aion)aion.querySelectorAll('[data-goals-edit]').forEach(x=>x.remove());
    const due=metricReminderDue();
    return `<section class="v9-page v9-metrics-page"><div class="workout-hero"><div><span class="eyebrow">MÉTRICAS</span><h1>Acompanhe mudanças reais do seu corpo.</h1><p>Registre sempre em condições semelhantes. A AION usa tendência, não uma medida isolada.</p></div><button class="btn primary" data-body-register>+ Nova medição</button></div>${due?`<div class="v9-metric-due"><strong>Seu ciclo terminou.</strong><span>Faça uma nova medição para comparar o resultado deste ciclo e criar uma referência para o próximo.</span><button class="btn dark" data-body-register>Registrar agora</button></div>`:''}<div class="card"><div class="card-head"><div><h2>Evolução corporal</h2><p>Último registro: ${last.date?new Date(last.date+'T12:00:00').toLocaleDateString('pt-BR'):'ainda não realizado'}</p></div></div><div class="v9-metric-grid">${[['Peso',last.weight,'kg'],['Cintura',last.waist,'cm'],['Peitoral',last.chest,'cm'],['Quadril',last.hip,'cm'],['Braço',last.arm,'cm'],['Coxa',last.thigh,'cm'],['Gordura',last.bodyFat,'%']].map(([l,v,u])=>`<div><span>${l}</span><strong>${v?`${Number(v).toFixed(1)} ${u}`:'—'}</strong></div>`).join('')}</div><div class="v9-trend-wrap">${measurementTrend()}</div></div><div class="card v9-measure-help" style="margin-top:18px"><div class="card-head"><div><span class="eyebrow">GUIA AION</span><h2>Como medir do mesmo jeito toda vez</h2><p>Use fita métrica flexível, sem apertar a pele, de preferência no mesmo horário e condições.</p></div></div>${renderMeasureGuideV13()}<div class="v9-aion-measure-note"><strong>💡 Dica da AION</strong><span>Evite comparar medidas feitas depois do treino com medidas em repouso. Hidratação, alimentação e horário mudam o resultado.</span></div></div>${aion?`<div style="margin-top:18px">${aion.outerHTML}</div>`:''}</section>`;
  }

  function openGoalDialogV9(){
    let d=document.getElementById('v9GoalDialog');if(!d){d=document.createElement('dialog');d.id='v9GoalDialog';d.className='dialog coach-dialog';document.body.appendChild(d)}
    const exercises=(exerciseLibrary||[]).slice(0,30);
    d.innerHTML=`<form class="coach-dialog-sheet" data-v9-goal-form><div class="coach-dialog-head"><div><span class="eyebrow">META PESSOAL</span><h2>O que você quer conquistar?</h2><p>A medalha é escolhida automaticamente pela AION conforme a dificuldade.</p></div><button type="button" class="training-detail-close" data-close>✕</button></div><label>Nome da meta<input name="title" maxlength="80" required placeholder="Ex.: correr 50 km no mês"></label><label>Tipo de meta<select name="metric" data-v9-goal-metric><option value="weeklySessions">Treinos por semana</option><option value="runKm">Km de corrida no mês</option><option value="targetWeight">Peso-alvo</option><option value="targetPace">Pace-alvo</option><option value="strengthLoad">Carga-alvo em exercício</option><option value="manual">Meta livre</option></select></label><div data-v9-goal-target><label>Valor da meta<input name="target" type="text" inputmode="decimal" required placeholder="Ex.: 4"></label></div><label data-v9-exercise-row style="display:none">Exercício<select name="exerciseId">${exercises.map(e=>`<option value="${safe(e.id)}">${safe(e.name)}</option>`).join('')}</select></label><label>Descrição<input name="description" maxlength="180" placeholder="Por que essa meta é importante para você?"></label><div class="dialog-actions"><button type="button" class="btn ghost" data-close>Cancelar</button><button class="btn primary">Criar meta</button></div></form>`;
    const metric=d.querySelector('[data-v9-goal-metric]'),targetWrap=d.querySelector('[data-v9-goal-target]'),exerciseRow=d.querySelector('[data-v9-exercise-row]');
    const update=()=>{const v=metric.value,inp=targetWrap.querySelector('input');exerciseRow.style.display=v==='strengthLoad'?'block':'none';if(v==='manual'){targetWrap.style.display='none';inp.required=false;}else{targetWrap.style.display='block';inp.required=true;inp.placeholder=v==='targetPace'?'Ex.: 4:45':v==='targetWeight'?'Ex.: 78.5':v==='runKm'?'Ex.: 40':'Ex.: 4';inp.inputMode=v==='targetPace'?'text':'decimal';}};metric.onchange=update;update();
    d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());
    d.querySelector('[data-v9-goal-form]').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget),metric=String(f.get('metric')),raw=String(f.get('target')||'').replace(',','.'),title=String(f.get('title')||'').trim(),description=String(f.get('description')||'').trim();let target=1,targetText=null;
      if(metric==='targetPace'){if(!parsePace(raw)){toast('Informe o pace no formato min:seg, por exemplo 4:45.');return}targetText=raw;target=parsePace(raw)}else if(metric!=='manual'){target=Number(raw);if(!Number.isFinite(target)||target<=0){toast('Revise o valor da meta.');return}}
      const g={id:uid('goal-v9'),title,description,metric,target,targetText,exerciseId:metric==='strengthLoad'?String(f.get('exerciseId')||''):null,createdAt:new Date().toISOString()};
      if(metric==='targetWeight'){const cur=Number(latestMeasurement()?.weight||state.profile?.weight)||target;g.startValue=cur;g.direction=target>=cur?'up':'down'}
      if(metric==='targetPace')g.startValue=bestPace()||parsePace(state.profile?.easyPace)||target;
      g.difficulty=autoDifficulty(g);g.medalKind=medalKindFor(g);state.personalGoalsV9.push(g);mirrorGoalToCoach(g);save();d.close();render();toast(`Meta criada • medalha ${difficultyName(g.difficulty)} sugerida pela AION.`)};
    d.showModal();
  }
  function openMeasurementDialogV9(){
    let d=document.getElementById('v9MeasurementDialog');if(!d){d=document.createElement('dialog');d.id='v9MeasurementDialog';d.className='dialog coach-dialog';document.body.appendChild(d)}
    const x=latestMeasurement()||{};
    const field=(name,label,unit,min,max)=>`<label>${label} (${unit})<input name="${name}" type="number" inputmode="decimal" min="${min}" max="${max}" step="0.1" value="${x[name]||''}" placeholder="Opcional"></label>`;
    d.innerHTML=`<form class="coach-dialog-sheet" data-v9-measure-form><div class="coach-dialog-head"><div><span class="eyebrow">MÉTRICAS CORPORAIS</span><h2>Novo registro</h2><p>Não aperte a fita e mantenha os mesmos pontos de referência das medições anteriores.</p></div><button type="button" class="training-detail-close" data-close>✕</button></div><div class="field-row">${field('weight','Peso','kg',30,350)}${field('waist','Cintura','cm',30,250)}</div><div class="field-row">${field('chest','Peitoral','cm',30,250)}${field('hip','Quadril','cm',30,250)}</div><div class="field-row">${field('arm','Braço','cm',10,100)}${field('thigh','Coxa','cm',20,150)}</div><div class="field-row">${field('bodyFat','Gordura corporal','%',2,70)}<label>Observações<input name="notes" maxlength="180" value="${safe(x.notes||'')}" placeholder="Horário, jejum, condição..."></label></div><div class="dialog-actions"><button type="button" class="btn ghost" data-close>Cancelar</button><button class="btn primary">Salvar métricas</button></div></form>`;
    d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());
    d.querySelector('[data-v9-measure-form]').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget),num=n=>{const v=Number(String(f.get(n)||'').replace(',','.'));return Number.isFinite(v)&&v>0?+v.toFixed(1):null},weight=num('weight');if(!weight){toast('Informe seu peso atual.');return}const entry={id:Date.now(),date:todayKey(),weight,waist:num('waist'),chest:num('chest'),hip:num('hip'),arm:num('arm'),thigh:num('thigh'),bodyFat:num('bodyFat'),notes:String(f.get('notes')||'').trim().slice(0,180)};const i=state.bodyMeasurements.findIndex(m=>m.date===entry.date);if(i>=0)state.bodyMeasurements[i]={...state.bodyMeasurements[i],...entry};else state.bodyMeasurements.push(entry);state.bodyMeasurements.sort((a,b)=>String(a.date).localeCompare(String(b.date)));state.profile.weight=weight;save();d.close();render();toast('Métricas atualizadas. AION usará a nova referência no próximo ciclo.')};
    d.showModal();
  }
  function addSuggestion(id){const s=state.suggestedGoalsV9.find(x=>x.id===id);if(!s)return;const g={...s,id:uid('goal-suggested'),suggestionId:s.id,planSignature:state.v9PlanSignature,createdAt:new Date().toISOString()};g.difficulty=autoDifficulty(g);state.personalGoalsV9.push(g);mirrorGoalToCoach(g);save();render();toast(`Meta adicionada • medalha ${difficultyName(g.difficulty)}.`)}
  function completeManualGoal(id){const g=state.personalGoalsV9.find(x=>x.id===id);if(!g)return;g.manualDone=true;evaluatePersonalGoals();save();render();toast('Meta concluída. Medalha adicionada ao Hall!')}
  function removeGoal(id){const g=state.personalGoalsV9.find(x=>x.id===id);if(!g||!confirm(`Remover a meta “${g.title}”?`))return;state.personalGoalsV9=state.personalGoalsV9.filter(x=>x.id!==id);save();render();}

  function ensureNavigation(){
    const nav=document.querySelector('.bottom-nav');if(!nav)return;
    if(nav.dataset.v9==='1')return;
    nav.dataset.v9='1';
    nav.innerHTML=`<button class="nav-item" data-v9-nav="home"><span>⌂</span><small>Início</small></button><button class="nav-item" data-v9-nav="workout"><span>⚡</span><small>Treino</small></button><button class="nav-item" data-v9-nav="calendar"><span>▦</span><small>Calendário</small></button><button class="nav-item" data-v9-nav="goals"><span>◎</span><small>Metas</small></button><button class="nav-item" data-v9-nav="metrics"><span>↗</span><small>Métricas</small></button><button class="nav-item" data-v9-nav="injuries"><span>✚</span><small>Lesões</small></button><button class="nav-item" data-v9-nav="achievements"><span>★</span><small>Conquistas</small></button><button class="nav-item" data-v9-nav="profile"><span>●</span><small>Perfil</small></button>`;
  }
  function updateNav(){
    ensureNavigation();
    document.querySelectorAll('.bottom-nav [data-v9-nav]').forEach(b=>{
      const active=b.dataset.v9Nav===activeView;b.classList.toggle('active',active);
      if(active)requestAnimationFrame(()=>b.scrollIntoView?.({block:'nearest',inline:'center',behavior:'smooth'}));
    });
  }
  function bindV9(){
    ensureNavigation();updateNav();
    document.querySelectorAll('[data-v9-nav]').forEach(b=>b.onclick=()=>setView(b.dataset.v9Nav));
    document.querySelector('[data-run-preview-close]')?.addEventListener('click',()=>{if(state.currentRun?.status==='ready'){state.currentRun=null;save();activeView='workout';render();}});
    document.querySelectorAll('[data-v9-goal-add]').forEach(b=>b.onclick=openGoalDialogV9);
    document.querySelectorAll('[data-v9-add-suggestion]').forEach(b=>b.onclick=()=>addSuggestion(b.dataset.v9AddSuggestion));
    document.querySelectorAll('[data-v9-goal-complete]').forEach(b=>b.onclick=()=>completeManualGoal(b.dataset.v9GoalComplete));
    document.querySelectorAll('[data-v9-goal-remove]').forEach(b=>b.onclick=()=>removeGoal(b.dataset.v9GoalRemove));
    document.querySelectorAll('[data-body-register]').forEach(b=>b.onclick=openMeasurementDialogV9);
    document.querySelectorAll('[data-measure-part]').forEach(b=>b.onclick=()=>selectMeasureGuideV13(b.dataset.measurePart));
  }

  const priorBindDynamic=bindDynamic;
  bindDynamic=function(){priorBindDynamic();bindV9();};

  const priorRender=render;
  render=function(){
    ensureV9State();ensureNavigation();
    if(!localStorage.getItem(TOKEN_KEY)){priorRender();return;}
    const custom=['calendar','goals','metrics','injuries','achievements'];
    if(custom.includes(activeView)){
      const v=document.getElementById('view');
      if(v){
        const pages={calendar:renderCalendarPage,goals:renderGoalsPage,metrics:renderMetricsPage,injuries:renderInjuriesPage,achievements:renderAchievementsPage};
        v.innerHTML=pages[activeView]();bindDynamic();updateNav();
      }
      return;
    }
    priorRender();updateNav();
  };

  const style=document.createElement('style');
  style.textContent=`
    .bottom-nav[data-v9="1"]{display:flex!important;grid-template-columns:none!important;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;overscroll-behavior-x:contain;scroll-snap-type:x proximity}.bottom-nav[data-v9="1"]::-webkit-scrollbar{display:none}.bottom-nav[data-v9="1"] .nav-item{flex:0 0 72px;min-width:72px;scroll-snap-align:center}.bottom-nav[data-v9="1"] .nav-item small{font-size:8px}.v9-focus-copy{padding:12px 0 4px}.v9-focus-copy p{font-size:14px;line-height:1.62;color:#4b4b4b;margin:0 0 8px}.v9-focus-copy strong{font-size:13px}.v9-feeling{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid var(--line);margin-top:14px;padding-top:14px}.v9-feeling span{font-weight:850;font-size:13px}.v9-cycle-metric-reminder{display:grid;grid-template-columns:1fr auto;gap:4px 12px;align-items:center;background:#fff8cf;border:1px solid #e5c635;border-radius:16px;padding:12px;margin-top:14px}.v9-cycle-metric-reminder strong,.v9-cycle-metric-reminder span{display:block}.v9-cycle-metric-reminder span{font-size:10px;color:#6d5c16}.v9-cycle-metric-reminder .btn{grid-column:2;grid-row:1/3}.v9-run-preview .run-live-head{align-items:flex-start}.v9-close-run{width:42px;height:42px;border:1px solid var(--line);border-radius:14px;background:#fff;font-size:20px;cursor:pointer}.v9-run-objective{padding:22px}.v9-run-objective h2{font-size:clamp(22px,5vw,34px);line-height:1.16;margin:8px 0 18px}.v9-run-instructions{background:#fafafa;border:1px solid var(--line);border-radius:18px;padding:16px}.v9-run-instructions ol{margin:10px 0 0;padding-left:20px}.v9-run-instructions li{margin:8px 0;line-height:1.5}.v9-run-ready-note{margin:14px 0;color:var(--muted);font-size:11px}.v9-page{padding-bottom:20px}.v9-calendar-page .cycle-marks{display:none!important}.v9-calendar-page .cycle-day>small{margin-top:14px!important}.v9-calendar-page .calendar-filter-bar{display:none!important}.v9-goal-list{display:flex;flex-direction:column;gap:10px}.v9-goal-card{display:grid;grid-template-columns:62px 1fr auto;gap:12px;align-items:center;border:1px solid var(--line);border-radius:18px;padding:12px;background:#fff}.v9-goal-card.done{background:#f7fff8}.v9-goal-tier{height:58px;border-radius:18px;display:grid;place-items:center;align-content:center;background:#f5f5f5}.v9-goal-tier span{font-size:24px;line-height:1}.v9-goal-tier small{font-size:8px;font-weight:900;margin-top:3px}.v9-goal-tier.tier-1{background:#f3e6df}.v9-goal-tier.tier-2{background:#edf0f4}.v9-goal-tier.tier-3{background:#fff4bd}.v9-goal-tier.tier-4{background:#191919;color:#f6cb22;transform:scale(1.04)}.v9-goal-main h3{margin:3px 0;font-size:15px}.v9-goal-main p{margin:0 0 8px;color:var(--muted);font-size:10px;line-height:1.45}.v9-goal-main>small{color:var(--muted);font-size:9px}.v9-goal-track{height:7px;border-radius:999px;background:#eee;overflow:hidden;margin:8px 0 5px}.v9-goal-track i{display:block;height:100%;background:var(--yellow);border-radius:inherit}.v9-goal-actions{display:flex;flex-direction:column;gap:5px}.v9-metric-due{display:flex;align-items:center;gap:12px;background:#fff3aa;border:1px solid #d8b71d;border-radius:20px;padding:15px;margin-bottom:18px}.v9-metric-due strong{font-size:15px}.v9-metric-due span{flex:1;font-size:11px;color:#665817}.v9-metric-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}.v9-metric-grid>div{background:#fafafa;border:1px solid var(--line);border-radius:15px;padding:11px}.v9-metric-grid span,.v9-metric-grid strong{display:block}.v9-metric-grid span{font-size:9px;color:var(--muted)}.v9-metric-grid strong{font-size:14px;margin-top:4px}.v9-trend-wrap{margin-top:16px}.v9-trend{width:100%;max-height:130px;color:#c7a200}.v9-trend-labels{display:flex;justify-content:space-between;color:var(--muted);font-size:10px}.v9-guide-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.v9-measure-guide{border:1px solid var(--line);border-radius:18px;padding:10px;background:#fafafa}.v9-measure-svg{width:100%;height:120px;color:#333;display:block}.v9-measure-guide strong{display:block;margin-top:6px}.v9-measure-guide p{font-size:9px;line-height:1.5;color:var(--muted)}.v9-aion-measure-note{display:grid;grid-template-columns:max-content minmax(0,1fr);align-items:start;gap:10px 12px;background:#191919;color:#fff;border-radius:16px;padding:14px;margin-top:12px}.v9-aion-measure-note strong{white-space:nowrap;min-width:max-content;line-height:1.35}.v9-aion-measure-note span{display:block;min-width:0;color:#d0d0d0;font-size:10px;line-height:1.5;overflow-wrap:anywhere}@media(max-width:560px){.v9-aion-measure-note{grid-template-columns:minmax(0,1fr);gap:7px}.v9-aion-measure-note strong{white-space:normal;min-width:0}}
    @media(max-width:760px){.bottom-nav[data-v9="1"] .nav-item span{font-size:17px}.bottom-nav[data-v9="1"] .nav-item small{font-size:7px}.v9-goal-card{grid-template-columns:52px 1fr}.v9-goal-actions{grid-column:2;flex-direction:row}.v9-metric-grid{grid-template-columns:repeat(2,1fr)}.v9-guide-grid{grid-template-columns:1fr 1fr}.v9-metric-due{align-items:flex-start;flex-wrap:wrap}.v9-metric-due span{width:100%;flex-basis:100%}.v9-cycle-metric-reminder{grid-template-columns:1fr}.v9-cycle-metric-reminder .btn{grid-column:1;grid-row:auto;width:max-content}.v9-feeling{align-items:flex-start;flex-direction:column}.v9-feeling .btn{width:100%}}
  `;
  document.head.appendChild(style);

  queueMicrotask(()=>{try{render()}catch{}});
  const measureGuideStyleV13=document.createElement('style');measureGuideStyleV13.textContent=`
    .v9-history-list{display:grid;gap:8px}.v9-history-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid var(--line)}.v9-history-row:last-child{border-bottom:0}.v9-history-row strong,.v9-history-row small{display:block}.v9-history-row strong{font-size:11px}.v9-history-row small{font-size:9px;color:var(--muted);margin-top:3px}.v9-history-badge{font-size:8px;font-weight:900;letter-spacing:.06em;padding:6px 8px;border-radius:999px;background:#f0f0ee;color:#555;white-space:nowrap}.v9-history-badge.extra{background:var(--yellow-soft,#fff5c0);color:var(--ink,#171717);border:1px solid var(--yellow)}
    .v13-measure-guide{display:grid;grid-template-columns:minmax(240px,.92fr) minmax(300px,1.08fr);gap:18px;align-items:start}.v13-measure-main{position:relative;min-height:520px;border:1px solid var(--line);border-radius:22px;background:#f8f8f6;overflow:hidden;display:grid;place-items:center}.v13-measure-main>img{width:100%;height:100%;max-height:620px;object-fit:cover;object-position:center top}.v13-measure-hotspot{position:absolute;transform:translate(-50%,-50%);border:0;background:transparent;display:flex;align-items:center;gap:5px;cursor:pointer;padding:6px}.v13-measure-hotspot>span{width:15px;height:15px;border-radius:50%;background:var(--yellow);border:3px solid #fff;box-shadow:0 0 0 2px rgba(0,0,0,.22)}.v13-measure-hotspot small{opacity:0;transform:translateX(-4px);transition:.18s;background:var(--ink,#171717);color:#fff;border-radius:999px;padding:4px 7px;font-size:8px;font-weight:900;white-space:nowrap}.v13-measure-hotspot:hover small,.v13-measure-hotspot.active small{opacity:1;transform:none}.v13-measure-thumbs{grid-column:1;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}.v13-measure-thumb{border:1px solid var(--line);background:#fff;border-radius:14px;padding:6px;min-width:0;cursor:pointer;overflow:hidden}.v13-measure-thumb.active{border-color:var(--yellow);box-shadow:0 0 0 2px color-mix(in srgb,var(--yellow) 24%,transparent)}.v13-measure-thumb img{width:100%;height:64px;object-fit:cover;object-position:center;border-radius:9px;background:#f4f4f2;display:block}.v13-measure-thumb strong{display:block;font-size:8px;margin-top:5px;overflow:hidden;text-overflow:ellipsis}.v13-measure-detail{grid-column:2;grid-row:1/3;border:1px solid var(--line);border-radius:22px;padding:14px;background:#fff;display:grid;grid-template-rows:minmax(320px,1fr) auto;gap:14px;min-height:560px}.v13-measure-photo{border-radius:17px;overflow:hidden;background:#f5f5f2;min-height:320px}.v13-measure-photo img{width:100%;height:100%;min-height:320px;max-height:430px;object-fit:cover;object-position:center;display:block}.v13-measure-detail h3{font-size:22px;margin:4px 0 7px}.v13-measure-detail p{font-size:12px;line-height:1.58;margin:0 0 8px;color:#3f3f3f}.v13-measure-detail small{font-size:9px;color:var(--muted);line-height:1.45}.v13-measure-main:after{content:'Toque nos pontos do corpo';position:absolute;left:12px;bottom:12px;background:rgba(255,255,255,.94);border:1px solid var(--line);border-radius:999px;padding:6px 9px;font-size:8px;font-weight:900}
    @media(max-width:760px){.v13-measure-guide{grid-template-columns:1fr}.v13-measure-main{min-height:520px}.v13-measure-thumbs{grid-column:1;grid-row:2;overflow-x:auto;display:flex;padding:3px 4px 8px;scroll-padding-inline:4px}.v13-measure-thumb{flex:0 0 92px}.v13-measure-thumb img{height:78px}.v13-measure-detail{grid-column:1;grid-row:3;min-height:0}.v13-measure-photo,.v13-measure-photo img{min-height:360px}.v13-measure-photo img{max-height:520px}.v13-measure-main>img{object-fit:cover}}
  `;document.head.appendChild(measureGuideStyleV13);

})();
