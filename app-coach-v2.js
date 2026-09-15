// Vaz Fitness — Coach V2: metas, prontidão, evolução corporal, AION analista e UX avançada.
(function installCoachV2(){
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
  const pad=n=>String(n).padStart(2,'0');
  const todayKey=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
  const safe=v=>escapeHtml(v==null?'':String(v));
  const modeLabel={hybrid:'Híbrido',strength:'Musculação',run:'Corrida'};

  state.bodyMeasurements=Array.isArray(state.bodyMeasurements)?state.bodyMeasurements:[];
  state.readinessCheckins=Array.isArray(state.readinessCheckins)?state.readinessCheckins:[];
  state.goals=state.goals||{};
  state.progressAnalysis=state.progressAnalysis||null;
  if(!state.bodyMeasurements.length&&Number(state.profile?.weight)>0){
    state.bodyMeasurements.push({id:`initial-${Date.now()}`,date:todayKey(),weight:Number(state.profile.weight),source:'onboarding'});
  }
  if(!state.goals.weeklySessions)state.goals.weeklySessions=Number(state.profile?.days)||4;
  if(state.profile?.mode!=='strength'&&!state.goals.monthlyRunKm){
    state.goals.monthlyRunKm=state.profile?.goal==='42k'?100:state.profile?.goal==='21k'?70:state.profile?.goal==='10k'?45:30;
  }
  save();

  function parsePace(value){
    const m=String(value||'').trim().match(/^(\d{1,2}):(\d{1,2})$/);if(!m)return null;
    const sec=Number(m[1])*60+Number(m[2]);return sec>0?sec:null;
  }
  function paceText(sec){if(!Number.isFinite(sec)||sec<=0)return '—';const m=Math.floor(sec/60),s=Math.round(sec%60);return `${m}:${String(s===60?0:s).padStart(2,'0')}`;}
  function dateOfSession(s){
    if(s?.localDate)return s.localDate;
    const d=new Date(s?.date||0);if(Number.isNaN(d.getTime()))return '';
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function currentWeekBounds(){
    const d=new Date();d.setHours(12,0,0,0);const monday=new Date(d);monday.setDate(d.getDate()-((d.getDay()+6)%7));
    const sunday=new Date(monday);sunday.setDate(monday.getDate()+6);
    const key=x=>`${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}`;
    return [key(monday),key(sunday)];
  }
  function currentMonthPrefix(){const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-`;}
  function completedThisWeek(){
    const [a,b]=currentWeekBounds();
    const all=[...(state.sessions||[]),...(state.runSessions||[])];
    return all.filter(s=>{const k=dateOfSession(s);return k>=a&&k<=b;}).length;
  }
  function monthRunKm(){const p=currentMonthPrefix();return (state.runSessions||[]).filter(r=>dateOfSession(r).startsWith(p)).reduce((sum,r)=>sum+(Number(r.distance)||0),0);}
  function latestWeight(){return Number(state.bodyMeasurements.at(-1)?.weight||state.profile?.weight||0)||null;}
  function initialWeight(){return Number(state.bodyMeasurements[0]?.weight||state.profile?.weight||0)||null;}
  function bestExerciseLoad(exId){
    let best=0;
    (state.sessions||[]).forEach(s=>(s.exercises||[]).forEach(ex=>{
      if(ex.id!==exId)return;(ex.completedSets||[]).forEach(set=>best=Math.max(best,Number(set.load)||0));
    }));
    return best;
  }
  function recentBestPace(){
    const vals=(state.runSessions||[]).slice(-12).map(r=>parsePace(r.pace)).filter(Boolean);
    return vals.length?Math.min(...vals):null;
  }
  function currentMonthConsistency(){
    window.VazCalendar?.reconcile?.();
    const p=currentMonthPrefix();const events=(state.calendarEvents||[]).filter(e=>e.date?.startsWith(p)&&e.kind==='planned');
    const done=events.filter(e=>e.status==='done').length;
    const missed=events.filter(e=>['missed','skipped','abandoned'].includes(e.status)).length;
    return done+missed?Math.round(done/(done+missed)*100):100;
  }

  function progressPct(value,target,direction='up',start=null){
    if(!Number.isFinite(value)||!Number.isFinite(target)||target<=0)return null;
    if(direction==='up')return clamp(value/target*100,0,100);
    if(!Number.isFinite(start)||start===target)return null;
    return clamp((start-value)/(start-target)*100,0,100);
  }
  function goalMetrics(){
    const g=state.goals||{},p=state.profile||{};
    const weekly=completedThisWeek(),weekTarget=Number(g.weeklySessions)||Number(p.days)||4;
    const monthKm=monthRunKm(),kmTarget=Number(g.monthlyRunKm)||0;
    const w0=initialWeight(),w=latestWeight(),wt=Number(g.targetWeight)||null;
    const paceNow=recentBestPace(),paceStart=parsePace(g.initialPace||p.easyPace),paceTarget=parsePace(g.targetPace);
    const exId=g.strengthExercise||null,bestLoad=exId?bestExerciseLoad(exId):0,targetLoad=Number(g.strengthLoad)||0;
    return {
      weekly:{value:weekly,target:weekTarget,pct:progressPct(weekly,weekTarget)},
      runKm:{value:monthKm,target:kmTarget,pct:kmTarget?progressPct(monthKm,kmTarget):null},
      weight:{initial:w0,current:w,target:wt,pct:(w0&&w&&wt)?progressPct(w,wt,'down',w0):null},
      pace:{initial:paceStart,current:paceNow,target:paceTarget,pct:(paceStart&&paceNow&&paceTarget)?progressPct(paceNow,paceTarget,'down',paceStart):null},
      strength:{exerciseId:exId,current:bestLoad,target:targetLoad,pct:targetLoad?progressPct(bestLoad,targetLoad):null},
      consistency:currentMonthConsistency()
    };
  }
  function goalProgressHtml(label,value,pct,sub=''){
    const p=Number.isFinite(pct)?Math.round(pct):null;
    return `<div class="goal-progress-row"><div class="goal-progress-copy"><strong>${safe(label)}</strong><span>${safe(value)}${sub?` • ${safe(sub)}`:''}</span></div><div class="goal-progress-right"><strong>${p==null?'—':`${p}%`}</strong><div class="goal-track"><span style="width:${p==null?0:p}%"></span></div></div></div>`;
  }
  function strengthExerciseName(id){return exerciseLibrary.find(e=>e.id===id)?.name||'Exercício';}
  function metricsSummary(){
    const m=goalMetrics(),p=state.profile||{};
    const rows=[];
    rows.push(goalProgressHtml('Treinos da semana',`${m.weekly.value}/${m.weekly.target}`,m.weekly.pct,'frequência'));
    if(p.mode!=='strength'&&m.runKm.target)rows.push(goalProgressHtml('Distância no mês',`${m.runKm.value.toFixed(1)} / ${m.runKm.target} km`,m.runKm.pct,'corrida'));
    if(m.weight.target&&m.weight.current)rows.push(goalProgressHtml('Peso-alvo',`${m.weight.current.toFixed(1)} → ${m.weight.target.toFixed(1)} kg`,m.weight.pct,`início ${m.weight.initial?.toFixed(1)||'—'} kg`));
    if(p.mode!=='strength'&&m.pace.target)rows.push(goalProgressHtml('Pace-alvo',`${paceText(m.pace.current)} → ${paceText(m.pace.target)}/km`,m.pace.pct,'melhor recente'));
    if(p.mode!=='run'&&m.strength.target)rows.push(goalProgressHtml(`Carga-alvo • ${strengthExerciseName(m.strength.exerciseId)}`,`${m.strength.current} → ${m.strength.target} kg`,m.strength.pct,'maior carga'));
    return rows.join('');
  }

  function sparkline(values,{suffix='',invert=false}={}){
    const nums=values.map(Number).filter(Number.isFinite);if(nums.length<2)return '<div class="coach-chart-empty">Registre mais dados para formar a tendência.</div>';
    const w=320,h=90,p=8,min=Math.min(...nums),max=Math.max(...nums),span=Math.max(0.001,max-min);
    const points=nums.map((v,i)=>{const x=p+(w-p*2)*(i/(nums.length-1));let norm=(v-min)/span;if(invert)norm=1-norm;const y=h-p-(h-p*2)*norm;return `${x.toFixed(1)},${y.toFixed(1)}`;}).join(' ');
    const last=points.split(' ').at(-1).split(',');
    return `<svg class="coach-sparkline" viewBox="0 0 ${w} ${h}" role="img" aria-label="Tendência"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${last[0]}" cy="${last[1]}" r="5" fill="currentColor"/></svg><div class="coach-chart-range"><span>${nums[0].toFixed(1)}${suffix}</span><strong>${nums.at(-1).toFixed(1)}${suffix}</strong></div>`;
  }
  function bars(values,labels){
    const nums=values.map(v=>Math.max(0,Number(v)||0));const max=Math.max(1,...nums);
    return `<div class="coach-bars">${nums.map((v,i)=>`<div class="coach-bar-col"><div class="coach-bar"><span style="height:${Math.max(5,v/max*100)}%"></span></div><small>${safe(labels[i]||'')}</small></div>`).join('')}</div>`;
  }

  function bodyCard(){
    const vals=state.bodyMeasurements.slice(-10);const latest=vals.at(-1);
    return `<div class="card coach-body-card"><div class="card-head"><div><h2>Evolução corporal</h2><p>Peso e medidas registrados ao longo do tempo</p></div><button class="btn ghost compact" data-body-register>+ Registrar</button></div>
      <div class="coach-body-grid"><div><span>Peso atual</span><strong>${latest?.weight?`${Number(latest.weight).toFixed(1)} kg`:'—'}</strong></div><div><span>Cintura</span><strong>${latest?.waist?`${Number(latest.waist).toFixed(1)} cm`:'—'}</strong></div><div><span>Gordura</span><strong>${latest?.bodyFat?`${Number(latest.bodyFat).toFixed(1)}%`:'—'}</strong></div></div>
      <div class="coach-chart-card">${sparkline(vals.map(x=>x.weight),{suffix:' kg',invert:true})}</div></div>`;
  }
  function strengthTrendCard(){
    const sessions=(state.sessions||[]).slice(-8);return `<div class="card"><div class="card-head"><div><h2>Volume de força</h2><p>Últimos treinos de musculação</p></div></div>${sessions.length?bars(sessions.map(s=>s.volume||0),sessions.map(s=>new Date(s.date).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}))):'<div class="coach-chart-empty">Conclua treinos para visualizar o volume.</div>'}</div>`;
  }
  function runTrendCard(){
    const runs=(state.runSessions||[]).slice(-8);const pace=runs.map(r=>parsePace(r.pace)).filter(Boolean);
    return `<div class="card"><div class="card-head"><div><h2>Evolução na corrida</h2><p>Distância e pace das sessões recentes</p></div></div>${runs.length?`${bars(runs.map(r=>r.distance||0),runs.map(r=>new Date(r.date).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})))}<div class="run-pace-line"><span>Melhor pace recente</span><strong>${pace.length?`${paceText(Math.min(...pace))}/km`:'—'}</strong></div>`:'<div class="coach-chart-empty">Registre corridas para visualizar a evolução.</div>'}</div>`;
  }
  function aionProgressCard(){
    const a=state.progressAnalysis;
    return `<div class="card aion-card coach-aion-progress"><div class="card-head"><div><h2>AION • análise da evolução</h2><p>Compara seus dados com objetivos e histórico</p></div><span class="pill">GEMINI</span></div>
      <div class="coach-aion-text">${a?.text?safe(a.text).replace(/\n/g,'<br>'):'A AION já tem acesso ao seu histórico recente. Toque abaixo para gerar uma leitura completa da sua evolução e da distância para suas metas.'}</div>
      ${a?.createdAt?`<small class="coach-analysis-date">Atualizada ${new Date(a.createdAt).toLocaleString('pt-BR')}</small>`:''}
      <div class="hero-actions"><button class="btn dark" data-analyze-progress ${a?.pending?'disabled':''}>${a?.pending?'Analisando…':'Analisar minha evolução'}</button><button class="btn ghost" data-goals-edit>Editar metas</button></div></div>`;
  }
  function coachEvolutionHtml(){
    const m=goalMetrics();
    return `<section class="coach-evolution-section"><div class="card coach-goals-card"><div class="card-head"><div><h2>Distância para seus objetivos</h2><p>Indicadores objetivos; sem percentuais inventados</p></div><button class="btn ghost compact" data-goals-edit>Editar metas</button></div><div class="goal-progress-list">${metricsSummary()}</div><div class="coach-consistency"><span>Consistência no mês</span><strong>${m.consistency}%</strong></div></div>
      <div class="grid two" style="margin-top:18px">${bodyCard()}${strengthTrendCard()}</div>
      ${state.profile?.mode!=='strength'?`<div style="margin-top:18px">${runTrendCard()}</div>`:''}
      <div style="margin-top:18px">${aionProgressCard()}</div></section>`;
  }

  const previousRenderProgress=renderProgress;
  renderProgress=function(){return `${previousRenderProgress()}${coachEvolutionHtml()}`;};

  function homeFocusHtml(){
    const t=todaysItem(),m=goalMetrics(),check=todaysCheckin();
    return `<section class="coach-home-focus"><div class="card coach-today-card"><div class="card-head"><div><span class="eyebrow">HOJE EM FOCO</span><h2>${t?safe(t.name):'Dia livre / recuperação'}</h2><p>${t?t.type==='run'?`${t.duration} min • ${safe(t.pace)}/km • ${safe(t.intensity)}`:`${t.exercises?.length||0} exercícios • até ${t.duration} min`:'Sem treino planejado pendente para hoje.'}</p></div><span class="coach-readiness ${check?'done':''}">${check?`${check.score}% prontidão`:'Check-in pendente'}</span></div>
      <div class="coach-home-actions">${t?`<button class="btn primary" data-start="${safe(t.id)}">▶ Iniciar treino</button>`:''}${state.profile?.mode!=='strength'?'<button class="btn white" data-extra-run>+ Corrida adicional</button>':''}<button class="btn ghost" data-readiness-open>${check?'Ver check-in':'Fazer check-in'}</button></div></div>
      <div class="coach-home-mini"><div><span>Semana</span><strong>${m.weekly.value}/${m.weekly.target}</strong><small>treinos</small></div><div><span>Consistência</span><strong>${m.consistency}%</strong><small>mês atual</small></div><div><span>Corrida</span><strong>${m.runKm.value.toFixed(1)} km</strong><small>neste mês</small></div><div><span>Peso</span><strong>${m.weight.current?`${m.weight.current.toFixed(1)} kg`:'—'}</strong><small>último registro</small></div></div></section>`;
  }
  const previousRenderHome=renderHome;
  renderHome=function(){
    const html=previousRenderHome();
    const firstEnd=html.indexOf('</section>');
    return firstEnd>=0?html.slice(0,firstEnd+10)+homeFocusHtml()+html.slice(firstEnd+10):html+homeFocusHtml();
  };

  function profileCoachCards(){
    const g=state.goals||{};
    return `<div class="card"><div class="card-head"><div><h2>Metas pessoais</h2><p>A AION usa estas metas para medir sua evolução</p></div><button class="btn ghost compact" data-goals-edit>Editar</button></div><div class="coach-profile-goals"><div><span>Treinos/semana</span><strong>${g.weeklySessions||state.profile.days||'—'}</strong></div><div><span>Peso-alvo</span><strong>${g.targetWeight?`${g.targetWeight} kg`:'—'}</strong></div><div><span>Km/mês</span><strong>${state.profile.mode!=='strength'&&g.monthlyRunKm?`${g.monthlyRunKm} km`:'—'}</strong></div><div><span>Pace-alvo</span><strong>${g.targetPace?`${safe(g.targetPace)}/km`:'—'}</strong></div></div></div>${bodyCard()}`;
  }
  const previousRenderProfile=renderProfile;
  renderProfile=function(){return previousRenderProfile().replace(/<\/section>\s*$/,`${profileCoachCards()}</section>`);};

  function makeDialog(id){let d=document.getElementById(id);if(d)return d;d=document.createElement('dialog');d.id=id;d.className='dialog coach-dialog';document.body.appendChild(d);return d;}
  const goalDialog=makeDialog('coachGoalDialog');
  const bodyDialog=makeDialog('coachBodyDialog');
  const readinessDialog=makeDialog('coachReadinessDialog');
  const substituteDialog=makeDialog('coachSubstituteDialog');

  function openGoalDialog(){
    const g=state.goals||{},p=state.profile||{};
    goalDialog.innerHTML=`<form class="coach-dialog-sheet" data-goal-form><div class="coach-dialog-head"><div><span class="eyebrow">METAS</span><h2>Defina objetivos mensuráveis</h2><p>A AION usa estes valores para dizer exatamente o quanto falta.</p></div><button type="button" class="training-detail-close" data-close>✕</button></div>
      <div class="field-row"><label>Treinos por semana<input name="weeklySessions" type="number" min="1" max="7" value="${Number(g.weeklySessions)||Number(p.days)||4}"></label><label>Peso-alvo (kg)<input name="targetWeight" type="number" min="30" max="350" step="0.1" value="${g.targetWeight||''}" placeholder="Opcional"></label></div>
      ${p.mode!=='strength'?`<div class="field-row"><label>Corrida no mês (km)<input name="monthlyRunKm" type="number" min="1" max="1000" step="1" value="${g.monthlyRunKm||''}"></label><label>Pace-alvo (min/km)<input name="targetPace" type="text" inputmode="decimal" value="${safe(g.targetPace||'')}" placeholder="Ex.: 4:30"></label></div>`:''}
      ${p.mode!=='run'?`<div class="field-row"><label>Exercício de referência<select name="strengthExercise"><option value="">Sem meta específica</option>${exerciseLibrary.map(ex=>`<option value="${ex.id}" ${g.strengthExercise===ex.id?'selected':''}>${safe(ex.name)}</option>`).join('')}</select></label><label>Carga-alvo (kg)<input name="strengthLoad" type="number" min="0" max="1000" step="0.5" value="${g.strengthLoad||''}" placeholder="Opcional"></label></div>`:''}
      <div class="dialog-actions"><button type="button" class="btn ghost" data-close>Cancelar</button><button class="btn primary">Salvar metas</button></div></form>`;
    goalDialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>goalDialog.close());
    goalDialog.querySelector('[data-goal-form]').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.currentTarget);state.goals={...state.goals,weeklySessions:clamp(fd.get('weeklySessions'),1,7),targetWeight:Number(fd.get('targetWeight'))||null,monthlyRunKm:Number(fd.get('monthlyRunKm'))||null,targetPace:String(fd.get('targetPace')||'').trim()||null,strengthExercise:String(fd.get('strengthExercise')||'')||null,strengthLoad:Number(fd.get('strengthLoad'))||null,initialPace:state.goals.initialPace||state.profile.easyPace};save();goalDialog.close();render();toast('Metas atualizadas.');};
    goalDialog.showModal();
  }
  function openBodyDialog(){
    const last=state.bodyMeasurements.at(-1)||{};
    bodyDialog.innerHTML=`<form class="coach-dialog-sheet" data-body-form><div class="coach-dialog-head"><div><span class="eyebrow">EVOLUÇÃO CORPORAL</span><h2>Novo registro</h2><p>Use sempre condições parecidas de medição para acompanhar tendências.</p></div><button type="button" class="training-detail-close" data-close>✕</button></div><div class="field-row"><label>Peso (kg)<input name="weight" type="number" min="30" max="350" step="0.1" value="${last.weight||state.profile.weight||''}" required></label><label>Cintura (cm)<input name="waist" type="number" min="30" max="250" step="0.1" value="${last.waist||''}" placeholder="Opcional"></label></div><label>Gordura corporal (%)<input name="bodyFat" type="number" min="2" max="70" step="0.1" value="${last.bodyFat||''}" placeholder="Opcional"></label><div class="dialog-actions"><button type="button" class="btn ghost" data-close>Cancelar</button><button class="btn primary">Registrar</button></div></form>`;
    bodyDialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>bodyDialog.close());
    bodyDialog.querySelector('[data-body-form]').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.currentTarget),weight=Number(fd.get('weight'));if(!Number.isFinite(weight)||weight<30||weight>350){toast('Revise o peso informado.');return;}const entry={id:Date.now(),date:todayKey(),weight:+weight.toFixed(1),waist:Number(fd.get('waist'))||null,bodyFat:Number(fd.get('bodyFat'))||null};const existing=state.bodyMeasurements.findIndex(x=>x.date===entry.date);if(existing>=0)state.bodyMeasurements[existing]={...state.bodyMeasurements[existing],...entry};else state.bodyMeasurements.push(entry);state.bodyMeasurements.sort((a,b)=>String(a.date).localeCompare(String(b.date)));state.profile.weight=entry.weight;save();bodyDialog.close();render();toast('Evolução corporal registrada.');};
    bodyDialog.showModal();
  }

  function todaysCheckin(){return [...state.readinessCheckins].reverse().find(x=>x.date===todayKey())||null;}
  function readinessScore({energy,sleep,soreness,stress}){const raw=(Number(energy)+Number(sleep)+(6-Number(soreness))+(6-Number(stress)))/20*100;return Math.round(clamp(raw,0,100));}
  let pendingStart=null;
  const baseStartItem=startItem;
  function openReadinessDialog(startId=null){
    pendingStart=startId;const current=todaysCheckin();
    readinessDialog.innerHTML=`<form class="coach-dialog-sheet" data-readiness-form><div class="coach-dialog-head"><div><span class="eyebrow">CHECK-IN DIÁRIO</span><h2>Como você está hoje?</h2><p>A AION usa isso como contexto para intensidade, recuperação e progressão.</p></div><button type="button" class="training-detail-close" data-close>✕</button></div>
      ${[['energy','Energia','1 = muito baixa • 5 = excelente'],['sleep','Qualidade do sono','1 = ruim • 5 = excelente'],['soreness','Dor muscular / rigidez','1 = pouca • 5 = muito alta'],['stress','Estresse / fadiga mental','1 = baixo • 5 = muito alto']].map(([n,l,h])=>`<label class="readiness-range">${l}<input name="${n}" type="range" min="1" max="5" value="${current?.[n]||3}" oninput="this.nextElementSibling.textContent=this.value+'/5'"><output>${current?.[n]||3}/5</output><small>${h}</small></label>`).join('')}
      <label class="check-row"><input type="checkbox" name="pain" ${current?.pain?'checked':''}><span>Estou com dor diferente do desconforto muscular habitual.</span></label>
      <div class="dialog-actions"><button type="button" class="btn ghost" data-close>Cancelar</button><button class="btn primary">Salvar check-in${startId?' e iniciar':''}</button></div></form>`;
    readinessDialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{pendingStart=null;readinessDialog.close();});
    readinessDialog.querySelector('[data-readiness-form]').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const entry={id:current?.id||Date.now(),date:todayKey(),energy:+fd.get('energy'),sleep:+fd.get('sleep'),soreness:+fd.get('soreness'),stress:+fd.get('stress'),pain:fd.get('pain')==='on'};entry.score=readinessScore(entry);const idx=state.readinessCheckins.findIndex(x=>x.date===entry.date);if(idx>=0)state.readinessCheckins[idx]=entry;else state.readinessCheckins.push(entry);save();readinessDialog.close();render();if(entry.pain)toast('Dor registrada. Evite forçar movimentos dolorosos e procure avaliação se necessário.');const id=pendingStart;pendingStart=null;if(id)baseStartItem(id);};
    readinessDialog.showModal();
  }
  startItem=function(id){if(!todaysCheckin()){openReadinessDialog(id);return;}baseStartItem(id);};
  function startExtraRun(){
    const go=()=>startRun({id:null,name:'Corrida adicional',pace:state.profile.easyPace||'5:30',duration:30,intensity:'Livre'});
    if(!todaysCheckin()){openReadinessDialog();const form=readinessDialog.querySelector('[data-readiness-form]');const old=form.onsubmit;form.onsubmit=e=>{old(e);setTimeout(go,30);};return;}go();
  }

  function evolutionContext(){const m=goalMetrics();return {...buildAionContext(),goals:state.goals,goalMetrics:m,bodyMeasurements:state.bodyMeasurements.slice(-12),readiness:state.readinessCheckins.slice(-7),calendarSummary:{monthlyConsistency:m.consistency,completedThisWeek:m.weekly.value,weeklyTarget:m.weekly.target}};}
  async function analyzeEvolution(){
    state.progressAnalysis={text:state.progressAnalysis?.text||'',createdAt:state.progressAnalysis?.createdAt||null,pending:true};save();render();
    const message='Analise minha evolução no Vaz Fitness. Compare musculação, corrida, consistência, prontidão, evolução corporal e minhas metas cadastradas. Diga: 1) principais avanços com números quando existirem, 2) sinais de atenção, 3) quanto falta para metas mensuráveis, 4) próxima melhor ação para as próximas 1-2 semanas. Não invente percentuais para hipertrofia/recomposição; use tendências. Seja objetivo, motivador e seguro.';
    try{const r=await fetch('/api/aion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,context:evolutionContext()})});if(!r.ok)throw new Error('AION indisponível');const data=await r.json();state.progressAnalysis={text:data.message||'Não consegui gerar a análise agora.',createdAt:new Date().toISOString(),pending:false};}
    catch(err){const m=goalMetrics();state.progressAnalysis={text:`Consistência mensal: ${m.consistency}%. Nesta semana você realizou ${m.weekly.value} de ${m.weekly.target} treinos. ${m.runKm.target?`No mês, correu ${m.runKm.value.toFixed(1)} de ${m.runKm.target} km. `:''}Continue registrando esforço, cargas e medidas para tornar a análise mais precisa.`,createdAt:new Date().toISOString(),pending:false};}
    save();render();
  }
  const baseBuildAionContext=buildAionContext;
  buildAionContext=function(){const ctx=baseBuildAionContext();const m=goalMetrics();ctx.goals=state.goals;ctx.goalMetrics=m;ctx.bodyMeasurements=state.bodyMeasurements.slice(-10);ctx.readiness=state.readinessCheckins.slice(-5);ctx.monthlyConsistency=m.consistency;return ctx;};

  let restTimer=null,restUntil=0;
  function clearRest(){clearInterval(restTimer);restTimer=null;restUntil=0;const el=document.getElementById('coachRestCountdown');if(el)el.textContent='Pronto';}
  function startRest(seconds){clearRest();restUntil=Date.now()+Math.max(5,Number(seconds)||60)*1000;const tick=()=>{const left=Math.max(0,Math.ceil((restUntil-Date.now())/1000));const el=document.getElementById('coachRestCountdown');if(el)el.textContent=left?`${left}s`:'Pronto';if(!left){clearRest();toast('Descanso concluído. Próxima série!');}};tick();restTimer=setInterval(tick,500);}
  const baseCompleteSet=completeSet;
  completeSet=function(i){const ex=state.current?.exercises?.[state.current.currentIndex];const rest=ex?.rest||60;baseCompleteSet(i);setTimeout(()=>startRest(rest),25);};
  const baseRenderLive=renderLive;
  renderLive=function(){
    let html=baseRenderLive();const ex=state.current?.exercises?.[state.current?.currentIndex];if(!ex)return html;
    html=html.replace(/<div class="rest-banner">([\s\S]*?)<\/div>/,`<div class="rest-banner coach-rest"><div><span>Descanso sugerido</span><strong>${ex.rest}s</strong></div><div class="coach-rest-live"><small>Contagem</small><strong id="coachRestCountdown">Pronto</strong><button type="button" class="rest-skip" data-rest-skip>Pular</button></div></div>`);
    html=html.replace('<div class="live-actions">',`<label class="exercise-note-field"><span>Observação do exercício</span><input data-exercise-note value="${safe(ex.note||'')}" placeholder="Ex.: equipamento ocupado, desconforto, técnica…"></label><div class="coach-exercise-actions"><button type="button" class="btn ghost compact" data-substitute-exercise>Substituir exercício</button><button type="button" class="btn ghost compact" data-skip-exercise>Pular exercício</button></div><div class="live-actions">`);
    return html;
  };
  function openSubstitute(){
    const c=state.current,ex=c?.exercises?.[c.currentIndex];if(!ex)return;
    const alternatives=exerciseLibrary.filter(x=>x.id!==ex.id&&(x.muscle===ex.muscle||x.secondary?.includes(ex.muscle))).slice(0,5);
    substituteDialog.innerHTML=`<div class="coach-dialog-sheet"><div class="coach-dialog-head"><div><span class="eyebrow">SUBSTITUIR EXERCÍCIO</span><h2>${safe(ex.name)}</h2><p>Escolha outro movimento para o mesmo grupo muscular.</p></div><button class="training-detail-close" data-close>✕</button></div><div class="substitute-list">${alternatives.map(a=>`<button type="button" data-substitute-id="${a.id}"><span>${a.icon||'🏋️'}</span><div><strong>${safe(a.name)}</strong><small>${safe(muscleNames[a.muscle]||a.muscle)} • ${a.reps}</small></div><b>Trocar</b></button>`).join('')||'<p>Sem alternativa cadastrada para este exercício.</p>'}</div></div>`;
    substituteDialog.querySelector('[data-close]')?.addEventListener('click',()=>substituteDialog.close());
    substituteDialog.querySelectorAll('[data-substitute-id]').forEach(b=>b.onclick=()=>{const repl=cloneExercise(b.dataset.substituteId);repl.sets=ex.sets;repl.priority=ex.priority;repl.substitutedFrom=ex.name;repl.completedSets=[];c.exercises[c.currentIndex]=repl;save();substituteDialog.close();render();toast(`Exercício substituído por ${repl.name}.`);});substituteDialog.showModal();
  }
  function skipCurrentExercise(){const c=state.current,ex=c?.exercises?.[c.currentIndex];if(!c||!ex)return;ex.skippedExercise=true;ex.note=ex.note||'Exercício pulado';save();clearRest();if(c.currentIndex<c.exercises.length-1){c.currentIndex++;save();render();toast('Exercício pulado.');}else document.querySelector('[data-finish-early]')?.click();}

  const previousBindDynamic=bindDynamic;
  bindDynamic=function(){
    previousBindDynamic();
    document.querySelectorAll('[data-goals-edit]').forEach(b=>b.onclick=openGoalDialog);
    document.querySelectorAll('[data-body-register]').forEach(b=>b.onclick=openBodyDialog);
    document.querySelectorAll('[data-readiness-open]').forEach(b=>b.onclick=()=>openReadinessDialog());
    document.querySelectorAll('[data-extra-run]').forEach(b=>b.onclick=startExtraRun);
    document.querySelectorAll('[data-analyze-progress]').forEach(b=>b.onclick=analyzeEvolution);
    document.querySelector('[data-rest-skip]')?.addEventListener('click',clearRest);
    document.querySelector('[data-substitute-exercise]')?.addEventListener('click',openSubstitute);
    document.querySelector('[data-skip-exercise]')?.addEventListener('click',skipCurrentExercise);
    document.querySelector('[data-exercise-note]')?.addEventListener('change',e=>{const ex=state.current?.exercises?.[state.current.currentIndex];if(ex){ex.note=String(e.target.value||'').slice(0,180);save();}});
  };

  const style=document.createElement('style');
  style.textContent=`
    .coach-home-focus{margin:18px 0}.coach-today-card{border:1px solid #f1dc72}.coach-home-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:15px}.coach-readiness{font-size:10px;font-weight:900;padding:7px 10px;border-radius:999px;background:#fff5c4;color:#6b5900;white-space:nowrap}.coach-readiness.done{background:#eaf8ef;color:#20743d}.coach-home-mini{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:10px}.coach-home-mini>div,.coach-body-grid>div,.coach-profile-goals>div{background:#fff;border:1px solid var(--line);border-radius:16px;padding:12px}.coach-home-mini span,.coach-body-grid span,.coach-profile-goals span{display:block;color:var(--muted);font-size:10px}.coach-home-mini strong,.coach-body-grid strong,.coach-profile-goals strong{display:block;font-size:16px;margin-top:3px}.coach-home-mini small{font-size:9px;color:var(--muted)}
    .coach-evolution-section{margin-top:18px}.goal-progress-list{display:flex;flex-direction:column;gap:13px;margin-top:12px}.goal-progress-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(120px,38%);gap:14px;align-items:center}.goal-progress-copy strong,.goal-progress-copy span{display:block}.goal-progress-copy span{font-size:11px;color:var(--muted);margin-top:3px}.goal-progress-right>strong{display:block;text-align:right;font-size:12px}.goal-track{height:8px;border-radius:999px;background:#eee;overflow:hidden;margin-top:5px}.goal-track span{display:block;height:100%;background:var(--yellow);border-radius:inherit}.coach-consistency{display:flex;justify-content:space-between;align-items:center;margin-top:15px;padding-top:12px;border-top:1px solid var(--line)}.coach-consistency span{color:var(--muted);font-size:11px}.coach-consistency strong{font-size:20px}.coach-body-grid,.coach-profile-goals{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.coach-chart-card{margin-top:12px}.coach-sparkline{width:100%;height:92px;color:#c7a400;overflow:visible}.coach-chart-range,.run-pace-line{display:flex;justify-content:space-between;color:var(--muted);font-size:10px}.coach-chart-range strong,.run-pace-line strong{color:var(--text)}.coach-chart-empty{padding:28px 8px;text-align:center;color:var(--muted);font-size:12px}.coach-bars{height:145px;display:flex;align-items:flex-end;gap:7px;margin-top:10px}.coach-bar-col{display:flex;flex:1;min-width:0;flex-direction:column;gap:5px;align-items:center}.coach-bar{height:115px;width:100%;display:flex;align-items:flex-end;background:#f4f4f4;border-radius:8px;overflow:hidden}.coach-bar span{display:block;width:100%;background:var(--yellow);border-radius:8px 8px 0 0}.coach-bar-col small{font-size:8px;color:var(--muted)}.run-pace-line{margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}.coach-aion-text{line-height:1.6;font-size:13px;color:#222}.coach-analysis-date{display:block;color:var(--muted);margin-top:10px}.btn.compact{padding:9px 12px;font-size:11px}
    .coach-dialog{width:min(650px,calc(100% - 20px));max-height:94dvh;overflow-y:auto;padding:0}.coach-dialog-sheet{padding:22px}.coach-dialog-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.coach-dialog-head h2{font-size:26px;margin:5px 0}.coach-dialog-head p{margin:0;color:var(--muted);line-height:1.5}.readiness-range{display:grid;grid-template-columns:minmax(0,1fr) 52px;gap:7px;align-items:center;margin-top:16px}.readiness-range input{grid-column:1}.readiness-range output{grid-column:2;grid-row:1/3;font-weight:900;text-align:center}.readiness-range small{grid-column:1;color:var(--muted);font-size:10px}.substitute-list{display:flex;flex-direction:column;gap:8px;margin-top:18px}.substitute-list button{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:10px;align-items:center;text-align:left;border:1px solid var(--line);border-radius:16px;background:#fff;padding:11px;cursor:pointer}.substitute-list button>span{font-size:24px}.substitute-list strong,.substitute-list small{display:block}.substitute-list small{color:var(--muted);margin-top:3px}.substitute-list b{font-size:10px;color:#765f00}
    .coach-rest{display:flex!important;justify-content:space-between!important;align-items:center!important;gap:12px}.coach-rest-live{display:grid;grid-template-columns:auto auto;gap:1px 8px;align-items:center;text-align:right}.coach-rest-live small{grid-column:1;grid-row:1}.coach-rest-live strong{grid-column:1;grid-row:2}.rest-skip{grid-column:2;grid-row:1/3;border:1px solid #444;background:#222;color:#fff;border-radius:11px;padding:8px 10px;font-weight:800}.exercise-note-field{display:block;margin:12px 0}.exercise-note-field span{display:block;color:#bbb;font-size:10px;margin-bottom:5px}.exercise-note-field input{width:100%;box-sizing:border-box;background:#232323;border:1px solid #3b3b3b;color:#fff;border-radius:13px;padding:12px 13px;font-size:16px}.coach-exercise-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.live-shell{padding-bottom:140px}
    @media(max-width:760px){.monthly-calendar-card .calendar-head{align-items:stretch}.monthly-calendar-card .calendar-nav{align-self:center!important;margin:0 auto!important;justify-content:center!important}.coach-home-mini{grid-template-columns:1fr 1fr}.coach-body-grid,.coach-profile-goals{grid-template-columns:1fr 1fr}.goal-progress-row{grid-template-columns:1fr}.goal-progress-right>strong{text-align:left}.coach-dialog-sheet{padding:18px 15px}.coach-dialog-head h2{font-size:23px}}
  `;
  document.head.appendChild(style);
  setTimeout(()=>{try{render();}catch{}},0);
})();