// Vaz Fitness — onboarding V3: metas por modalidade, maratona e níveis separados.
(function installOnboardingV3(){
  const form=document.getElementById('onboardingForm');
  if(!form)return;

  const STRENGTH_GOALS=[
    ['hypertrophy','Hipertrofia'],
    ['weight_loss','Emagrecimento'],
    ['recomp','Recomposição corporal'],
    ['strength','Força'],
    ['conditioning','Condicionamento']
  ];
  const RUN_GOALS=[
    ['conditioning','Condicionamento'],
    ['5k','Melhorar 5 km'],
    ['10k','Melhorar 10 km'],
    ['21k','Meia maratona'],
    ['42k','Maratona']
  ];
  const HYBRID_GOALS=[
    ['hypertrophy','Hipertrofia'],
    ['weight_loss','Emagrecimento'],
    ['recomp','Recomposição corporal'],
    ['strength','Força'],
    ['conditioning','Condicionamento'],
    ['5k','Melhorar 5 km'],
    ['10k','Melhorar 10 km'],
    ['21k','Meia maratona'],
    ['42k','Maratona']
  ];
  const LEVELS=[['beginner','Iniciante'],['intermediate','Intermediário'],['advanced','Avançado']];

  function normalizedRunningLevel(value){
    if(value==='new'||value==='beginner')return 'beginner';
    if(value==='performance'||value==='advanced')return 'advanced';
    return 'intermediate';
  }
  function legacyRunningLevel(value){return value==='beginner'?'new':value==='advanced'?'performance':'regular';}
  function selectedMode(){return form.querySelector('input[name="mode"]:checked')?.value||state.profile.mode||'hybrid';}
  function levelLabel(value){return value==='advanced'?'Avançado':value==='beginner'?'Iniciante':'Intermediário';}

  // Mantém a modalidade atual marcada ao reabrir a avaliação.
  const currentMode=state.profile.mode||'hybrid';
  const currentModeInput=form.querySelector(`input[name="mode"][value="${currentMode}"]`);
  if(currentModeInput)currentModeInput.checked=true;

  const goalSelect=form.querySelector('select[name="goal"]');
  const legacyLevelSelect=form.querySelector('select[name="level"]');
  const prioritySelect=form.querySelector('select[name="priorityMuscle"]');
  const priorityLabel=prioritySelect?.closest('label');
  const legacyRunLevelSelect=form.querySelector('select[name="runLevel"]');
  const legacyRunLevelLabel=legacyRunLevelSelect?.closest('label');
  const paceInput=form.querySelector('input[name="easyPace"]');
  const paceLabel=paceInput?.closest('label');
  const goalRow=goalSelect?.closest('.field-row');
  const legacyLevelLabel=legacyLevelSelect?.closest('label');
  const runStep=paceInput?.closest('.step');

  if(legacyLevelLabel)legacyLevelLabel.style.display='none';
  if(legacyRunLevelLabel)legacyRunLevelLabel.style.display='none';

  const levelsPanel=document.createElement('div');
  levelsPanel.className='modality-level-panel';
  levelsPanel.innerHTML=`
    <div class="field-row modality-levels">
      <label data-strength-level>Nível na musculação
        <select name="strengthLevel">${LEVELS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>
      </label>
      <label data-running-level>Nível na corrida
        <select name="runningLevel">${LEVELS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>
      </label>
    </div>
    <label data-hybrid-focus>Prioridade do plano híbrido
      <select name="hybridFocus">
        <option value="balanced">Equilibrado</option>
        <option value="strength">Mais foco em musculação</option>
        <option value="running">Mais foco em corrida</option>
      </select>
    </label>`;
  goalRow?.after(levelsPanel);

  const strengthLevelSelect=form.querySelector('select[name="strengthLevel"]');
  const runningLevelSelect=form.querySelector('select[name="runningLevel"]');
  const hybridFocusSelect=form.querySelector('select[name="hybridFocus"]');
  strengthLevelSelect.value=state.profile.strengthLevel||state.profile.level||'intermediate';
  runningLevelSelect.value=state.profile.runningLevel||normalizedRunningLevel(state.profile.runLevel);
  hybridFocusSelect.value=state.profile.hybridFocus||'balanced';

  function goalsFor(mode){return mode==='strength'?STRENGTH_GOALS:mode==='run'?RUN_GOALS:HYBRID_GOALS;}
  function updateGoalOptions(mode){
    if(!goalSelect)return;
    const goals=goalsFor(mode);
    const previous=goalSelect.value||state.profile.goal;
    goalSelect.innerHTML=goals.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
    const allowed=goals.some(([value])=>value===previous);
    const fallback=mode==='run'?'conditioning':'hypertrophy';
    goalSelect.value=allowed?previous:fallback;
  }

  function updateModeFields(){
    const mode=selectedMode();
    updateGoalOptions(mode);
    const strengthLabel=levelsPanel.querySelector('[data-strength-level]');
    const runningLabel=levelsPanel.querySelector('[data-running-level]');
    const hybridFocus=levelsPanel.querySelector('[data-hybrid-focus]');
    if(strengthLabel)strengthLabel.style.display=mode==='run'?'none':'';
    if(runningLabel)runningLabel.style.display=mode==='strength'?'none':'';
    if(hybridFocus)hybridFocus.style.display=mode==='hybrid'?'':'none';
    if(priorityLabel)priorityLabel.style.display=mode==='run'?'none':'';
    if(paceLabel)paceLabel.style.display=mode==='strength'?'none':'';
    if(runStep?.querySelector('h2'))runStep.querySelector('h2').textContent=mode==='strength'?'Confirmação e disponibilidade':'Corrida e disponibilidade';
  }

  form.querySelectorAll('input[name="mode"]').forEach(input=>input.addEventListener('change',updateModeFields));
  updateModeFields();
  if(goalsFor(currentMode).some(([value])=>value===state.profile.goal))goalSelect.value=state.profile.goal;

  const style=document.createElement('style');
  style.textContent=`.modality-level-panel{margin-top:14px}.modality-level-panel>[data-hybrid-focus]{display:block;margin-top:14px}.modality-levels{align-items:end}.mode-helper{font-size:11px;color:var(--muted);line-height:1.5;margin-top:8px}.level-summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.level-summary-grid>div{padding:13px;border:1px solid var(--line);border-radius:16px;background:#fafafa}.level-summary-grid span{display:block;color:var(--muted);font-size:10px}.level-summary-grid strong{display:block;margin-top:4px;font-size:14px}@media(max-width:560px){.level-summary-grid{grid-template-columns:1fr}.modality-levels{grid-template-columns:1fr}}`;
  document.head.appendChild(style);

  // Salva os níveis de cada modalidade separadamente e mantém os campos legados compatíveis.
  form.onsubmit=e=>{
    e.preventDefault();
    const fd=new FormData(e.currentTarget);
    const name=String(fd.get('name')||state.profile.name||'').trim().slice(0,40);
    const age=Number(fd.get('age')),weight=Number(fd.get('weight')),height=Number(fd.get('height'));
    if(!name){toast('Informe seu nome.');return;}
    if(!Number.isFinite(age)||age<13||age>100||!Number.isFinite(weight)||weight<30||weight>350||!Number.isFinite(height)||height<120||height>230){toast('Revise idade, peso e altura.');return;}
    const mode=fd.get('mode')||'hybrid';
    const strengthLevel=String(fd.get('strengthLevel')||state.profile.strengthLevel||'intermediate');
    const runningLevel=String(fd.get('runningLevel')||state.profile.runningLevel||'intermediate');
    const hybridFocus=mode==='hybrid'?String(fd.get('hybridFocus')||'balanced'):'balanced';
    state.profile={...state.profile,
      name,age,weight,height,sex:fd.get('sex')||'prefer_not',profileVersion:2,onboardingVersion:3,
      mode,goal:fd.get('goal'),strengthLevel,runningLevel,hybridFocus,
      level:mode==='run'?runningLevel:strengthLevel,
      runLevel:legacyRunningLevel(runningLevel),
      priorityMuscle:fd.get('priorityMuscle')||state.profile.priorityMuscle||'shoulders',
      days:+fd.get('days'),minutes:+fd.get('minutes'),location:fd.get('location'),easyPace:fd.get('easyPace')||state.profile.easyPace||'5:30'
    };
    state.onboarded=true;generatePlan();save();document.getElementById('onboardingDialog').close();render();toast('Plano personalizado gerado!');
  };

  const previousGoalName=goalName;
  goalName=function(goal){return goal==='42k'?'Maratona':previousGoalName(goal);};

  // Ajusta volume e sessões conforme modalidade e nível sem prescrever carga inicial arbitrária.
  const previousGeneratePlan=generatePlan;
  generatePlan=function(){
    previousGeneratePlan();
    const p=state.profile;
    const strengthLevel=p.strengthLevel||p.level||'intermediate';
    const runningLevel=p.runningLevel||normalizedRunningLevel(p.runLevel);
    let strength=state.plan.filter(x=>x.type==='strength');
    let runs=state.plan.filter(x=>x.type==='run');

    strength=strength.map(day=>{
      let exercises=day.exercises||[];
      if(strengthLevel==='beginner'){
        exercises=exercises.slice(0,Math.min(5,exercises.length)).map((ex,index)=>({...ex,sets:Math.max(2,Math.min(ex.sets,index<2?3:2)),rest:Math.max(ex.rest,index<2?90:60)}));
      }
      return {...day,level:strengthLevel,exercises};
    });

    const baseDuration=runningLevel==='beginner'?25:runningLevel==='advanced'?45:35;
    runs=runs.map((run,index)=>{
      let duration=Number(run.duration)||baseDuration;
      let intensity=run.intensity;
      let name=run.name;
      if(runningLevel==='beginner'){
        duration=Math.min(duration,35);
        if(intensity==='Forte'){intensity='Moderado';name='Trote intervalado';}
      }else if(runningLevel==='advanced'){
        duration=Math.min(90,Math.round(duration*1.15));
      }
      if(p.goal==='42k'&&index===Math.min(2,runs.length-1)){
        name='Longão — base para maratona';
        duration=runningLevel==='beginner'?45:runningLevel==='advanced'?75:60;
        intensity='Moderado';
      }
      return {...run,name,duration,intensity,pace:suggestRunPace(intensity),level:runningLevel};
    });

    const days=Math.max(2,Math.min(6,+p.days||4));
    if(p.mode==='run'){
      // Corrida pura: nenhum treino de musculação entra no plano semanal.
      if(!runs.length){
        const preferred=[1,2,3,4,5,6,0],today=new Date().getDay(),start=Math.max(0,preferred.indexOf(today));
        const templates=runningLevel==='beginner'?[['Corrida leve',25,'Leve'],['Caminhada + trote',30,'Leve'],['Corrida contínua',35,'Moderado']]:[['Rodagem leve',35,'Leve'],['Intervalado',45,'Forte'],['Longão',60,'Moderado'],['Tempo run',40,'Moderado'],['Progressivo',45,'Moderado']];
        for(let i=0;i<days;i++){
          const t=templates[i%templates.length];
          runs.push({id:`r-v3-${Date.now()}-${i}`,type:'run',name:t[0],day:preferred[(start+i*2)%7],duration:t[1],intensity:t[2],pace:suggestRunPace(t[2]),status:'pending',level:runningLevel});
        }
      }
      state.plan=runs.slice(0,days);
    }else if(p.mode==='strength'){
      state.plan=strength.slice(0,days);
    }else{
      const focus=p.hybridFocus||'balanced';
      let desiredRuns=focus==='strength'?1:focus==='running'?Math.min(3,Math.max(2,days-2)):(days>=4?2:1);
      desiredRuns=Math.min(desiredRuns,Math.max(1,days-1));
      const desiredStrength=Math.max(1,days-desiredRuns);
      state.plan=[...strength.slice(0,desiredStrength),...runs.slice(0,desiredRuns)];
    }
    state.plan.sort((a,b)=>orderFromToday(a.day)-orderFromToday(b.day));
    save();
  };

  const previousRenderProfile=renderProfile;
  renderProfile=function(){
    const html=previousRenderProfile();
    const p=state.profile;
    const mode=p.mode||'hybrid';
    const strengthLevel=p.strengthLevel||p.level||'intermediate';
    const runningLevel=p.runningLevel||normalizedRunningLevel(p.runLevel);
    const focusLabel={balanced:'Equilibrado',strength:'Mais foco em musculação',running:'Mais foco em corrida'}[p.hybridFocus]||'Equilibrado';
    const columns=[];
    if(mode!=='run')columns.push(`<div><span>Musculação</span><strong>${levelLabel(strengthLevel)}</strong></div>`);
    if(mode!=='strength')columns.push(`<div><span>Corrida</span><strong>${levelLabel(runningLevel)}</strong></div>`);
    if(mode==='hybrid')columns.push(`<div><span>Prioridade híbrida</span><strong>${focusLabel}</strong></div>`);
    const card=`<div class="card"><div class="card-head"><div><h2>Nível por modalidade</h2><p>A AION adapta cada modalidade de forma independente</p></div></div><div class="level-summary-grid">${columns.join('')}</div></div>`;
    return html.replace(/<\/section>\s*$/,`${card}</section>`);
  };

  // Usuários já cadastrados recebem a nova avaliação apenas uma vez.
  if(state.onboarded&&state.profile.onboardingVersion!==3){
    setTimeout(()=>{toast('Atualizamos a avaliação: agora corrida e musculação têm níveis separados.');openOnboarding();},700);
  }
})();
