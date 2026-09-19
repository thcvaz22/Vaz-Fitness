// Vaz Fitness — detalhes interativos de treinos no calendário e na página inicial.
(function installTrainingDetails(){
  const dialog=document.createElement('dialog');
  dialog.id='trainingDetailDialog';
  dialog.className='dialog training-detail-dialog';
  dialog.innerHTML='<div id="trainingDetailContent"></div>';
  document.body.appendChild(dialog);

  const pad=n=>String(n).padStart(2,'0');
  const effortLabel={easy:'Fácil',moderate:'Moderado',hard:'Difícil'};
  const monthNames=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const statusLabels={pending:'Planejado',done:'Concluído',additional:'Adicional',skipped:'Falha',missed:'Falha',abandoned:'Abandonado'};

  function normalize(value=''){return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
  function keyDate(key){
    const [y,m,d]=String(key).split('-').map(Number);
    return new Date(y,m-1,d,12);
  }
  function formatDate(key){
    const d=keyDate(key);
    return Number.isNaN(d.getTime())?String(key):d.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  }
  function sessionDate(session){
    if(session?.localDate)return session.localDate;
    const d=new Date(session?.date||Date.now());
    if(Number.isNaN(d.getTime()))return '';
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function durationText(session){
    const sec=Number(session?.durationSec)||0;
    if(sec>0){
      const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=Math.floor(sec%60);
      return h?`${h}h ${pad(m)}m ${pad(s)}s`:`${m}m ${pad(s)}s`;
    }
    return `${Math.max(0,Number(session?.duration)||0)} min`;
  }
  function findPlan(planId){return (state.plan||[]).find(p=>String(p.id)===String(planId))||null;}
  function findAbandon(planId){return (state.abandoned||[]).find(a=>String(a.planId)===String(planId))||null;}
  function isAbandoned(planId){return !!findAbandon(planId)||!!(state.skipped||[]).find(s=>String(s.id)===String(planId)&&s.reason==='abandoned')||findPlan(planId)?.status==='abandoned';}
  function findSession(event,type){
    const list=type==='run'?(state.runSessions||[]):(state.sessions||[]);
    if(event?.sessionId){
      const exact=list.find(s=>String(s.id)===String(event.sessionId));
      if(exact)return exact;
    }
    if(event?.planId){
      const byPlan=[...list].reverse().find(s=>String(s.planId||'')===String(event.planId));
      if(byPlan)return byPlan;
    }
    return [...list].reverse().find(s=>sessionDate(s)===event?.date&&(s.name===event?.name||!event?.name))||null;
  }
  function statusFor(event,plan){
    if(isAbandoned(event?.planId||plan?.id))return 'abandoned';
    return event?.status||plan?.status||'pending';
  }
  function metric(label,value){return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;}

  function plannedStrength(plan,event,status){
    const exercises=plan?.exercises||[];
    const abandoned=findAbandon(event?.planId||plan?.id);
    const statusText=statusLabels[status]||'Planejado';
    return `<article class="training-detail-activity ${status}">
      <div class="training-detail-activity-head"><div><span class="training-status ${status}">${statusText}</span><h3>${escapeHtml(plan?.name||event?.name||'Treino de musculação')}</h3><p>Musculação${plan?.goalTag?` • ${escapeHtml(plan.goalTag)}`:''}</p></div><span class="training-type-icon">🏋️</span></div>
      ${status==='abandoned'&&abandoned?`<div class="training-alert"><strong>Treino abandonado</strong><span>${abandoned.completionPercent||0}% concluído • ${abandoned.completedSeries||0} de ${abandoned.plannedSeries||0} séries realizadas.</span></div>`:''}
      ${['skipped','missed'].includes(status)?'<div class="training-alert danger"><strong>Treino não realizado</strong><span>Este treino ficou registrado como falha no calendário.</span></div>':''}
      <div class="training-detail-metrics">${metric('Duração prevista',`${plan?.duration||event?.duration||0} min`)}${metric('Exercícios',String(exercises.length||'—'))}${metric('Status',statusText)}</div>
      ${exercises.length?`<div class="training-exercise-list"><h4>Planejamento do treino</h4>${exercises.map(ex=>`<div class="training-exercise-item"><div class="training-exercise-icon">${ex.icon||'•'}</div><div class="training-exercise-copy"><strong>${escapeHtml(ex.name)}</strong><small>${escapeHtml(muscleNames[ex.muscle]||ex.muscle||'')} ${ex.priority?'• prioridade':''}</small></div><div class="training-exercise-meta"><strong>${ex.sets} × ${escapeHtml(ex.reps)}</strong><small>${Number(ex.load)>0?`Sug. ${ex.load} kg`:'Carga a calibrar'}</small></div></div>`).join('')}</div>`:''}
    </article>`;
  }

  function completedStrength(session,event,status){
    const exs=session?.exercises||[];
    const completion=session?.partial?`${session.completionPercent||0}%`:'100%';
    const statusText=session?.partial?'Concluído parcialmente':'Concluído';
    return `<article class="training-detail-activity done">
      <div class="training-detail-activity-head"><div><span class="training-status done">${statusText}</span><h3>${escapeHtml(session?.name||event?.name||'Treino de musculação')}</h3><p>Resumo real da sessão</p></div><span class="training-type-icon">🏋️</span></div>
      ${session?.partial?`<div class="training-alert"><strong>${completion} do treino realizado</strong><span>${session.completedSeries||0} de ${session.plannedSeries||0} séries registradas.</span></div>`:''}
      <div class="training-detail-metrics">${metric('Duração',durationText(session))}${metric('Volume',`${Number(session?.volume||0).toLocaleString('pt-BR')} kg`)}${metric('Conclusão',completion)}${metric('Exercícios',String(exs.length))}</div>
      ${exs.length?`<div class="training-exercise-list"><h4>Como foi o treino</h4>${exs.map(ex=>{
        const sets=(ex.completedSets||[]).filter(Boolean);
        const maxLoad=Math.max(0,...sets.map(s=>Number(s.load)||0));
        const totalReps=sets.reduce((sum,s)=>sum+(Number(s.reps)||0),0);
        return `<div class="training-exercise-item"><div class="training-exercise-icon">${ex.icon||'✓'}</div><div class="training-exercise-copy"><strong>${escapeHtml(ex.name)}</strong><small>${sets.length} série(s) • ${totalReps} repetições${ex.effort?` • ${effortLabel[ex.effort]||ex.effort}`:''}</small></div><div class="training-exercise-meta"><strong>${maxLoad?`${maxLoad} kg`:'Corporal'}</strong><small>maior carga</small></div></div>`;
      }).join('')}</div>`:''}
    </article>`;
  }

  function plannedRun(plan,event,status){
    const statusText=statusLabels[status]||'Planejado';
    const abandoned=findAbandon(event?.planId||plan?.id);
    return `<article class="training-detail-activity ${status}">
      <div class="training-detail-activity-head"><div><span class="training-status ${status}">${statusText}</span><h3>${escapeHtml(plan?.name||event?.name||'Corrida')}</h3><p>${escapeHtml(plan?.intensity||'Corrida planejada')}</p></div><span class="training-type-icon">🏃</span></div>
      ${status==='abandoned'&&abandoned?`<div class="training-alert"><strong>Atividade abandonada</strong><span>${abandoned.completionPercent||0}% concluído.</span></div>`:''}
      ${['skipped','missed'].includes(status)?'<div class="training-alert danger"><strong>Corrida não realizada</strong><span>Esta sessão ficou registrada como falha no calendário.</span></div>':''}
      <div class="training-detail-metrics">${metric('Tempo previsto',`${plan?.duration||event?.duration||0} min`)}${metric('Pace sugerido',`${plan?.pace||'—'}/km`)}${metric('Intensidade',plan?.intensity||'—')}${metric('Status',statusText)}</div>
      ${plan?.runStructure&&typeof window.renderStructuredRunPlan==='function'?window.renderStructuredRunPlan(plan.runStructure,{compact:true}):''}
    </article>`;
  }

  function completedRun(session,event,status){
    const additional=session?.additional||status==='additional';
    const source=session?.source==='strava'?'Strava':'Vaz Fitness';
    return `<article class="training-detail-activity ${additional?'additional':'done'}">
      <div class="training-detail-activity-head"><div><span class="training-status ${additional?'additional':'done'}">${additional?'Treino adicional':'Concluído'}</span><h3>${escapeHtml(session?.name||event?.name||'Corrida')}</h3><p>${escapeHtml(session?.type||'Corrida')} • registrada via ${source}</p></div><span class="training-type-icon">🏃</span></div>
      <div class="training-detail-metrics">${metric('Distância',`${Number(session?.distance||0).toFixed(2)} km`)}${metric('Tempo',durationText(session))}${metric('Pace',`${session?.pace||'--:--'}/km`)}${metric('Dificuldade',effortLabel[session?.effort]||'Não informada')}</div>
      ${session?.plannedPace?`<div class="training-run-note"><span>Pace planejado</span><strong>${escapeHtml(session.plannedPace)}/km</strong></div>`:''}
    </article>`;
  }

  function renderEvent(event){
    const plan=findPlan(event?.planId);
    const status=statusFor(event,plan);
    const session=findSession(event,event?.type||plan?.type||'strength');
    if((event?.type==='run'||plan?.type==='run')){
      if(session&&(status==='done'||status==='additional'||session.additional))return completedRun(session,event,status);
      return plannedRun(plan,event,status);
    }
    if(session&&status==='done')return completedStrength(session,event,status);
    return plannedStrength(plan,event,status);
  }

  function closeButton(){return '<button type="button" class="training-detail-close" data-training-detail-close aria-label="Fechar">✕</button>';}
  function openDay(date){
    window.VazCalendar?.reconcile?.();
    const events=(state.calendarEvents||[]).filter(e=>e.date===date);
    const done=events.filter(e=>e.status==='done'||e.status==='additional').length;
    const failures=events.filter(e=>['skipped','missed'].includes(e.status)||isAbandoned(e.planId)).length;
    const content=document.getElementById('trainingDetailContent');
    content.innerHTML=`<div class="training-detail-sheet"><div class="training-detail-head"><div><span class="eyebrow">DETALHES DO DIA</span><h2>${escapeHtml(formatDate(date))}</h2><p>${events.length?`${events.length} atividade(s) no calendário`:'Nenhum treino registrado para este dia.'}</p></div>${closeButton()}</div>
      ${events.length?`<div class="training-day-overview">${metric('Atividades',String(events.length))}${metric('Realizadas',String(done))}${metric('Falhas',String(failures))}</div><div class="training-detail-stack">${events.map(renderEvent).join('')}</div>`:'<div class="training-empty-day"><span>○</span><strong>Dia sem atividade</strong><p>Não há treino planejado, concluído ou adicional registrado nesta data.</p></div>'}
    </div>`;
    bindDialogActions();dialog.showModal();
  }

  function openPlan(planId){
    window.VazCalendar?.reconcile?.();
    const plan=findPlan(planId);
    const event=(state.calendarEvents||[]).find(e=>String(e.planId||'')===String(planId))||{planId,date:plan?.scheduledDate||'',name:plan?.name,type:plan?.type,status:plan?.status||'pending',duration:plan?.duration||0};
    const date=event.date||plan?.scheduledDate;
    const content=document.getElementById('trainingDetailContent');
    content.innerHTML=`<div class="training-detail-sheet"><div class="training-detail-head"><div><span class="eyebrow">RESUMO DO TREINO</span><h2>${escapeHtml(plan?.name||event?.name||'Treino')}</h2><p>${date?escapeHtml(formatDate(date)):'Detalhes do planejamento'}</p></div>${closeButton()}</div><div class="training-detail-stack">${renderEvent(event)}</div></div>`;
    bindDialogActions();dialog.showModal();
  }

  function bindDialogActions(){
    document.querySelectorAll('[data-training-detail-close]').forEach(b=>b.addEventListener('click',()=>dialog.close()));
  }
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});

  function visibleCalendarYearMonth(){
    const text=normalize(document.querySelector('.monthly-calendar-card .calendar-head h2')?.textContent||'');
    const year=Number((text.match(/\b(20\d{2})\b/)||[])[1]);
    const month=monthNames.findIndex(m=>text.includes(m));
    return Number.isFinite(year)&&month>=0?{year,month}:null;
  }
  function bindCalendarDays(){
    const ym=visibleCalendarYearMonth();if(!ym)return;
    document.querySelectorAll('.monthly-calendar-card .calendar-day:not(.empty)').forEach(cell=>{
      const day=Number(cell.querySelector('.calendar-number')?.textContent);if(!day)return;
      const date=`${ym.year}-${pad(ym.month+1)}-${pad(day)}`;
      cell.dataset.trainingDay=date;cell.tabIndex=0;cell.setAttribute('role','button');cell.setAttribute('aria-label',`Ver treinos de ${formatDate(date)}`);
      cell.addEventListener('click',()=>openDay(date));
      cell.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openDay(date);}});
    });
  }

  const previousRenderPlanItem=renderPlanItem;
  renderPlanItem=function(p){
    const html=previousRenderPlanItem(p);
    if(html.includes('data-plan-detail='))return html;
    return html.replace('<div class="plan-item',`<div role="button" tabindex="0" data-plan-detail="${escapeHtml(p.id)}" class="plan-item training-detail-trigger`);
  };

  const previousBindDynamic=bindDynamic;
  bindDynamic=function(){
    previousBindDynamic();
    document.querySelectorAll('[data-plan-detail]').forEach(el=>{
      el.addEventListener('click',e=>{if(e.target.closest('button,a,input,select'))return;openPlan(el.dataset.planDetail);});
      el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button,a,input,select')){e.preventDefault();openPlan(el.dataset.planDetail);}});
    });
    bindCalendarDays();
  };

  window.VazTrainingDetails={openDay,openPlan};
  const style=document.createElement('style');
  style.textContent=`
    .training-detail-trigger,.calendar-day:not(.empty){cursor:pointer;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}.training-detail-trigger:focus-visible,.calendar-day:not(.empty):focus-visible{outline:3px solid rgba(245,196,0,.35);outline-offset:2px}@media(hover:hover) and (pointer:fine){.training-detail-trigger:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(0,0,0,.05)}.calendar-day:not(.empty):hover{border-color:#e5c218;box-shadow:0 5px 14px rgba(0,0,0,.05)}}
    .training-detail-dialog{width:min(720px,calc(100% - 22px));max-height:94dvh!important;padding:0!important;overflow-y:auto!important}.training-detail-sheet{padding:24px 24px max(24px,env(safe-area-inset-bottom))}.training-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.training-detail-head h2{margin:5px 0 5px;font-size:28px}.training-detail-head p{margin:0;color:var(--muted);line-height:1.4}.training-detail-close{border:0;width:44px;height:44px;border-radius:15px;background:#f4f4f4;font-size:20px;cursor:pointer;flex:0 0 auto}.training-day-overview,.training-detail-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:18px 0}.training-day-overview{grid-template-columns:repeat(3,minmax(0,1fr))}.training-day-overview>div,.training-detail-metrics>div{background:#fafafa;border:1px solid var(--line);border-radius:15px;padding:12px;min-width:0}.training-day-overview span,.training-detail-metrics span{display:block;color:var(--muted);font-size:10px}.training-day-overview strong,.training-detail-metrics strong{display:block;margin-top:5px;font-size:15px;overflow-wrap:anywhere}.training-detail-stack{display:flex;flex-direction:column;gap:14px}.training-detail-activity{border:1px solid var(--line);border-radius:20px;padding:17px;background:#fff}.training-detail-activity.done{border-color:#ccebd7}.training-detail-activity.additional{border-color:#cfdbf8}.training-detail-activity.skipped,.training-detail-activity.missed,.training-detail-activity.abandoned{border-color:#f4d0cd}.training-detail-activity-head{display:flex;justify-content:space-between;gap:15px}.training-detail-activity-head h3{margin:7px 0 3px;font-size:20px}.training-detail-activity-head p{margin:0;color:var(--muted);font-size:12px}.training-type-icon{font-size:28px}.training-status{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;background:#fff7cf;color:#695900}.training-status.done{background:#eaf8ef;color:#20743d}.training-status.additional{background:#eef3ff;color:#365fa8}.training-status.skipped,.training-status.missed,.training-status.abandoned{background:#fff0ef;color:#ad3c34}.training-exercise-list{margin-top:14px}.training-exercise-list h4{margin:0 0 8px}.training-exercise-item{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line)}.training-exercise-icon{width:36px;height:36px;display:grid;place-items:center;border-radius:12px;background:#f6f6f6}.training-exercise-copy{min-width:0}.training-exercise-copy strong,.training-exercise-copy small,.training-exercise-meta strong,.training-exercise-meta small{display:block}.training-exercise-copy small,.training-exercise-meta small{color:var(--muted);font-size:10px;margin-top:3px}.training-exercise-meta{text-align:right}.training-alert{display:flex;flex-direction:column;gap:4px;background:#fff8d6;border:1px solid #ffe47b;padding:12px 14px;border-radius:14px;margin:14px 0}.training-alert.danger{background:#fff5f4;border-color:#ffd7d2}.training-alert span{font-size:11px;color:var(--muted);line-height:1.4}.training-run-note{display:flex;justify-content:space-between;gap:12px;background:#fafafa;border-radius:13px;padding:11px 13px;font-size:11px}.training-empty-day{text-align:center;padding:34px 15px;color:var(--muted)}.training-empty-day>span{display:block;font-size:30px}.training-empty-day strong{display:block;color:var(--text);font-size:18px;margin:8px 0}.training-empty-day p{margin:0;line-height:1.5}@media(max-width:620px){.training-detail-sheet{padding:20px 16px max(20px,env(safe-area-inset-bottom))}.training-detail-head h2{font-size:23px}.training-day-overview{grid-template-columns:repeat(3,1fr)}.training-detail-metrics{grid-template-columns:1fr 1fr}.training-exercise-item{grid-template-columns:34px minmax(0,1fr);}.training-exercise-meta{grid-column:2;text-align:left;display:flex;align-items:baseline;gap:6px}.training-exercise-meta small{margin:0}.training-detail-dialog{width:calc(100% - 14px)}}
  `;
  document.head.appendChild(style);
})();