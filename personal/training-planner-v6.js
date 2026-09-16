// Vaz Personal v6 — dias recolhidos, planejador manual AB–ABCDE e leitura de limitações.
(()=>{
  const letters=['A','B','C','D','E'];
  const muscles={chest:'Peitoral',back:'Costas',shoulders:'Ombros',quads:'Quadríceps',hamstrings:'Posteriores',glutes:'Glúteos',biceps:'Bíceps',triceps:'Tríceps',calves:'Panturrilhas',core:'Core'};
  const days=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  let planner=null;
  const catalog=()=>Array.isArray(window.VAZ_EXERCISE_CATALOG_V4)?window.VAZ_EXERCISE_CATALOG_V4:[];
  const clone=v=>JSON.parse(JSON.stringify(v));
  const escape=v=>safe(v==null?'':String(v));

  function splitCount(v){return ({AB:2,ABC:3,ABCD:4,ABCDE:5})[v]||3}
  function defaultFocus(split){
    const presets={
      AB:[['chest','back','shoulders','biceps','triceps'],['quads','hamstrings','glutes','calves','core']],
      ABC:[['chest','shoulders','triceps'],['back','biceps'],['quads','hamstrings','glutes','calves','core']],
      ABCD:[['chest','triceps'],['back','biceps'],['quads','hamstrings','glutes','calves'],['shoulders','core']],
      ABCDE:[['chest'],['back'],['quads','hamstrings','glutes','calves'],['shoulders'],['biceps','triceps','core']]
    };
    return presets[split]||presets.ABC;
  }
  function newPlanner(split='ABC'){
    const count=splitCount(split),focus=defaultFocus(split),frequency=Math.min(6,Math.max(count,Number(selected?.state?.profile?.days)||count));
    const p={split,exerciseCount:5,letters:{},schedule:{0:'REST',1:'REST',2:'REST',3:'REST',4:'REST',5:'REST',6:'REST'}};
    for(let i=0;i<count;i++)p.letters[letters[i]]={name:`Treino ${letters[i]}`,focus:[...focus[i]]};
    const activeDays=[1,2,3,4,5,6,0];
    let li=0;
    for(let i=0;i<frequency;i++){
      const slot=activeDays[i<3?i:i+1<activeDays.length?i+1:i];
      p.schedule[slot]=letters[li%count];li++;
    }
    return p;
  }
  function focusLabel(arr=[]){return arr.map(x=>muscles[x]||x).join(' + ')||'Sem foco definido'}
  function chooseExercises(focus,count){
    const base=catalog().filter(e=>focus.includes(e.muscle));
    const picked=[],per={};
    for(const e of base){
      per[e.muscle]=per[e.muscle]||0;
      if(per[e.muscle]>=2&&picked.length<Math.min(count,focus.length*2))continue;
      picked.push({...clone(e),id:e.id,load:0,icon:'🏋️',priority:false});per[e.muscle]++;
      if(picked.length>=count)break;
    }
    return picked;
  }

  const priorPlanDay=renderPlanDay;
  renderPlanDay=function(d,i){
    const run=d.type==='run',focus=Array.isArray(d.focusMuscles)?d.focusMuscles:[];
    const letter=d.splitLetter?`<span class="vp-split-letter">${escape(d.splitLetter)}</span>`:'';
    const meta=run?`${escape(d.pace||'pace livre')} • ${escape(d.intensity||'Corrida')}`:`${(d.exercises||[]).length} exercícios${focus.length?` • ${escape(focusLabel(focus))}`:''}`;
    return `<details class="vp-day-accordion" data-plan-day data-index="${i}" data-id="${escape(d.id||'')}" data-split-letter="${escape(d.splitLetter||'')}" data-focus="${escape(focus.join(','))}">
      <summary><div class="vp-day-dot">${dayNames[Number(d.day)]||'Dia'}</div>${letter}<div class="vp-day-copy"><strong>${escape(d.name||'Treino')}</strong><small>${meta} • ~${Number(d.duration)||60} min</small></div><span class="vp-day-chevron">⌄</span></summary>
      <div class="vp-day-body"><div class="vp-form-grid"><div class="vp-field"><label>Dia</label><select data-day="day">${dayNames.map((x,idx)=>`<option value="${idx}" ${Number(d.day)===idx?'selected':''}>${x}</option>`).join('')}</select></div><div class="vp-field"><label>Tipo</label><select data-day="type"><option value="strength" ${!run?'selected':''}>Musculação</option><option value="run" ${run?'selected':''}>Corrida</option></select></div><div class="vp-field"><label>Nome</label><input data-day="name" value="${escape(d.name||'Treino')}"></div><div class="vp-field"><label>Duração (min)</label><input data-day="duration" type="number" value="${Number(d.duration)||60}"></div></div>${run?`<div class="vp-form-grid" style="margin-top:8px"><div class="vp-field"><label>Pace</label><input data-day="pace" value="${escape(d.pace||'')}"></div><div class="vp-field"><label>Intensidade</label><input data-day="intensity" value="${escape(d.intensity||'Leve')}"></div></div>`:`<div class="vp-exercise-stack">${(d.exercises||[]).map((e,j)=>renderExercise(e,i,j)).join('')}<button class="vp-btn ghost" data-add-ex="${i}" style="margin-top:8px">+ Exercício</button></div>`}<div class="vp-actions" style="margin-top:10px"><button class="vp-btn danger" data-remove-day="${i}">Excluir dia</button></div></div>
    </details>`;
  };

  const priorCollect=collectPlan;
  collectPlan=function(){
    const plan=priorCollect();
    [...document.querySelectorAll('[data-plan-day]')].forEach((el,i)=>{
      if(!plan[i])return;const src=(selected?.plan?.plan||[])[i]||{};
      plan[i].splitLetter=el.dataset.splitLetter||src.splitLetter||null;
      const f=(el.dataset.focus||'').split(',').filter(Boolean);plan[i].focusMuscles=f.length?f:(src.focusMuscles||[]);
      plan[i].manualPlanner=!!(plan[i].splitLetter||src.manualPlanner);
    });
    return plan;
  };

  const priorClientPlan=renderClientPlan;
  renderClientPlan=function(){
    let html=priorClientPlan();
    const active=(selected?.state?.healthRecords||[]).filter(x=>x.status!=='resolved');
    const warning=active.length?`<div class="vp-alert warn" style="margin-bottom:10px"><span>⚠</span><div><strong>${active.length} limitação(ões) ativa(s)</strong><small>Revise movimentos a evitar antes de liberar o plano.</small></div></div>`:'';
    const tool=`${warning}<div class="vp-card compact vp-manual-planner"><div class="vp-page-head"><div><span class="vp-plan-kicker">PLANEJAMENTO MANUAL</span><h3>Montar divisão AB–ABCDE</h3><p>Escolha a divisão, foco de cada letra e exatamente onde entram os descansos.</p></div><button class="vp-btn primary" id="openManualPlanner">Planejar manualmente</button></div></div>`;
    return html.replace('<section class="vp-card">',`${tool}<section class="vp-card">`);
  };

  function plannerHtml(){
    const count=splitCount(planner.split),opts=letters.slice(0,count);
    return `<div class="vp-page-head"><div><span class="vp-plan-kicker">PLANEJADOR DE TREINO</span><h2>Divisão ${planner.split}</h2><p>Sem AION: você controla divisão, frequência, descanso e exercícios.</p></div><button class="vp-btn ghost" id="closeManualPlanner">×</button></div>
      <div class="vp-card compact"><div class="vp-form-grid"><div class="vp-field"><label>Tipo de divisão</label><select id="manualSplit">${['AB','ABC','ABCD','ABCDE'].map(x=>`<option ${planner.split===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="vp-field"><label>Exercícios por treino</label><select id="manualExerciseCount">${[4,5,6,7,8].map(n=>`<option value="${n}" ${planner.exerciseCount===n?'selected':''}>${n}</option>`).join('')}</select></div></div></div>
      <div class="vp-planner-letters">${opts.map(l=>letterCard(l)).join('')}</div>
      <div class="vp-card compact"><div class="vp-page-head"><div><h3>Semana e descansos</h3><p>Escolha uma letra ou Descanso em cada dia. Repetir uma letra aumenta a frequência dela.</p></div></div><div class="vp-week-schedule">${[1,2,3,4,5,6,0].map(d=>`<label><span>${days[d]}</span><select data-schedule-day="${d}"><option value="REST" ${planner.schedule[d]==='REST'?'selected':''}>Descanso</option>${opts.map(l=>`<option value="${l}" ${planner.schedule[d]===l?'selected':''}>Treino ${l}</option>`).join('')}</select></label>`).join('')}</div><div class="vp-planner-summary" id="plannerSummary"></div></div>
      <div class="vp-actions"><button class="vp-btn ghost" id="closeManualPlanner2">Cancelar</button><button class="vp-btn primary" id="applyManualPlanner">Criar estrutura do treino</button></div>`;
  }
  function letterCard(l){const x=planner.letters[l];return `<div class="vp-card compact vp-letter-card"><div class="vp-letter-title"><span>${l}</span><div class="vp-field"><label>Nome do treino</label><input data-letter-name="${l}" value="${escape(x.name)}"></div></div><div class="vp-muscle-picks">${Object.entries(muscles).map(([k,n])=>`<label class="vp-muscle-pick ${x.focus.includes(k)?'active':''}"><input type="checkbox" data-letter-focus="${l}" value="${k}" ${x.focus.includes(k)?'checked':''}><span>${n}</span></label>`).join('')}</div></div>`}
  function readPlanner(){
    planner.exerciseCount=Number(document.getElementById('manualExerciseCount')?.value)||5;
    for(const l of letters.slice(0,splitCount(planner.split))){
      planner.letters[l].name=document.querySelector(`[data-letter-name="${l}"]`)?.value.trim()||`Treino ${l}`;
      planner.letters[l].focus=[...document.querySelectorAll(`[data-letter-focus="${l}"]:checked`)].map(x=>x.value);
    }
    document.querySelectorAll('[data-schedule-day]').forEach(s=>planner.schedule[Number(s.dataset.scheduleDay)]=s.value);
  }
  function summaryPlanner(){
    readPlanner();const count={};Object.values(planner.schedule).forEach(v=>{if(v!=='REST')count[v]=(count[v]||0)+1});
    const rest=Object.values(planner.schedule).filter(v=>v==='REST').length;
    const el=document.getElementById('plannerSummary');if(el)el.innerHTML=`<strong>${Object.values(count).reduce((a,b)=>a+b,0)} treinos/semana</strong><span>${letters.slice(0,splitCount(planner.split)).map(l=>`${l}: ${count[l]||0}×`).join(' • ')} • ${rest} dia(s) de descanso</span>`;
  }
  function openPlanner(){planner=newPlanner('ABC');const m=showModal(plannerHtml());m.querySelector('.vp-modal')?.classList.add('vp-planner-modal');bindPlanner(m)}
  function rerenderPlanner(m){m.querySelector('.vp-modal').innerHTML=plannerHtml();bindPlanner(m)}
  function bindPlanner(m){
    m.querySelector('#closeManualPlanner')?.addEventListener('click',()=>m.remove());m.querySelector('#closeManualPlanner2')?.addEventListener('click',()=>m.remove());
    m.querySelector('#manualSplit')?.addEventListener('change',e=>{planner=newPlanner(e.target.value);rerenderPlanner(m)});
    m.querySelectorAll('input,select').forEach(x=>x.addEventListener('change',()=>{if(x.dataset.letterFocus)x.closest('.vp-muscle-pick')?.classList.toggle('active',x.checked);summaryPlanner()}));
    m.querySelector('#applyManualPlanner')?.addEventListener('click',()=>{readPlanner();const plan=[];for(const d of [1,2,3,4,5,6,0]){const l=planner.schedule[d];if(l==='REST')continue;const c=planner.letters[l];const exercises=chooseExercises(c.focus,planner.exerciseCount);plan.push({id:`manual-${Date.now()}-${d}-${l}`,type:'strength',name:`${l} • ${c.name}`,day:d,duration:Number(selected?.state?.profile?.minutes)||60,status:'pending',splitLetter:l,focusMuscles:[...c.focus],manualPlanner:true,exercises});}selected.plan={...(selected.plan||{}),plan};aiDraft=false;m.remove();clientTab='plan';render();toast('Estrutura manual criada. Abra cada dia para revisar exercícios e cargas.')});
    summaryPlanner();
  }

  function healthContent(){
    const rows=selected?.state?.healthRecords||[],active=rows.filter(x=>x.status!=='resolved');
    if(!rows.length)return `<section class="vp-card"><div class="vp-empty">O aluno ainda não registrou lesões ou limitações no Vaz Fitness.</div></section>`;
    return `<section class="vp-grid two"><div class="vp-card"><div class="vp-page-head"><div><h2>Lesões e limitações</h2><p>Contexto informado pelo aluno para planejamento mais conservador.</p></div>${active.length?badge(`${active.length} ativa(s)`,'warn'):badge('Sem ativas','ok')}</div>${rows.slice().reverse().map(r=>`<div class="vp-health-row"><div><strong>${escape(r.area||r.title||'Registro')}</strong><small>${escape(r.type==='limitation'?'Limitação':'Lesão')} • ${escape(r.status==='resolved'?'Resolvida':r.status==='recovering'?'Em recuperação':'Ativa')}</small></div>${r.avoid?`<p><b>Evitar:</b> ${escape(r.avoid)}</p>`:''}${r.guidance?`<p><b>Orientação profissional:</b> ${escape(r.guidance)}</p>`:''}${r.notes?`<p>${escape(r.notes)}</p>`:''}</div>`).join('')}</div><div class="vp-card"><h2>Uso pela AION</h2><p>A AION recebe esses dados como restrições de planejamento. Ela deve adaptar volume, seleção de movimentos e progressão, sem diagnosticar nem substituir avaliação clínica.</p><div class="vp-alert warn"><div><strong>Importante</strong><small>Em dor aguda, piora importante ou sinais neurológicos, o treino deve ser revisto por profissional habilitado.</small></div></div></div></section>`;
  }

  const priorRenderClient=renderClient;
  function injectHealthTab(html){
    const marker='<div class="vp-tabs">',s=html.indexOf(marker);if(s<0)return html;const e=html.indexOf('</div>',s);if(e<0)return html;
    return html.slice(0,e)+`<button class="vp-tab ${clientTab==='limitations'?'active':''}" data-client-tab="limitations">Lesões & limitações</button>`+html.slice(e);
  }
  renderClient=function(){
    if(clientTab!=='limitations')return injectHealthTab(priorRenderClient());
    const keep=clientTab;clientTab='summary';let base=priorRenderClient();clientTab=keep;base=injectHealthTab(base);const marker='<div class="vp-tabs">',s=base.indexOf(marker),e=base.indexOf('</div>',s);return base.slice(0,e+6)+healthContent();
  };

  const priorBind=bindPersonal;
  bindPersonal=function(){priorBind();document.getElementById('openManualPlanner')?.addEventListener('click',openPlanner)};

  const style=document.createElement('style');style.textContent=`
  .vp-day-accordion{border:1px solid #e8e7e2;border-radius:18px;background:#fff;margin-top:9px;overflow:hidden}.vp-day-accordion summary{list-style:none;display:flex;align-items:center;gap:10px;padding:13px;cursor:pointer}.vp-day-accordion summary::-webkit-details-marker{display:none}.vp-day-dot{width:42px;height:42px;border-radius:13px;background:#161616;color:#fff;display:grid;place-items:center;font-size:10px;font-weight:900}.vp-split-letter{width:30px;height:30px;border-radius:10px;background:#f5c400;display:grid;place-items:center;font-weight:950}.vp-day-copy{flex:1;min-width:0}.vp-day-copy strong,.vp-day-copy small{display:block}.vp-day-copy small{font-size:10px;color:var(--muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vp-day-chevron{font-size:20px;transition:.2s}.vp-day-accordion[open] .vp-day-chevron{transform:rotate(180deg)}.vp-day-body{padding:0 13px 13px;border-top:1px solid #efeee9}.vp-day-body>.vp-form-grid{margin-top:12px}.vp-exercise-stack{margin-top:10px}.vp-manual-planner{margin-bottom:10px;background:linear-gradient(135deg,#fffdf5,#fff)}.vp-planner-modal{width:min(900px,calc(100vw - 24px));max-height:88dvh;overflow:auto}.vp-planner-letters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:10px 0}.vp-letter-title{display:flex;gap:10px;align-items:end}.vp-letter-title>span{width:44px;height:44px;border-radius:14px;background:#171717;color:#f5c400;display:grid;place-items:center;font-size:22px;font-weight:950}.vp-letter-title .vp-field{flex:1}.vp-muscle-picks{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.vp-muscle-pick input{display:none}.vp-muscle-pick span{display:block;border:1px solid #ddd;border-radius:999px;padding:7px 10px;font-size:10px;font-weight:800;cursor:pointer}.vp-muscle-pick.active span{background:#fff5bf;border-color:#e1b600;color:#6b5700}.vp-week-schedule{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.vp-week-schedule label{display:flex;justify-content:space-between;align-items:center;gap:10px;border:1px solid #ecebe6;border-radius:14px;padding:9px 10px}.vp-week-schedule label span{font-size:11px;font-weight:800}.vp-week-schedule select{max-width:150px}.vp-planner-summary{display:flex;justify-content:space-between;gap:12px;margin-top:12px;padding:11px 13px;border-radius:14px;background:#f7f5e9}.vp-planner-summary strong,.vp-planner-summary span{font-size:11px}.vp-health-row{padding:12px 0;border-bottom:1px solid #ecebe6}.vp-health-row:last-child{border-bottom:0}.vp-health-row small{display:block;color:var(--muted);margin-top:3px}.vp-health-row p{font-size:11px;line-height:1.5;margin:7px 0 0}@media(max-width:680px){.vp-planner-letters,.vp-week-schedule{grid-template-columns:1fr}.vp-day-copy small{max-width:180px}.vp-plan-card .vp-page-head{align-items:flex-start}.vp-manual-planner .vp-page-head{gap:12px}.vp-manual-planner .vp-btn{width:100%}}
  `;document.head.appendChild(style);
})();