// Vaz Fitness — calendário mensal, aderência e conciliação de atividades.
(function installTrainingCalendar(){
  state.calendarEvents=Array.isArray(state.calendarEvents)?state.calendarEvents:[];
  let calendarCursor=new Date();
  calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth(),1,12);

  const pad=n=>String(n).padStart(2,'0');
  function localDateKey(value=new Date()){
    const d=value instanceof Date?value:new Date(value);
    if(Number.isNaN(d.getTime()))return '';
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function dateForWeekday(day){
    const d=new Date();d.setHours(12,0,0,0);
    d.setDate(d.getDate()+((Number(day)-d.getDay()+7)%7));
    return localDateKey(d);
  }
  function upsertEvent(event){
    if(!event?.id||!event?.date)return;
    const i=state.calendarEvents.findIndex(x=>x.id===event.id);
    if(i>=0)state.calendarEvents[i]={...state.calendarEvents[i],...event};
    else state.calendarEvents.push(event);
  }
  function ensurePlanDates(){
    let changed=false;
    (state.plan||[]).forEach(item=>{
      if(!item.scheduledDate){item.scheduledDate=dateForWeekday(item.day);changed=true;}
      upsertEvent({id:`plan:${item.id}`,planId:item.id,date:item.scheduledDate,name:item.name,type:item.type,kind:'planned',status:item.status||'pending',duration:Number(item.duration)||0});
    });
    if(changed)save();
  }
  function snapshotPlan(){
    ensurePlanDates();
    (state.plan||[]).forEach(item=>upsertEvent({id:`plan:${item.id}`,planId:item.id,date:item.scheduledDate,name:item.name,type:item.type,kind:'planned',status:item.status||'pending',duration:Number(item.duration)||0}));
  }
  function sessionDate(session){return session.localDate||localDateKey(session.date||Date.now());}
  function sessionEvent(session,type){
    const date=sessionDate(session);if(!date)return;
    if(session.planId){
      upsertEvent({id:`plan:${session.planId}`,planId:session.planId,date,name:session.name,type,kind:'planned',status:'done',duration:Number(session.duration)||0,sessionId:String(session.id),source:session.source||'app'});
    }else{
      const additional=!!session.additional;
      upsertEvent({id:`session:${type}:${session.id}`,date,name:session.name||(type==='run'?'Corrida':'Musculação'),type,kind:additional?'additional':'completed',status:additional?'additional':'done',duration:Number(session.duration)||0,sessionId:String(session.id),source:session.source||'app'});
    }
  }
  function reconcile(){
    snapshotPlan();
    const today=localDateKey(new Date());
    (state.skipped||[]).forEach(s=>{
      const plan=state.plan?.find(p=>p.id===s.id);
      const date=plan?.scheduledDate||localDateKey(s.date);
      if(date)upsertEvent({id:`plan:${s.id}`,planId:s.id,date,name:s.name||plan?.name||'Treino',type:plan?.type||'strength',kind:'planned',status:'skipped'});
    });
    (state.sessions||[]).forEach(s=>sessionEvent(s,'strength'));
    (state.runSessions||[]).forEach(s=>sessionEvent(s,'run'));
    state.calendarEvents=state.calendarEvents.map(event=>{
      if(event.kind!=='planned'||!['pending','missed'].includes(event.status))return event;
      const current=state.plan?.find(p=>p.id===event.planId);
      if(current?.status==='done')return {...event,status:'done'};
      if(current?.status==='skipped')return {...event,status:'skipped'};
      return {...event,status:event.date<today?'missed':'pending'};
    });
    save();
  }

  function paceFrom(sec,km){
    if(!(km>0.05&&sec>0))return '--:--';
    const pace=sec/km,m=Math.floor(pace/60),s=Math.round(pace%60);
    return `${m}:${String(s===60?0:s).padStart(2,'0')}`;
  }
  function importStravaActivity(activity){
    const activityId=String(activity?.id||'');
    if(!activityId)return {added:false};
    const duplicate=(state.runSessions||[]).some(r=>String(r.stravaActivityId||r.stravaResult?.activity_id||'')===activityId);
    if(duplicate)return {added:false,duplicate:true};

    ensurePlanDates();
    const date=activity.startDateLocal?String(activity.startDateLocal).slice(0,10):localDateKey(activity.startDate);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return {added:false};
    const matchingPlan=(state.plan||[]).find(p=>p.type==='run'&&p.scheduledDate===date&&p.status!=='done');
    const durationSec=Math.max(1,Number(activity.movingTimeSec)||Number(activity.elapsedTimeSec)||60);
    const distance=Math.max(0,Number(activity.distanceKm)||0);
    const session={
      id:`strava-${activityId}`,stravaActivityId:activityId,date:activity.startDate||activity.startDateLocal||`${date}T12:00:00`,localDate:date,
      name:matchingPlan?.name||activity.name||'Corrida no Strava',type:matchingPlan?.intensity||(matchingPlan?'Corrida':'Corrida adicional'),
      duration:Math.max(1,Math.round(durationSec/60)),durationSec,distance:+distance.toFixed(2),pace:paceFrom(durationSec,distance),plannedPace:matchingPlan?.pace||null,
      effort:null,route:[],routePoints:0,source:'strava',imported:true,additional:!matchingPlan,planId:matchingPlan?.id||null,stravaSync:'synced'
    };
    state.runSessions.push(session);
    if(matchingPlan){
      matchingPlan.status='done';
      upsertEvent({id:`plan:${matchingPlan.id}`,planId:matchingPlan.id,date,name:matchingPlan.name,type:'run',kind:'planned',status:'done',duration:session.duration,sessionId:String(session.id),source:'strava'});
    }else{
      upsertEvent({id:`strava:${activityId}`,date,name:session.name,type:'run',kind:'additional',status:'additional',duration:session.duration,sessionId:String(session.id),source:'strava'});
    }
    save();reconcile();
    return {added:true,additional:!matchingPlan,session};
  }

  function monthEvents(cursor){
    reconcile();
    const prefix=`${cursor.getFullYear()}-${pad(cursor.getMonth()+1)}-`;
    return state.calendarEvents.filter(e=>e.date?.startsWith(prefix));
  }
  const eventClass=e=>e.status==='done'?'done':e.status==='additional'?'additional':['skipped','missed'].includes(e.status)?'missed':'planned';
  function eventLabel(e){
    if(e.status==='additional')return '+ Extra';
    if(e.status==='done')return e.type==='run'?'✓ Corrida':'✓ Musculação';
    if(e.status==='skipped'||e.status==='missed')return '✕ Falha';
    return e.type==='run'?'○ Corrida':'○ Musculação';
  }
  function renderMonthlyCalendar(){
    const events=monthEvents(calendarCursor);
    const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth();
    const first=new Date(y,m,1,12),days=new Date(y,m+1,0,12).getDate(),offset=(first.getDay()+6)%7;
    const cells=Array.from({length:offset},()=>'<div class="calendar-day empty"></div>');
    for(let d=1;d<=days;d++){
      const key=`${y}-${pad(m+1)}-${pad(d)}`;
      const dayEvents=events.filter(e=>e.date===key);
      const chips=dayEvents.slice(0,2).map(e=>`<span class="calendar-chip ${eventClass(e)}" title="${escapeHtml(e.name||'Treino')}">${eventLabel(e)}</span>`).join('');
      cells.push(`<div class="calendar-day ${key===localDateKey(new Date())?'today':''} ${dayEvents.length?'has-event':''}"><span class="calendar-number">${d}</span><div class="calendar-day-events">${chips}${dayEvents.length>2?`<small class="calendar-more">+${dayEvents.length-2}</small>`:''}</div></div>`);
    }

    const plannedDone=events.filter(e=>e.kind==='planned'&&e.status==='done').length;
    const completedOther=events.filter(e=>e.kind==='completed'&&e.status==='done').length;
    const realized=plannedDone+completedOther;
    const missed=events.filter(e=>e.kind==='planned'&&(e.status==='missed'||e.status==='skipped')).length;
    const additional=events.filter(e=>e.status==='additional').length;
    const adherence=(plannedDone+missed)?Math.round(plannedDone/(plannedDone+missed)*100):100;
    const prefix=`${y}-${pad(m+1)}-`;
    const monthRuns=(state.runSessions||[]).filter(r=>sessionDate(r).startsWith(prefix));
    const monthStrength=(state.sessions||[]).filter(s=>sessionDate(s).startsWith(prefix));
    const minutes=[...monthRuns,...monthStrength].reduce((sum,s)=>sum+(Number(s.duration)||0),0);
    const km=monthRuns.reduce((sum,s)=>sum+(Number(s.distance)||0),0);
    const title=calendarCursor.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});

    return `<section class="card monthly-calendar-card">
      <div class="calendar-head"><div><span class="eyebrow">CALENDÁRIO DE TREINOS</span><h2>${title.charAt(0).toUpperCase()+title.slice(1)}</h2><p>Treinos planejados, realizados, falhas e atividades adicionais.</p></div><div class="calendar-nav"><button class="icon-btn" data-calendar-prev aria-label="Mês anterior">‹</button><button class="calendar-today-btn" data-calendar-current>Hoje</button><button class="icon-btn" data-calendar-next aria-label="Próximo mês">›</button></div></div>
      <div class="monthly-summary"><div><span>Realizados</span><strong>${realized}</strong></div><div><span>Falhas</span><strong>${missed}</strong></div><div><span>Adicionais</span><strong>${additional}</strong></div><div><span>Consistência</span><strong>${adherence}%</strong></div><div><span>Tempo ativo</span><strong>${Math.floor(minutes/60)}h ${minutes%60}m</strong></div><div><span>Corrida</span><strong>${km.toFixed(1)} km</strong></div></div>
      <div class="calendar-weekdays"><span>SEG</span><span>TER</span><span>QUA</span><span>QUI</span><span>SEX</span><span>SÁB</span><span>DOM</span></div>
      <div class="calendar-grid">${cells.join('')}</div>
      <div class="calendar-legend"><span><i class="done"></i>Realizado</span><span><i class="missed"></i>Falha</span><span><i class="additional"></i>Adicional</span><span><i class="planned"></i>Planejado</span></div>
    </section>`;
  }

  const previousRenderProgress=renderProgress;
  renderProgress=function(){const html=previousRenderProgress();return html.replace('</section>',`</section>${renderMonthlyCalendar()}`);};
  const previousBindDynamic=bindDynamic;
  bindDynamic=function(){
    previousBindDynamic();
    document.querySelector('[data-calendar-prev]')?.addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1,12);render();});
    document.querySelector('[data-calendar-next]')?.addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1,12);render();});
    document.querySelector('[data-calendar-current]')?.addEventListener('click',()=>{const n=new Date();calendarCursor=new Date(n.getFullYear(),n.getMonth(),1,12);render();});
  };

  const previousGeneratePlan=generatePlan;
  generatePlan=function(){snapshotPlan();previousGeneratePlan();ensurePlanDates();snapshotPlan();save();};
  const previousFinishWorkout=finishWorkout;
  finishWorkout=function(){
    const planId=state.current?.planId||null,localDate=localDateKey(new Date());
    previousFinishWorkout();
    const session=state.sessions.at(-1);
    if(session){session.localDate=session.localDate||localDate;if(planId&&!session.planId){session.planId=planId;session.additional=false;}save();}
    reconcile();
  };
  if(typeof finishRunSession==='function'){
    const previousFinishRun=finishRunSession;
    finishRunSession=function(){
      const planId=state.currentRun?.planId||null,localDate=localDateKey(new Date()),before=state.runSessions.length;
      previousFinishRun();
      const session=state.runSessions.at(-1);
      if(session&&state.runSessions.length>before){session.localDate=session.localDate||localDate;session.planId=planId;session.additional=!planId;save();}
      reconcile();
    };
  }
  const previousSkip=skipItem;
  skipItem=function(id){previousSkip(id);reconcile();};

  window.VazCalendar={reconcile,importStravaActivity,ensurePlanDates,localDateKey};
  const style=document.createElement('style');
  style.textContent=`.monthly-calendar-card{margin:18px 0}.calendar-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.calendar-head h2{margin:4px 0 6px}.calendar-nav{display:flex;gap:8px;align-items:center}.calendar-today-btn{border:1px solid var(--line);background:#fff;border-radius:12px;padding:9px 12px;font-weight:800;cursor:pointer}.monthly-summary{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin:18px 0}.monthly-summary>div{background:#fafafa;border:1px solid var(--line);border-radius:16px;padding:12px}.monthly-summary span{display:block;color:var(--muted);font-size:10px}.monthly-summary strong{display:block;margin-top:5px;font-size:16px}.calendar-weekdays,.calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.calendar-weekdays{margin-bottom:6px}.calendar-weekdays span{text-align:center;color:var(--muted);font-size:9px;font-weight:800}.calendar-day{min-height:92px;border:1px solid var(--line);border-radius:15px;padding:8px;background:#fff;overflow:hidden}.calendar-day.empty{border-color:transparent;background:transparent}.calendar-day.today{box-shadow:inset 0 0 0 2px var(--yellow)}.calendar-number{font-size:12px;font-weight:800}.calendar-day-events{display:flex;flex-direction:column;gap:4px;margin-top:7px}.calendar-chip{display:block;border-radius:8px;padding:4px 5px;font-size:8px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.calendar-chip.done{background:#eaf8ef;color:#20743d}.calendar-chip.missed{background:#fff0ef;color:#b43a32}.calendar-chip.additional{background:#eef3ff;color:#365fa8}.calendar-chip.planned{background:#fff8d6;color:#705d00}.calendar-more{font-size:8px;color:var(--muted)}.calendar-legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:14px;color:var(--muted);font-size:10px}.calendar-legend span{display:flex;align-items:center;gap:5px}.calendar-legend i{width:9px;height:9px;border-radius:50%;display:inline-block}.calendar-legend i.done{background:#38a665}.calendar-legend i.missed{background:#e25b52}.calendar-legend i.additional{background:#5b7ed0}.calendar-legend i.planned{background:#e4c12b}@media(max-width:760px){.calendar-head{flex-direction:column}.monthly-summary{grid-template-columns:repeat(3,1fr)}.calendar-day{min-height:76px;padding:6px}.calendar-chip{font-size:7px;padding:3px 4px}.calendar-nav{width:100%;justify-content:flex-end}}@media(max-width:430px){.monthly-summary{grid-template-columns:repeat(2,1fr)}.calendar-grid,.calendar-weekdays{gap:3px}.calendar-day{min-height:68px;border-radius:10px}.calendar-number{font-size:10px}.calendar-chip{font-size:0;height:7px;padding:0;border-radius:999px}.calendar-chip.done{background:#38a665}.calendar-chip.missed{background:#e25b52}.calendar-chip.additional{background:#5b7ed0}.calendar-chip.planned{background:#e4c12b}.calendar-more{display:none}}`;
  document.head.appendChild(style);

  ensurePlanDates();reconcile();
})();
