// Vaz Fitness v7 — calendário do ciclo completo + remanejamento semanal controlado pelo personal.
(function installCycleCalendarV7(){
  const TOKEN_KEY='vazFitness.authToken';
  const API_BASE=window.VAZ_API_BASE||'';
  const pad=n=>String(n).padStart(2,'0');
  const clone=v=>JSON.parse(JSON.stringify(v));
  const safe=v=>escapeHtml(v==null?'':String(v));
  let cursor=new Date();cursor=new Date(cursor.getFullYear(),cursor.getMonth(),1,12);
  let configLoading=false,lastConfigAt=0;

  function key(d){const x=d instanceof Date?d:new Date(d);return Number.isNaN(x.getTime())?'':`${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}`}
  function fromKey(v){const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?new Date(+m[1],+m[2]-1,+m[3],12):null}
  function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
  function weekStart(v){const d=v instanceof Date?new Date(v):fromKey(v)||new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d}
  function weekKey(v){return key(weekStart(v))}
  function cycle(){
    const c=state.trainingCycle||{},days=[30,45,60,90].includes(Number(c.days))?Number(c.days):30;
    let start=fromKey(String(c.startedAt||'').slice(0,10));if(!start)start=weekStart(new Date());
    let end=fromKey(String(c.endsAt||'').slice(0,10));if(!end)end=addDays(start,days-1);
    return {days,start,end,startedAt:key(start),endsAt:key(end)};
  }
  function inCycle(date){const c=cycle(),k=key(date);return k>=key(c.start)&&k<=key(c.end)}
  function sessionDate(s){return s?.localDate||key(s?.date||Date.now())}
  function skipDate(s){return s?.occurrenceDate||(/^\d{4}-\d{2}-\d{2}$/.test(String(s?.date||''))?s.date:key(s?.date))}
  function skipPlanId(s){return s?.planId||s?.id||''}
  function completed(date,planId){return [...(state.sessions||[]),...(state.runSessions||[])].some(s=>!s.extraWorkout&&sessionDate(s)===date&&(String(s.planId||'')===String(planId)||String(s.basePlanId||'')===String(planId)))}
  function skipped(date,planId){return (state.skipped||[]).some(s=>skipDate(s)===date&&String(skipPlanId(s))===String(planId))}
  function overrides(){return state.weekOverrides&&typeof state.weekOverrides==='object'?state.weekOverrides:{}}
  function baseWeekEntries(wk){
    const start=fromKey(wk),out=[];if(!start)return out;
    for(let i=0;i<7;i++){
      const d=addDays(start,i),dk=key(d);if(!inCycle(d))continue;
      (state.plan||[]).filter(p=>Number(p.day)===d.getDay()).forEach(p=>out.push({date:dk,sourceDate:null,mode:'base',plan:{...clone(p),status:'pending',basePlanId:p.basePlanId||p.id,_occurrenceDate:dk}}));
    }
    return out;
  }
  function weekEntries(wk){
    if(state.weekOverridesResetPending)return baseWeekEntries(wk);
    const o=overrides()[wk];
    if(o&&Array.isArray(o.entries))return o.entries.map(e=>({...clone(e),plan:{...clone(e.plan),status:'pending',basePlanId:e.plan?.basePlanId||e.plan?.id,_occurrenceDate:e.date}}));
    return baseWeekEntries(wk);
  }
  function entriesForDate(date){return weekEntries(weekKey(date)).filter(e=>e.date===date)}
  function occurrenceStatus(entry){
    const p=entry.plan||{},id=p.basePlanId||p.id,dk=entry.date;
    if(completed(dk,id))return 'done';
    if(skipped(dk,id)||entry.mode==='skipped')return 'skipped';
    return dk<key(new Date())?'missed':'pending';
  }
  function futureOccurrence(){
    const today=key(new Date()),c=cycle();
    for(let d=fromKey(today);d&&key(d)<=key(c.end);d=addDays(d,1)){
      const list=entriesForDate(key(d)).filter(e=>!['done','skipped','missed'].includes(occurrenceStatus(e)));
      if(list.length)return {...clone(list[0].plan),_occurrenceDate:list[0].date,_entryMode:list[0].mode,basePlanId:list[0].plan.basePlanId||list[0].plan.id};
    }
    return null;
  }

  async function remote(action,{method='GET',body=null}={}){
    const token=localStorage.getItem(TOKEN_KEY)||'';if(!token)throw new Error('auth');
    const u=new URL(`${API_BASE}/api/health`,location.origin);u.searchParams.set('scope','remap');u.searchParams.set('action',action);
    const r=await fetch(u.toString(),{method,headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:body?JSON.stringify(body):undefined});
    const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.message||'Falha de sincronização');return data;
  }
  async function syncConfig(force=false){
    if(configLoading||!localStorage.getItem(TOKEN_KEY)||(!force&&Date.now()-lastConfigAt<60000))return;
    configLoading=true;
    try{
      let acceptRemoteOverrides=true;
      if(state.weekOverridesResetPending){
        try{await remote('reset_overrides',{method:'POST',body:{reason:'rest_days_changed'}});state.weekOverridesResetPending=false;save();}
        catch{acceptRemoteOverrides=false}
      }
      const d=await remote('athlete_config');
      state.remapPolicy=d.policy||'ask';
      state.trainingCycle=d.cycle||state.trainingCycle||{days:30};
      state.weekOverrides=acceptRemoteOverrides?(d.weekOverrides||{}):{};
      state.remapRequests=d.requests||[];
      lastConfigAt=Date.now();save();if(activeView==='progress')render();
    }catch{}finally{configLoading=false}
  }

  function maxConsecutive(dateKeys){
    const s=new Set(dateKeys),arr=[...s].sort();let best=0,run=0,prev=null;
    arr.forEach(k=>{const d=fromKey(k);if(prev&&Math.round((d-prev)/86400000)===1)run++;else run=1;best=Math.max(best,run);prev=d});return best;
  }
  function buildProposal(plan,skippedDate){
    const wk=weekKey(skippedDate),entries=baseWeekEntries(wk).filter(e=>!(e.date===skippedDate&&String(e.plan.basePlanId||e.plan.id)===String(plan.basePlanId||plan.id)));
    const today=key(new Date()),start=fromKey(wk),occupied=new Set(entries.map(e=>e.date));
    const restDays=new Set((state.profile?.restDays||[]).map(Number));
    const candidates=[];for(let i=0;i<7;i++){const d=addDays(start,i),dk=key(d);if(!inCycle(d)||dk<today||dk===skippedDate||occupied.has(dk)||restDays.has(d.getDay()))continue;candidates.push(dk)}
    candidates.sort((a,b)=>{const aa=a>=skippedDate?0:1,bb=b>=skippedDate?0:1;return aa-bb||a.localeCompare(b)});
    const trainingDates=entries.map(e=>e.date);
    const free=candidates.find(d=>maxConsecutive([...trainingDates,d])<=3);
    if(free){
      const moved={...clone(plan),status:'pending',basePlanId:plan.basePlanId||plan.id,_occurrenceDate:free,remappedFrom:skippedDate};
      const out=[...entries,{date:free,sourceDate:skippedDate,mode:'move',plan:moved,note:'Treino movido inteiro para preservar volume e recuperação.'}].sort((a,b)=>a.date.localeCompare(b.date));
      return {weekKey:wk,skippedDate,summary:`AION sugere mover ${plan.name} para ${new Date(free+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit'})}, sem duplicar treino no mesmo dia.`,entries:out,safe:true,coverageComplete:true};
    }
    if(plan.type==='strength'){
      const targets=entries.filter(e=>e.plan?.type==='strength'&&e.date!==skippedDate&&e.date>=today).map(e=>clone(e));
      const unique=[];for(const ex of plan.exercises||[]){if(ex.muscle&&!unique.some(x=>x.muscle===ex.muscle))unique.push(ex)}
      let assigned=0;
      unique.forEach(ex=>{
        const t=targets.filter(x=>(x.plan.exercises||[]).length<8).sort((a,b)=>(a.plan.exercises||[]).length-(b.plan.exercises||[]).length)[0];if(!t)return;
        t.plan.exercises=[...(t.plan.exercises||[]),{...clone(ex),remapSupplement:true}];t.plan.duration=Math.min(90,Number(t.plan.duration||60)+8);t.mode='supplement';t.note='Complemento AION para manter cobertura muscular sem repetir o treino completo.';assigned++;
      });
      const map=new Map(targets.map(x=>[`${x.date}:${x.plan.basePlanId||x.plan.id}`,x]));
      const out=entries.map(e=>map.get(`${e.date}:${e.plan.basePlanId||e.plan.id}`)||e);
      const complete=assigned===unique.length&&unique.length>0;
      return {weekKey:wk,skippedDate,summary:complete?'AION reduziu o volume perdido a complementos curtos nos outros treinos, mantendo ao menos um estímulo por grupo muscular sem empilhar dois treinos completos.':'Não encontrei espaço seguro para cobrir todos os grupos musculares nesta semana. A sugestão precisa da revisão do personal.',entries:out,safe:complete,coverageComplete:complete};
    }
    return {weekKey:wk,skippedDate,summary:'Não encontrei um dia livre seguro para mover esta corrida. O personal precisa revisar a semana.',entries:[...entries,{date:skippedDate,sourceDate:skippedDate,mode:'move',plan:{...clone(plan),basePlanId:plan.basePlanId||plan.id},note:'Sem data segura automática — alterar antes de aprovar.'}],safe:false,coverageComplete:false};
  }

  async function skipOccurrence(plan,date){
    if(!plan||!date)return;const id=plan.basePlanId||plan.id;
    if(completed(date,id)){toast('Este treino já foi concluído.');return}
    if(!confirm(`Marcar ${plan.name} de ${new Date(date+'T12:00:00').toLocaleDateString('pt-BR')} como indisponível?`))return;
    state.skipped=Array.isArray(state.skipped)?state.skipped:[];
    if(!skipped(date,id))state.skipped.push({id,planId:id,name:plan.name,date,occurrenceDate:date,occurrenceOnly:true,createdAt:new Date().toISOString()});
    const proposal=buildProposal(plan,date);save();render();
    try{
      const d=await remote('request',{method:'POST',body:{workoutName:plan.name,reason:'Aluno informou que não conseguirá treinar na data planejada.',proposal}});state.remapPolicy=d.policy||state.remapPolicy||'ask';state.remapRequests=[...(state.remapRequests||[]).filter(x=>x.id!==d.request?.id),...(d.request?[d.request]:[])];if(d.weekOverrides)state.weekOverrides=d.weekOverrides;save();render();
      if(d.applied)toast('AION remanejou somente esta semana, preservando as demais.');else if(d.status==='pending')toast('Sugestão enviada ao seu personal para aprovação.');else if(d.status==='blocked')toast('Seu personal não permite remanejamento automático. A falta foi registrada.');
    }catch{toast('Falta registrada. O remanejamento será sincronizado quando houver conexão.')}
  }

  const priorToday=todaysItem;
  todaysItem=function(){return futureOccurrence()||priorToday()};

  const priorSkip=skipItem;
  skipItem=function(id){const occ=todaysItem(),plan=occ&&String(occ.id)===String(id)?occ:(state.plan||[]).find(x=>String(x.id)===String(id));const date=occ?occ._occurrenceDate:key(new Date());skipOccurrence(plan,date)};

  const priorStart=startItem;
  startItem=function(id){
    const occ=todaysItem();if(!occ||String(occ.id)!==String(id))return priorStart(id);
    const date=occ._occurrenceDate||key(new Date());if(date!==key(new Date())){toast(`Este treino está programado para ${new Date(date+'T12:00:00').toLocaleDateString('pt-BR')}.`);return}
    if(occ.type==='run'){occ.scheduledDate=date;startRun(occ);return}
    state.current={planId:occ.basePlanId||occ.id,occurrenceDate:date,startedAt:Date.now(),exercises:(occ.exercises||[]).map(e=>({...clone(e),completedSets:[],effort:null})),currentIndex:0};currentExerciseIndex=0;seconds=0;save();activeView='workout';startTimer();render();
  };

  const priorFinish=finishWorkout;
  finishWorkout=function(){const occDate=state.current?.occurrenceDate||key(new Date()),planId=state.current?.planId||null;priorFinish();const s=state.sessions?.at(-1);if(s){s.localDate=occDate;s.planId=planId;s.basePlanId=planId}const base=(state.plan||[]).find(p=>String(p.id)===String(planId));if(base)base.status='pending';save()};
  if(typeof finishRunSession==='function'){
    const priorRunFinish=finishRunSession;
    finishRunSession=function(){const before=(state.runSessions||[]).length,occ=todaysItem(),date=occ?._occurrenceDate||key(new Date()),pid=occ?.basePlanId||occ?.id||null;priorRunFinish();if((state.runSessions||[]).length>before){const s=state.runSessions.at(-1);s.localDate=date;s.planId=s.planId||pid;s.basePlanId=pid;const base=(state.plan||[]).find(p=>String(p.id)===String(pid));if(base)base.status='pending';save()}};
  }

  function eventForEntry(e){const p=e.plan||{},status=occurrenceStatus(e);return {date:e.date,plan:p,planId:p.basePlanId||p.id,name:p.name,type:p.type,status,kind:'planned',mode:e.mode,note:e.note||''}}
  function monthEvents(){
    const y=cursor.getFullYear(),m=cursor.getMonth(),prefix=`${y}-${pad(m+1)}-`,out=[];
    const c=cycle();for(let d=new Date(c.start);key(d)<=key(c.end);d=addDays(d,1)){const dk=key(d);if(!dk.startsWith(prefix))continue;entriesForDate(dk).forEach(e=>out.push(eventForEntry(e)))}
    (state.skipped||[]).forEach(s=>{const dk=skipDate(s);if(!dk?.startsWith(prefix))return;const pid=skipPlanId(s);if(out.some(e=>e.date===dk&&String(e.planId)===String(pid)))return;const p=(state.plan||[]).find(x=>String(x.id)===String(pid));if(p)out.push({date:dk,plan:p,planId:pid,name:p.name,type:p.type,status:'skipped',kind:'planned',mode:'skipped'})});
    [...(state.sessions||[]),...(state.runSessions||[])].forEach(s=>{const dk=sessionDate(s);if(!dk.startsWith(prefix)||(s.planId&&!s.extraWorkout))return;out.push({date:dk,plan:s,planId:null,name:s.name||'Atividade adicional',type:s.distance!=null?'run':'strength',status:'additional',kind:'additional'})});
    return out;
  }
  function dayTone(events){if(events.some(e=>['missed','skipped'].includes(e.status)))return 'missed';const planned=events.filter(e=>e.kind==='planned');if(planned.length&&planned.every(e=>e.status==='done'))return 'done';if(planned.some(e=>e.status==='pending'))return 'planned';if(events.some(e=>e.status==='additional'))return 'additional';return ''}
  function shortLabel(e){if(e.status==='done')return '✓';if(['missed','skipped'].includes(e.status))return '×';if(e.status==='additional')return '+';return e.plan?.splitLetter||'•'}
  function renderCycleCalendar(){
    const events=monthEvents(),y=cursor.getFullYear(),m=cursor.getMonth(),first=new Date(y,m,1,12),count=new Date(y,m+1,0,12).getDate(),offset=(first.getDay()+6)%7,c=cycle(),cells=[];
    for(let i=0;i<offset;i++)cells.push('<div class="cycle-day empty"></div>');
    for(let d=1;d<=count;d++){
      const dk=`${y}-${pad(m+1)}-${pad(d)}`,list=events.filter(e=>e.date===dk),tone=dayTone(list),inside=dk>=key(c.start)&&dk<=key(c.end),today=dk===key(new Date());
      const weekday=new Date(y,m,d,12).getDay(),restDay=inside&&(state.profile?.restDays||[]).map(Number).includes(weekday);
      cells.push(`<button class="cycle-day ${tone?`tone-${tone}`:''} ${today?'today':''} ${inside?'in-cycle':'out-cycle'}" data-cycle-date="${dk}" ${!list.length?'aria-label="Sem treino neste dia"':''}><span class="cycle-number">${d}</span>${list.length?`<div class="cycle-marks">${list.slice(0,4).map(e=>`<span title="${safe(e.name)}">${shortLabel(e)}</span>`).join('')}</div><small>${list.length===1?safe(list[0].name):`${list.length} atividades`}</small>`:`<small class="rest-label">${inside?(restDay?'Descanso':'Sem treino'):''}</small>`}</button>`);
    }
    const title=cursor.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}),daysLeft=Math.max(0,Math.ceil((c.end-new Date())/86400000));
    return `<section class="card monthly-calendar-card cycle-calendar-v7"><div class="calendar-head"><div><span class="eyebrow">CICLO DE ${c.days} DIAS</span><h2>${title.charAt(0).toUpperCase()+title.slice(1)}</h2><p>Todo o ciclo fica visível. Alterações por falta afetam somente a semana correspondente.</p></div><div class="calendar-nav"><button class="icon-btn" data-cycle-prev>‹</button><button class="calendar-today-btn" data-cycle-today>Hoje</button><button class="icon-btn" data-cycle-next>›</button></div></div><div class="cycle-summary"><span><b>${c.startedAt}</b> início</span><span><b>${c.endsAt}</b> fim</span><span><b>${daysLeft}</b> dias restantes</span><span><b>${state.remapPolicy==='auto'?'Automático':state.remapPolicy==='off'?'Desligado':'Com aprovação'}</b> remanejamento</span></div><div class="calendar-weekdays"><span>SEG</span><span>TER</span><span>QUA</span><span>QUI</span><span>SEX</span><span>SÁB</span><span>DOM</span></div><div class="calendar-grid cycle-grid">${cells.join('')}</div><div class="calendar-legend"><span><i class="done"></i>Concluído</span><span><i class="planned"></i>Planejado</span><span><i class="missed"></i>Falta</span><span><i class="additional"></i>Extra</span></div></section>`;
  }
  function openDay(date){
    const events=monthEvents().filter(e=>e.date===date);const d=document.createElement('dialog');d.className='dialog cycle-day-dialog';
    const title=new Date(date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});
    d.innerHTML=`<div class="cycle-day-sheet"><div class="media-head"><div><span class="eyebrow">RESUMO DO DIA</span><h2>${title}</h2><p>${events.length?`${events.length} atividade(s) programada(s)`:'Dia de descanso / sem treino programado'}</p></div><button class="media-close" data-close-day>✕</button></div>${events.map((e,i)=>{const p=e.plan||{},strength=e.type==='strength',muscles=[...new Set((p.exercises||[]).map(x=>muscleNames[x.muscle]||x.muscle).filter(Boolean))];return `<article class="cycle-summary-card ${e.status}"><div class="cycle-summary-head"><div><strong>${safe(e.name)}</strong><small>${e.status==='done'?'Concluído':e.status==='skipped'?'Falta registrada':e.status==='missed'?'Não realizado':e.status==='additional'?'Atividade extra':'Planejado'}${e.mode==='move'?' • remanejado pela AION':e.mode==='supplement'?' • ajustado pela AION':''}</small></div><span>${p.splitLetter?safe(p.splitLetter):strength?'FORÇA':'CORRIDA'}</span></div><p>${strength?`${(p.exercises||[]).length} exercícios • ${Number(p.duration)||60} min${muscles.length?` • ${safe(muscles.join(', '))}`:''}`:`${Number(p.duration)||0} min • ${safe(p.pace||p.intensity||'ritmo orientado')}`}</p>${strength&&p.exercises?.length?`<div class="cycle-ex-list">${p.exercises.slice(0,8).map(x=>`<span>${safe(x.name)}</span>`).join('')}</div>`:''}${e.note?`<small class="cycle-note">${safe(e.note)}</small>`:''}${e.kind==='planned'&&e.status==='pending'?`<button class="btn ghost" data-unavailable="${i}">Não vou conseguir treinar neste dia</button>`:''}</article>`}).join('')||'<div class="coach-chart-empty">Aproveite o descanso e a recuperação.</div>'}</div>`;
    document.body.appendChild(d);d.showModal();d.querySelector('[data-close-day]').onclick=()=>{d.close();d.remove()};d.querySelectorAll('[data-unavailable]').forEach(b=>b.onclick=()=>{const e=events[+b.dataset.unavailable];d.close();d.remove();skipOccurrence({...clone(e.plan),basePlanId:e.planId},date)});d.addEventListener('close',()=>d.remove(),{once:true});
  }

  const priorRenderProgress=renderProgress;
  renderProgress=function(){let html=priorRenderProgress();html=html.replace(/<section class="card monthly-calendar-card[\s\S]*?<\/section>/,'');return `${html}${renderCycleCalendar()}`};
  const priorBind=bindDynamic;
  bindDynamic=function(){priorBind();document.querySelector('[data-cycle-prev]')?.addEventListener('click',()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1,12);render()});document.querySelector('[data-cycle-next]')?.addEventListener('click',()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1,12);render()});document.querySelector('[data-cycle-today]')?.addEventListener('click',()=>{const n=new Date();cursor=new Date(n.getFullYear(),n.getMonth(),1,12);render()});document.querySelectorAll('[data-cycle-date]').forEach(b=>b.onclick=()=>openDay(b.dataset.cycleDate));syncConfig(false)};

  const style=document.createElement('style');style.textContent=`
    .cycle-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}.cycle-summary span{background:#fafafa;border:1px solid var(--line);border-radius:14px;padding:10px;font-size:9px;color:var(--muted)}.cycle-summary b{display:block;color:#222;font-size:12px;margin-bottom:2px}.cycle-day{min-height:92px;border:1px solid var(--line);border-radius:16px;padding:8px;background:#fff;text-align:left;font:inherit;position:relative;overflow:hidden;transition:.18s;cursor:pointer}.cycle-day.empty{visibility:hidden}.cycle-day.out-cycle{opacity:.32}.cycle-day.today{box-shadow:inset 0 0 0 3px #111}.cycle-day.tone-planned{background:#fff3a8;border-color:#dfbd1c}.cycle-day.tone-done{background:#dff5e6;border-color:#68ba80}.cycle-day.tone-missed{background:#ffe0dd;border-color:#df736a}.cycle-day.tone-additional{background:#dfe9ff;border-color:#7294dc}.cycle-number{font-size:13px;font-weight:950}.cycle-marks{display:flex;gap:4px;position:absolute;right:7px;top:7px}.cycle-marks span{width:19px;height:19px;border-radius:7px;background:rgba(255,255,255,.72);display:grid;place-items:center;font-size:9px;font-weight:950}.cycle-day>small{display:block;margin-top:28px;font-size:8px;font-weight:800;line-height:1.25;color:#302b17}.cycle-day .rest-label{color:var(--muted);font-weight:600}.cycle-day-dialog{width:min(680px,calc(100% - 18px));max-height:92dvh;padding:0}.cycle-day-sheet{padding:22px}.cycle-summary-card{border:1px solid var(--line);border-radius:18px;padding:15px;margin-top:10px;background:#fff}.cycle-summary-card.done{background:#f4fff7}.cycle-summary-card.skipped,.cycle-summary-card.missed{background:#fff7f6}.cycle-summary-head{display:flex;justify-content:space-between;gap:12px}.cycle-summary-head strong,.cycle-summary-head small{display:block}.cycle-summary-head small{font-size:10px;color:var(--muted);margin-top:3px}.cycle-summary-head>span{font-size:9px;font-weight:900;background:#191919;color:#fff;border-radius:999px;padding:6px 8px;height:max-content}.cycle-summary-card p{font-size:11px;color:var(--muted)}.cycle-ex-list{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0}.cycle-ex-list span{font-size:9px;background:#f4f4f4;border-radius:999px;padding:5px 8px}.cycle-note{display:block;color:#806a00;margin:8px 0}.cycle-summary-card .btn{margin-top:8px}@media(max-width:680px){.cycle-summary{grid-template-columns:1fr 1fr}.cycle-day{min-height:74px;padding:6px}.cycle-day>small{margin-top:22px;font-size:7px}.cycle-marks span{width:16px;height:16px}.cycle-grid{gap:4px}}
  `;document.head.appendChild(style);

  state.remapPolicy=state.remapPolicy||'ask';state.weekOverrides=state.weekOverrides||{};state.remapRequests=state.remapRequests||[];state.trainingCycle=state.trainingCycle||{days:30};save();setTimeout(()=>syncConfig(true),700);
})();
