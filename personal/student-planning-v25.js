// Vaz Personal v25 — planejamento do aluno, rascunho revisável e lançamento explícito.
(()=>{
  if(window.__VAZ_STUDENT_PLANNING_V25__)return;
  window.__VAZ_STUDENT_PLANNING_V25__=true;

  const DRAFT_PREFIX='vazPersonal.studentPlanDraft.v25.';
  const lettersOrder=['A','B','C','D','E'];
  const muscleMap={chest:'Peitoral',back:'Costas',shoulders:'Ombros',quads:'Quadríceps',hamstrings:'Posteriores',glutes:'Glúteos',biceps:'Bíceps',triceps:'Tríceps',calves:'Panturrilhas',core:'Core'};
  const splitFocus={
    AB:[['chest','back','shoulders','biceps','triceps'],['quads','hamstrings','glutes','calves','core']],
    ABC:[['chest','shoulders','triceps'],['back','biceps'],['quads','hamstrings','glutes','calves','core']],
    ABCD:[['chest','triceps'],['back','biceps'],['quads','hamstrings','glutes','calves'],['shoulders','core']],
    ABCDE:[['chest'],['back'],['quads','hamstrings','glutes','calves'],['shoulders'],['biceps','triceps','core']]
  };
  const clone=v=>JSON.parse(JSON.stringify(v));
  const esc=v=>safe(v==null?'':String(v));
  const athleteId=()=>selected?.athlete?.id||'';
  let planModal=null;
  let planningModal=null;
  let editorDraft=null;
  let planningDraft=null;
  let catalogCache=[];

  function draftKey(){return DRAFT_PREFIX+athleteId()}
  function activeRequest(){return (selectedOps?.requests||[]).find(r=>['pending','reviewing'].includes(r.status))||null}
  function currentCycleDays(){return [30,45,60,90].includes(Number(selectedOps?.cycle?.days))?Number(selectedOps.cycle.days):30}
  function defaultDraft(){
    return {
      athleteId:athleteId(),
      baseVersion:Number(selected?.plan?.plan_version)||0,
      plan:clone(Array.isArray(selected?.plan?.plan)?selected.plan.plan:[]),
      notes:selected?.plan?.notes||'',
      cycleDays:currentCycleDays(),
      planning:null,
      dirty:false,
      source:'current',
      updatedAt:Date.now()
    };
  }
  function loadDraft(){
    const base=defaultDraft();
    if(!base.athleteId)return base;
    try{
      const saved=JSON.parse(localStorage.getItem(draftKey())||'null');
      if(saved&&saved.athleteId===base.athleteId&&Number(saved.baseVersion)===base.baseVersion&&Array.isArray(saved.plan)){
        return {...base,...saved,plan:clone(saved.plan),dirty:!!saved.dirty};
      }
    }catch{}
    return base;
  }
  function persistDraft(draft){
    draft.updatedAt=Date.now();
    try{localStorage.setItem(draftKey(),JSON.stringify(draft))}catch{}
    return draft;
  }
  function clearDraft(){try{localStorage.removeItem(draftKey())}catch{}}
  function setDraft(draft,{renderNow=true}={}){
    persistDraft(draft);
    selected.plan={...(selected.plan||{}),plan:clone(draft.plan),notes:draft.notes};
    aiDraft=draft.source==='aion';
    if(renderNow)render();
  }
  function splitCount(v){return ({AB:2,ABC:3,ABCD:4,ABCDE:5})[v]||3}
  function newPlanning(){
    const draft=loadDraft();
    if(draft.planning)return clone(draft.planning);
    const split='ABC',count=splitCount(split),profile=selected?.state?.profile||{},rest=new Set((profile.restDays||[]).map(Number));
    const schedule={0:'REST',1:'REST',2:'REST',3:'REST',4:'REST',5:'REST',6:'REST'};
    const activeDays=[1,2,3,4,5,6,0].filter(d=>!rest.has(d));
    const frequency=Math.min(activeDays.length,Math.max(count,Number(profile.days)||count));
    for(let i=0;i<frequency;i++)schedule[activeDays[i]]=lettersOrder[i%count];
    const letters={};
    for(let i=0;i<count;i++)letters[lettersOrder[i]]={name:`Treino ${lettersOrder[i]}`,focus:[...(splitFocus[split]?.[i]||[])]};
    return {cycleDays:draft.cycleDays||currentCycleDays(),split,exerciseCount:5,letters,schedule};
  }
  function resetPlanningSplit(next){
    const old=planningDraft||newPlanning(),count=splitCount(next),letters={};
    for(let i=0;i<count;i++){
      const l=lettersOrder[i],prior=old.letters?.[l];
      letters[l]={name:prior?.name||`Treino ${l}`,focus:Array.isArray(prior?.focus)&&prior.focus.length?[...prior.focus]:[...(splitFocus[next]?.[i]||[])]};
    }
    const schedule={...old.schedule};
    Object.keys(schedule).forEach(k=>{if(schedule[k]!=='REST'&&!letters[schedule[k]])schedule[k]='REST'});
    planningDraft={...old,split:next,letters,schedule};
  }
  function focusLabel(arr=[]){return arr.map(x=>muscleMap[x]||muscleNames?.[x]||x).join(' + ')||'Sem foco definido'}
  function cycleBadge(){
    const c=selectedOps?.cycle||{};
    if(c.status==='expired')return badge('Ciclo vencido','danger');
    if(c.status==='due_soon')return badge(`Vence em ${Math.max(0,c.daysLeft||0)} dias`,'warn');
    if(c.status==='active')return badge(`${Number(c.days)||currentCycleDays()} dias`,'ok');
    return badge('Novo ciclo','info');
  }
  function planningCardHtml(){
    const d=loadDraft();
    return `<section class="vp-card compact vp-planning-v25">
      <div class="vp-page-head">
        <div><span class="vp-plan-kicker">PLANEJAMENTO</span><h3>Estruture o próximo ciclo</h3><p>Defina ciclo, divisão, focos e descansos. Você pode montar manualmente ou pedir para a AION estruturar usando os dados reais do aluno.</p></div>
        ${cycleBadge()}
      </div>
      <div class="vp-planning-v25-meta">
        <span><b>${d.cycleDays||currentCycleDays()}</b> dias de ciclo</span>
        <span><b>${selected?.state?.profile?.days||'—'}</b> dias/semana do perfil</span>
        <span><b>${(selected?.state?.healthRecords||[]).filter(x=>x.status!=='resolved').length}</b> restrição(ões) ativa(s)</span>
      </div>
      <div class="vp-actions vp-planning-v25-actions">
        <button class="vp-btn primary" id="openStudentPlanning">Planejamento</button>
        <button class="vp-btn dark" id="aionStructureStudentPlan">✦ AION estruturar</button>
      </div>
    </section>`;
  }
  function planDaySummary(d,i){
    const run=d.type==='run';
    const meta=run?`${esc(d.pace||'pace livre')} • ${esc(d.intensity||'Corrida')}`:`${(d.exercises||[]).length} exercícios${Array.isArray(d.focusMuscles)&&d.focusMuscles.length?` • ${esc(focusLabel(d.focusMuscles))}`:''}`;
    return `<article class="vp-plan-preview-day">
      <div class="vp-day-dot">${esc(dayNames[Number(d.day)]||'Dia')}</div>
      ${d.splitLetter?`<span class="vp-split-letter">${esc(d.splitLetter)}</span>`:''}
      <div><strong>${esc(d.name||'Treino')}</strong><small>${meta} • ~${Number(d.duration)||60} min</small></div>
      <button class="vp-btn ghost" data-edit-student-day="${i}">Editar</button>
    </article>`;
  }
  function planPanelHtml(){
    const d=loadDraft(),plan=d.plan||[],request=activeRequest();
    return `<div class="vp-page-head">
      <div><h2>Plano de treino</h2><p>Versão no app do aluno: ${Number(selected?.plan?.plan_version)||0}${d.dirty?' • alterações em rascunho':''}</p></div>
      <div class="vp-actions">
        <button class="vp-btn ghost" id="editStudentPlan">${plan.length?'Editar plano':'Montar plano'}</button>
        ${d.dirty?'<button class="vp-btn ghost" id="discardStudentDraft">Descartar rascunho</button>':''}
      </div>
    </div>
    ${d.dirty?`<div class="vp-alert info vp-plan-draft-banner"><span>✎</span><div><strong>Rascunho ainda não enviado ao aluno</strong><small>Revise tudo abaixo. O Vaz Fitness só será atualizado quando você tocar em “Lançar para aluno”.</small></div></div>`:''}
    ${request?`<div class="vp-alert warn"><span>!</span><div><strong>Solicitação de novo treino ativa</strong><small>${esc(request.reason||'O aluno solicitou uma alteração de plano.')}</small></div></div>`:''}
    <div class="vp-plan-preview-list">${plan.length?plan.map(planDaySummary).join(''):'<div class="vp-empty">Nenhum treino estruturado. Use Planejamento ou AION estruturar.</div>'}</div>
    <div class="vp-field" style="margin-top:12px"><label>Orientações do personal</label><textarea id="studentPlanNotesPreview" rows="3" readonly>${esc(d.notes||'')}</textarea></div>
    <div class="vp-launch-bar">
      <div><strong>Pronto para o aluno?</strong><small>Ao lançar, o plano e o novo ciclo passam a valer no Vaz Fitness.</small></div>
      <button class="vp-btn ok" id="launchStudentPlan" ${!plan.length?'disabled':''}>Lançar para aluno</button>
    </div>`;
  }

  const previousRenderPlan=renderClientPlan;
  renderClientPlan=function(){
    const host=document.createElement('div');host.innerHTML=previousRenderPlan();
    const oldPlanning=host.querySelector('.vp-manual-planner');
    if(oldPlanning)oldPlanning.outerHTML=planningCardHtml();
    else host.insertAdjacentHTML('afterbegin',planningCardHtml());
    const section=[...host.querySelectorAll('section.vp-card')].find(s=>s.querySelector('h2')?.textContent.trim()==='Plano de treino');
    if(section)section.innerHTML=planPanelHtml();
    return host.innerHTML;
  };

  const previousManagement=renderClientManagement;
  renderClientManagement=function(){
    const host=document.createElement('div');host.innerHTML=previousManagement();
    const cycleHeading=[...host.querySelectorAll('h2')].find(h=>h.textContent.trim()==='Ciclo de treino');
    cycleHeading?.closest('.vp-card')?.remove();
    return host.innerHTML;
  };

  function readPlanning(root){
    if(!planningDraft)return;
    planningDraft.cycleDays=Number(root.querySelector('#planningCycleDays')?.value)||30;
    planningDraft.exerciseCount=Number(root.querySelector('#planningExerciseCount')?.value)||5;
    Object.keys(planningDraft.letters||{}).forEach(l=>{
      planningDraft.letters[l].name=root.querySelector(`[data-plan-letter-name="${l}"]`)?.value.trim()||`Treino ${l}`;
      planningDraft.letters[l].focus=[...root.querySelectorAll(`[data-plan-letter-focus="${l}"]:checked`)].map(x=>x.value);
    });
    root.querySelectorAll('[data-plan-schedule]').forEach(s=>planningDraft.schedule[Number(s.dataset.planSchedule)]=s.value);
  }
  function planningSummary(){
    const root=planningModal?.querySelector('.vp-modal');if(!root||!planningDraft)return;
    readPlanning(root);
    const count={};Object.values(planningDraft.schedule).forEach(v=>{if(v!=='REST')count[v]=(count[v]||0)+1});
    const rest=Object.values(planningDraft.schedule).filter(v=>v==='REST').length;
    const el=root.querySelector('#planningSummary');
    if(el)el.innerHTML=`<strong>${Object.values(count).reduce((a,b)=>a+b,0)} treinos/semana</strong><span>${Object.keys(planningDraft.letters).map(l=>`${l}: ${count[l]||0}×`).join(' • ')} • ${rest} descanso(s) • ciclo ${planningDraft.cycleDays} dias</span>`;
  }
  function planningHtml(){
    const p=planningDraft,count=splitCount(p.split),active=lettersOrder.slice(0,count);
    return `<div class="vp-page-head vp-planning-head"><div><span class="vp-plan-kicker">PLANEJAMENTO</span><h2>Estrutura do ciclo</h2><p>Essas informações orientam tanto a montagem manual quanto a estrutura criada pela AION.</p></div><button class="vp-btn ghost" data-planning-close>×</button></div>
      <div class="vp-card compact"><div class="vp-form-grid">
        <div class="vp-field"><label>Duração do ciclo</label><select id="planningCycleDays">${[30,45,60,90].map(n=>`<option value="${n}" ${Number(p.cycleDays)===n?'selected':''}>${n} dias</option>`).join('')}</select></div>
        <div class="vp-field"><label>Divisão</label><select id="planningSplit">${['AB','ABC','ABCD','ABCDE'].map(x=>`<option ${p.split===x?'selected':''}>${x}</option>`).join('')}</select></div>
        <div class="vp-field"><label>Exercícios por treino</label><select id="planningExerciseCount">${[3,4,5,6,7,8].map(n=>`<option value="${n}" ${Number(p.exerciseCount)===n?'selected':''}>${n}</option>`).join('')}</select></div>
      </div></div>
      <div class="vp-planner-letters">${active.map(l=>`<div class="vp-card compact vp-letter-card"><div class="vp-letter-title"><span>${l}</span><div class="vp-field"><label>Nome do treino</label><input data-plan-letter-name="${l}" value="${esc(p.letters[l]?.name||`Treino ${l}`)}"></div></div><div class="vp-muscle-picks">${Object.entries(muscleMap).map(([k,n])=>`<label class="vp-muscle-pick ${p.letters[l]?.focus?.includes(k)?'active':''}"><input type="checkbox" data-plan-letter-focus="${l}" value="${k}" ${p.letters[l]?.focus?.includes(k)?'checked':''}><span>${n}</span></label>`).join('')}</div></div>`).join('')}</div>
      <div class="vp-card compact"><div class="vp-page-head"><div><h3>Semana e descansos</h3><p>Defina exatamente em quais dias cada treino acontece.</p></div></div><div class="vp-week-schedule">${[1,2,3,4,5,6,0].map(d=>`<label><span>${dayNames[d]}</span><select data-plan-schedule="${d}"><option value="REST" ${p.schedule[d]==='REST'?'selected':''}>Descanso</option>${active.map(l=>`<option value="${l}" ${p.schedule[d]===l?'selected':''}>${l} • ${esc(p.letters[l]?.name||`Treino ${l}`)}</option>`).join('')}</select></label>`).join('')}</div><div class="vp-planner-summary" id="planningSummary"></div></div>
      <div class="vp-planning-context"><strong>AION vai considerar automaticamente</strong><span>objetivo e perfil do aluno • lesões/limitações • movimentos a evitar • feedbacks de cada treino • prontidão/recuperação • histórico recente • dias de descanso</span></div>
      <div class="vp-actions vp-planning-modal-actions"><button class="vp-btn ghost" data-planning-close>Cancelar</button><button class="vp-btn primary" id="createManualStudentStructure">Criar estrutura</button><button class="vp-btn dark" id="runAionStudentStructure">✦ AION estruturar</button></div>`;
  }
  function renderPlanningModal(){
    if(!planningModal)return;
    const box=planningModal.querySelector('.vp-modal');box.innerHTML=planningHtml();box.classList.add('vp-student-planning-modal');
    bindPlanningModal();planningSummary();
  }
  function bindPlanningModal(){
    const root=planningModal?.querySelector('.vp-modal');if(!root)return;
    root.querySelectorAll('[data-planning-close]').forEach(b=>b.onclick=()=>{planningModal?.remove();planningModal=null;planningDraft=null});
    root.querySelector('#planningSplit')?.addEventListener('change',e=>{readPlanning(root);resetPlanningSplit(e.target.value);renderPlanningModal()});
    root.querySelectorAll('input,select').forEach(el=>el.addEventListener('change',()=>{if(el.dataset.planLetterFocus)el.closest('.vp-muscle-pick')?.classList.toggle('active',el.checked);planningSummary()}));
    root.querySelector('#createManualStudentStructure')?.addEventListener('click',()=>{readPlanning(root);createManualStructure()});
    root.querySelector('#runAionStudentStructure')?.addEventListener('click',()=>{readPlanning(root);generateAionStructure(clone(planningDraft),root.querySelector('#runAionStudentStructure'))});
  }
  function openPlanning(){planningDraft=newPlanning();planningModal=showModal(planningHtml());planningModal.querySelector('.vp-modal')?.classList.add('vp-student-planning-modal');bindPlanningModal();planningSummary()}
  function createManualStructure(){
    const p=planningDraft,draft=loadDraft(),plan=[];
    for(const d of [1,2,3,4,5,6,0]){
      const l=p.schedule[d];if(l==='REST')continue;
      const c=p.letters[l]||{name:`Treino ${l}`,focus:[]};
      plan.push({id:`vp-plan-${Date.now()}-${d}-${l}`,type:'strength',name:c.name||`Treino ${l}`,day:d,duration:Number(selected?.state?.profile?.minutes)||60,status:'pending',splitLetter:l,focusMuscles:[...(c.focus||[])],manualPlanner:true,exercises:[]});
    }
    if(!plan.length){toast('Defina pelo menos um dia de treino.');return}
    draft.plan=plan;draft.cycleDays=p.cycleDays;draft.planning=clone(p);draft.dirty=true;draft.source='manual';persistDraft(draft);
    selected.plan={...(selected.plan||{}),plan:clone(plan),notes:draft.notes};aiDraft=false;
    planningModal?.remove();planningModal=null;planningDraft=null;render();setTimeout(()=>openPlanEditor(),0);
  }

  async function generateAionStructure(planning=null,button=null){
    const p=planning||newPlanning(),draft=loadDraft();
    if(button){button.disabled=true;button.textContent='AION estruturando…'}
    toast('AION está analisando dados, lesões, feedbacks e histórico do aluno…');
    try{
      const data=await opsApi('suggest_plan',{method:'POST',body:{athleteId:athleteId(),planning:p}});
      if(!Array.isArray(data.plan)||!data.plan.length)throw new Error('AION não retornou um plano válido.');
      draft.plan=clone(data.plan);draft.notes=data.notes||draft.notes||'';draft.cycleDays=p.cycleDays;draft.planning=clone(p);draft.dirty=true;draft.source='aion';
      persistDraft(draft);selected.plan={...(selected.plan||{}),plan:clone(draft.plan),notes:draft.notes};aiDraft=true;
      planningModal?.remove();planningModal=null;planningDraft=null;render();
      toast('Estrutura AION pronta. Revise o plano antes de lançar para o aluno.');
    }catch(e){toast(e.message);if(button){button.disabled=false;button.textContent='✦ AION estruturar'}}
  }
  suggestPlan=async function(){await generateAionStructure(newPlanning())};

  async function catalog(){
    if(catalogCache.length)return catalogCache;
    try{
      const d=await req('/api/personal-tools',{params:{action:'catalog'}});
      const seen=new Set();catalogCache=[...(d.custom||[]),...(d.builtin||[])].filter(x=>x?.id&&x?.name&&!seen.has(x.id)&&(seen.add(x.id),true));
    }catch{
      catalogCache=Array.isArray(window.VAZ_EXERCISE_CATALOG_V4)?window.VAZ_EXERCISE_CATALOG_V4.map(x=>({...x,source:x.source||'builtin'})):[];
    }
    return catalogCache;
  }
  function exerciseFromCatalog(e){
    return {id:e.id||`custom-${Date.now()}`,name:e.name||'Exercício',muscle:e.muscle||'core',secondary:Array.isArray(e.secondary)?e.secondary:[],sets:Number(e.sets)||3,reps:e.reps||'8-12',load:Number(e.load)||0,rest:Number(e.rest)||60,icon:e.icon||'🏋️',priority:!!e.priority,equipment:e.equipment||'',instructions:e.instructions||'',videoUrl:e.videoUrl||null,imageUrl:e.imageUrl||null,imageEndUrl:e.imageEndUrl||null,mediaQuery:e.mediaQuery||e.name||''};
  }
  function editorDayHtml(d,di){
    const run=d.type==='run';
    return `<section class="vp-template-day vp-student-editor-day" data-student-editor-day="${di}" data-id="${esc(d.id||'')}" data-letter="${esc(d.splitLetter||'')}" data-focus="${esc((d.focusMuscles||[]).join(','))}">
      <div class="vp-template-day-head">
        <div class="vp-field"><label>Dia</label><select data-pdf="day">${dayNames.map((n,i)=>`<option value="${i}" ${Number(d.day)===i?'selected':''}>${n}</option>`).join('')}</select></div>
        <div class="vp-field"><label>Nome</label><input data-pdf="name" value="${esc(d.name||'Treino')}"></div>
        <div class="vp-field"><label>Tipo</label><select data-pdf="type"><option value="strength" ${!run?'selected':''}>Musculação</option><option value="run" ${run?'selected':''}>Corrida</option></select></div>
        <div class="vp-field"><label>Duração</label><input data-pdf="duration" type="number" min="0" max="300" value="${Number(d.duration)||60}"></div>
        <button type="button" class="vp-btn danger" data-plan-remove-day="${di}">×</button>
      </div>
      ${run?`<div class="vp-form-grid" style="margin-top:8px"><div class="vp-field"><label>Pace</label><input data-pdf="pace" value="${esc(d.pace||'')}"></div><div class="vp-field"><label>Intensidade</label><input data-pdf="intensity" value="${esc(d.intensity||'Leve')}"></div></div>`:`<div class="vp-student-editor-exercises">${(d.exercises||[]).map((e,ei)=>editorExerciseHtml(e,di,ei)).join('')}<div class="vp-plan-add-actions"><button type="button" class="vp-btn primary" data-plan-add-library="${di}">⌕ Pesquisar na biblioteca</button><button type="button" class="vp-btn ghost" data-plan-add-manual="${di}">+ Exercício manual</button></div></div>`}
    </section>`;
  }
  function editorExerciseHtml(e,di,ei){
    return `<div class="vp-template-ex vp-student-editor-ex" data-student-editor-ex="${di}:${ei}" data-id="${esc(e.id||'')}">
      <div class="vp-field vp-template-exercise-choice"><label>Exercício</label><button type="button" class="vp-template-pick" data-plan-swap-library="${di}:${ei}"><span><strong>${esc(e.name||'Exercício')}</strong><small>${esc(muscleNames?.[e.muscle]||muscleMap[e.muscle]||e.muscle||'Outro')}${e.equipment?` • ${esc(e.equipment)}`:''}</small></span><b>Buscar / trocar</b></button></div>
      <div class="vp-field"><label>Séries</label><input data-pef="sets" type="number" min="1" max="20" value="${Number(e.sets)||3}"></div>
      <div class="vp-field"><label>Reps</label><input data-pef="reps" value="${esc(e.reps||'8-12')}"></div>
      <div class="vp-field"><label>Carga</label><input data-pef="load" type="number" min="0" step="0.5" value="${Number(e.load)||0}"></div>
      <div class="vp-field"><label>Descanso</label><input data-pef="rest" type="number" min="0" max="900" value="${Number(e.rest)||60}"></div>
      <button type="button" class="vp-btn danger" data-plan-remove-ex="${di}:${ei}">×</button>
    </div>`;
  }
  function planEditorHtml(){
    return `<div class="vp-page-head vp-plan-editor-head"><div><span class="vp-plan-kicker">PLANO DO ALUNO</span><h2>Montar e revisar treinos</h2><p>Mesmo fluxo da criação de plano da biblioteca, aplicado diretamente ao rascunho deste aluno.</p></div><button class="vp-btn ghost" data-plan-editor-close>×</button></div>
      <div id="studentPlanEditorDays">${(editorDraft.plan||[]).map(editorDayHtml).join('')||'<div class="vp-empty">Nenhum dia criado ainda.</div>'}</div>
      <div class="vp-actions"><button class="vp-btn ghost" id="studentPlanAddDay">+ Adicionar dia</button></div>
      <div class="vp-field vp-plan-editor-notes"><label>Orientações do personal</label><textarea id="studentPlanEditorNotes" rows="4" placeholder="Orientações gerais que o aluno deve ver…">${esc(editorDraft.notes||'')}</textarea></div>
      <div class="vp-plan-editor-footer"><button class="vp-btn ghost" data-plan-editor-close>Cancelar</button><button class="vp-btn primary" id="saveStudentPlanDraft">Salvar rascunho</button></div>`;
  }
  function readPlanEditor(){
    const root=planModal?.querySelector('.vp-modal');if(!root||!editorDraft)return;
    const oldPlan=editorDraft.plan||[];
    editorDraft.plan=[...root.querySelectorAll('[data-student-editor-day]')].map((dayEl,di)=>{
      const old=oldPlan[di]||{},get=n=>dayEl.querySelector(`[data-pdf="${n}"]`)?.value,type=get('type')||old.type||'strength';
      const day={...old,id:dayEl.dataset.id||old.id||`vp-${Date.now()}-${di}`,type,name:String(get('name')||old.name||'Treino').trim()||'Treino',day:Number(get('day')??old.day),duration:Number(get('duration'))||60,status:'pending',splitLetter:dayEl.dataset.letter||old.splitLetter||null,focusMuscles:(dayEl.dataset.focus||'').split(',').filter(Boolean).length?(dayEl.dataset.focus||'').split(',').filter(Boolean):(old.focusMuscles||[])};
      if(type==='run'){day.pace=get('pace')||old.pace||'';day.intensity=get('intensity')||old.intensity||'Leve'}
      else{
        const oldEx=old.exercises||[];
        day.exercises=[...dayEl.querySelectorAll('[data-student-editor-ex]')].map((row,ei)=>{
          const prev=oldEx[ei]||{},g=n=>row.querySelector(`[data-pef="${n}"]`)?.value;
          return {...prev,id:row.dataset.id||prev.id||`custom-${Date.now()}-${di}-${ei}`,name:prev.name||'Exercício',muscle:prev.muscle||'core',secondary:Array.isArray(prev.secondary)?prev.secondary:[],sets:Number(g('sets'))||3,reps:g('reps')||prev.reps||'8-12',load:Number(g('load'))||0,rest:Number(g('rest'))||60,icon:prev.icon||'🏋️',priority:!!prev.priority};
        });
      }
      return day;
    });
    editorDraft.notes=root.querySelector('#studentPlanEditorNotes')?.value||'';
  }
  function renderPlanEditor(){
    if(!planModal)return;
    const box=planModal.querySelector('.vp-modal');box.innerHTML=planEditorHtml();box.classList.add('vp-student-plan-editor-modal');bindPlanEditor();
  }
  function bindPlanEditor(){
    const root=planModal?.querySelector('.vp-modal');if(!root)return;
    root.querySelectorAll('[data-plan-editor-close]').forEach(b=>b.onclick=()=>{planModal?.remove();planModal=null;editorDraft=null});
    root.querySelector('#studentPlanAddDay')?.addEventListener('click',()=>{readPlanEditor();editorDraft.plan.push({id:`vp-${Date.now()}`,type:'strength',name:'Novo treino',day:1,duration:60,status:'pending',exercises:[]});renderPlanEditor()});
    root.querySelectorAll('[data-plan-remove-day]').forEach(b=>b.onclick=()=>{readPlanEditor();editorDraft.plan.splice(Number(b.dataset.planRemoveDay),1);renderPlanEditor()});
    root.querySelectorAll('[data-plan-add-manual]').forEach(b=>b.onclick=()=>{readPlanEditor();const d=editorDraft.plan[Number(b.dataset.planAddManual)];d.exercises=d.exercises||[];d.exercises.push({id:`custom-${Date.now()}`,name:'Novo exercício',muscle:'core',secondary:[],sets:3,reps:'8-12',load:0,rest:60,icon:'🏋️',priority:false});renderPlanEditor()});
    root.querySelectorAll('[data-plan-add-library]').forEach(b=>b.onclick=()=>openExercisePicker(Number(b.dataset.planAddLibrary),null));
    root.querySelectorAll('[data-plan-swap-library]').forEach(b=>b.onclick=()=>{const [di,ei]=b.dataset.planSwapLibrary.split(':').map(Number);openExercisePicker(di,ei)});
    root.querySelectorAll('[data-plan-remove-ex]').forEach(b=>b.onclick=()=>{readPlanEditor();const [di,ei]=b.dataset.planRemoveEx.split(':').map(Number);editorDraft.plan[di].exercises.splice(ei,1);renderPlanEditor()});
    root.querySelectorAll('[data-pdf="type"]').forEach(s=>s.onchange=()=>{readPlanEditor();renderPlanEditor()});
    root.querySelector('#saveStudentPlanDraft')?.addEventListener('click',()=>{readPlanEditor();editorDraft.dirty=true;editorDraft.source=editorDraft.source||'manual';persistDraft(editorDraft);selected.plan={...(selected.plan||{}),plan:clone(editorDraft.plan),notes:editorDraft.notes};aiDraft=editorDraft.source==='aion';planModal.remove();planModal=null;editorDraft=null;render();toast('Rascunho salvo. O aluno ainda não recebeu as alterações.')});
  }
  function openPlanEditor(dayIndex=null){
    editorDraft=clone(loadDraft());planModal=showModal(planEditorHtml());planModal.querySelector('.vp-modal')?.classList.add('vp-student-plan-editor-modal');bindPlanEditor();
    if(dayIndex!=null)setTimeout(()=>planModal?.querySelector(`[data-student-editor-day="${dayIndex}"]`)?.scrollIntoView({behavior:'smooth',block:'start'}),80);
  }
  async function openExercisePicker(di,ei){
    readPlanEditor();const list=await catalog();if(!planModal||!editorDraft)return;
    if(!list.length){toast('A biblioteca de exercícios ainda não está disponível.');return}
    const box=planModal.querySelector('.vp-modal'),equip=[...new Set(list.map(x=>x.equipment).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));
    box.innerHTML=`<div class="vp-page-head vp-plan-editor-head"><div><span class="vp-plan-kicker">BIBLIOTECA DE EXERCÍCIOS</span><h2>${ei==null?'Adicionar exercício':'Trocar exercício'}</h2><p>Os demais dados do plano permanecem preservados.</p></div><button class="vp-btn ghost" id="backStudentPlanEditor">← Voltar</button></div>
      <div class="vp-catalog-picker-filters"><input id="studentPlanSearch" placeholder="Pesquisar pelo nome" autocomplete="off"><select id="studentPlanMuscle"><option value="all">Todas as partes do corpo</option>${Object.entries(muscleNames).map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}</select><select id="studentPlanSource"><option value="all">Biblioteca completa</option><option value="personal">Meus exercícios</option><option value="builtin">Biblioteca Vaz</option></select><select id="studentPlanEquipment"><option value="all">Todos os equipamentos</option>${equip.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></div>
      <div class="vp-picker-count"><strong id="studentPlanCount">${list.length}</strong> exercício(s) encontrado(s)</div><div class="vp-catalog-picker-list" id="studentPlanPickerList"></div>`;
    box.querySelector('#backStudentPlanEditor').onclick=renderPlanEditor;
    const search=box.querySelector('#studentPlanSearch'),muscle=box.querySelector('#studentPlanMuscle'),source=box.querySelector('#studentPlanSource'),equipment=box.querySelector('#studentPlanEquipment'),rows=box.querySelector('#studentPlanPickerList'),count=box.querySelector('#studentPlanCount');
    const norm=v=>String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
    const draw=()=>{
      const q=norm(search.value),mv=muscle.value,sv=source.value,ev=equipment.value,filtered=list.filter(x=>(!q||norm(`${x.name} ${muscleNames[x.muscle]||x.muscle||''} ${x.equipment||''}`).includes(q))&&(mv==='all'||x.muscle===mv)&&(sv==='all'||(x.source||'builtin')===sv)&&(ev==='all'||x.equipment===ev));
      count.textContent=String(filtered.length);
      rows.innerHTML=filtered.slice(0,160).map(x=>`<button class="vp-picker-ex" data-student-pick="${esc(x.id)}"><div><strong>${esc(x.name)}</strong><small>${esc(muscleNames[x.muscle]||x.muscle||'Outro')} • ${esc(x.equipment||'Sem equipamento')} • ${x.source==='personal'?'Seu exercício':'Biblioteca Vaz'}</small></div><div class="vp-picker-prescription"><span>${esc(x.reps||'8-12')}</span><b>${Number(x.sets)||3}x</b></div></button>`).join('')||'<div class="vp-empty">Nenhum exercício encontrado.</div>';
      rows.querySelectorAll('[data-student-pick]').forEach(b=>b.onclick=()=>{const found=list.find(x=>String(x.id)===String(b.dataset.studentPick));if(!found)return;const day=editorDraft.plan[di];day.exercises=day.exercises||[];if(ei==null)day.exercises.push(exerciseFromCatalog(found));else day.exercises[ei]=exerciseFromCatalog(found);renderPlanEditor();toast(ei==null?'Exercício adicionado.':'Exercício substituído.')});
    };
    [search,muscle,source,equipment].forEach(el=>el.addEventListener(el===search?'input':'change',draw));draw();setTimeout(()=>search.focus(),40);
  }

  async function launchPlan(){
    const draft=loadDraft();if(!draft.plan?.length)return toast('Monte um plano antes de lançar.');
    const ok=typeof vpConfirm==='function'?await vpConfirm('Lançar plano para o aluno?','O Vaz Fitness do aluno será atualizado com este plano e o ciclo selecionado.','Lançar para aluno'):confirm('Lançar este plano para o aluno?');
    if(!ok)return;
    const button=document.getElementById('launchStudentPlan');if(button){button.disabled=true;button.textContent='Lançando…'}
    try{
      const request=activeRequest();
      const result=await vfApi('personal_plan',{method:'POST',body:{athleteId:athleteId(),plan:draft.plan,notes:draft.notes||'',requestId:request?.id||null}});
      const cycleMode=selectedOps?.cycle?.status==='not_started'?'start':'renew';
      await opsApi('cycle',{method:'POST',body:{athleteId:athleteId(),cycleDays:Number(draft.cycleDays)||30,mode:cycleMode}});
      if(selected?.athlete?.status==='pending')await vfApi('personal_access',{method:'POST',body:{athleteId:athleteId(),mode:'approve'}});
      clearDraft();
      const [athleteData,opsData]=await Promise.all([vfApi('personal_client',{params:{athleteId:athleteId()}}),opsApi('client',{params:{athleteId:athleteId()}})]);
      selected=athleteData;selectedOps=opsData;aiDraft=false;clientTab='plan';await loadPersonal();render();
      toast(`Plano lançado para o aluno • versão ${result.plan_version||selected.plan?.plan_version||''}.`);
    }catch(e){toast(e.message);if(button){button.disabled=false;button.textContent='Lançar para aluno'}}
  }

  const previousBind=bindPersonal;
  bindPersonal=function(){
    previousBind();
    document.getElementById('openStudentPlanning')?.addEventListener('click',openPlanning);
    document.getElementById('aionStructureStudentPlan')?.addEventListener('click',()=>generateAionStructure(newPlanning(),document.getElementById('aionStructureStudentPlan')));
    document.getElementById('editStudentPlan')?.addEventListener('click',()=>openPlanEditor());
    document.querySelectorAll('[data-edit-student-day]').forEach(b=>b.onclick=()=>openPlanEditor(Number(b.dataset.editStudentDay)));
    document.getElementById('discardStudentDraft')?.addEventListener('click',async()=>{const ok=typeof vpConfirm==='function'?await vpConfirm('Descartar rascunho?','As alterações que ainda não foram lançadas serão perdidas.','Descartar'):confirm('Descartar rascunho?');if(!ok)return;clearDraft();selected.plan={...(selected.plan||{}),plan:clone(selected?.plan?.plan||[])};const fresh=await vfApi('personal_client',{params:{athleteId:athleteId()}});selected=fresh;aiDraft=false;render();toast('Rascunho descartado.')});
    document.getElementById('launchStudentPlan')?.addEventListener('click',launchPlan);
  };

  const style=document.createElement('style');
  style.textContent=`
    .vp-planning-v25{margin-bottom:12px;background:linear-gradient(135deg,#fffdf2,#fff)}
    .vp-planning-v25-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}
    .vp-planning-v25-meta span{border:1px solid #ece8dc;background:#fff;border-radius:14px;padding:10px;font-size:10px;color:var(--muted)}
    .vp-planning-v25-meta b{display:block;color:var(--ink);font-size:15px;margin-bottom:2px}
    .vp-planning-v25-actions{justify-content:flex-end}
    .vp-plan-preview-list{display:grid;gap:8px;margin-top:12px}
    .vp-plan-preview-day{display:grid;grid-template-columns:44px auto minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid var(--line);border-radius:17px;padding:12px;background:#fff}
    .vp-plan-preview-day>div:nth-of-type(2) strong,.vp-plan-preview-day>div:nth-of-type(2) small{display:block}
    .vp-plan-preview-day small{color:var(--muted);font-size:10px;margin-top:3px}
    .vp-plan-draft-banner{margin:10px 0}
    .vp-launch-bar{margin-top:14px;padding:14px;border-radius:18px;background:#191919;color:#fff;display:flex;align-items:center;justify-content:space-between;gap:12px}
    .vp-launch-bar strong,.vp-launch-bar small{display:block}.vp-launch-bar small{color:#cfcfcf;margin-top:3px;font-size:10px}
    .vp-student-planning-modal,.vp-student-plan-editor-modal{width:min(980px,calc(100vw - 20px));max-height:92dvh;overflow:auto}
    .vp-planning-head,.vp-plan-editor-head{position:sticky;top:0;background:#fff;z-index:4;padding-bottom:10px}
    .vp-planning-context{margin:12px 0;padding:12px 14px;border-left:3px solid var(--yellow);background:#fffdf2;border-radius:0 14px 14px 0}
    .vp-planning-context strong,.vp-planning-context span{display:block}.vp-planning-context span{font-size:10px;color:var(--muted);line-height:1.5;margin-top:3px}
    .vp-planning-modal-actions,.vp-plan-editor-footer{position:sticky;bottom:0;background:#fff;border-top:1px solid var(--line);padding:12px 0 4px;justify-content:flex-end;z-index:4}
    .vp-student-editor-day{margin-top:10px}
    .vp-student-editor-exercises{margin-top:9px}
    .vp-student-editor-ex{grid-template-columns:minmax(220px,1.5fr) repeat(4,minmax(80px,.55fr)) auto}
    .vp-plan-editor-notes{margin-top:14px}
    @media(max-width:760px){
      .vp-planning-v25-meta{grid-template-columns:1fr 1fr}
      .vp-planning-v25-actions,.vp-planning-modal-actions,.vp-plan-editor-footer{flex-direction:column;align-items:stretch}
      .vp-planning-v25-actions .vp-btn,.vp-planning-modal-actions .vp-btn,.vp-plan-editor-footer .vp-btn{width:100%}
      .vp-plan-preview-day{grid-template-columns:42px minmax(0,1fr) auto}
      .vp-plan-preview-day .vp-split-letter{display:none}
      .vp-launch-bar{align-items:stretch;flex-direction:column}.vp-launch-bar .vp-btn{width:100%}
      .vp-student-editor-ex{grid-template-columns:1fr 1fr}.vp-student-editor-ex .vp-template-exercise-choice{grid-column:1/-1}.vp-student-editor-ex>.vp-btn{grid-column:1/-1;width:100%}
    }
  `;
  document.head.appendChild(style);
})();