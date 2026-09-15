// Vaz Fitness — calibração segura de carga para perfis novos.
(function installLoadCalibration(){
  const bodyweightIds=new Set(['plank']);

  cloneExercise=function(id){
    const base=exerciseLibrary.find(x=>x.id===id);
    const hist=[...state.sessions].reverse().flatMap(s=>s.exercises||[]).find(e=>e.id===id&&e.completedSets?.length);
    const hasHistory=!!hist;
    const historicalLoad=hist?.nextLoad ?? hist?.completedSets?.filter(s=>Number(s.load)>0).at(-1)?.load ?? hist?.load;
    let sets=base.sets;
    let rest=base.rest;
    if(state.profile.level==='beginner')sets=Math.max(2,sets-1);
    if(Number(state.profile.age)>=55)rest+=15;
    const bodyweight=bodyweightIds.has(id);
    return {
      ...base,
      sets,
      rest,
      load:hasHistory?(Number(historicalLoad)||0):(bodyweight?0:null),
      needsLoadCalibration:!hasHistory&&!bodyweight,
      effort:null
    };
  };

  renderSetRow=function(ex,i){
    const prev=ex.completedSets?.[i];
    const loadValue=prev?.load ?? (Number.isFinite(Number(ex.load))&&ex.load!==null?ex.load:'');
    return `<div class="set-row"><span class="set-index" aria-label="Série ${i+1}">${i+1}</span><input type="number" inputmode="decimal" step="0.5" min="0" value="${loadValue}" placeholder="${ex.needsLoadCalibration?'Peso':''}" data-set-load="${i}" aria-label="Peso em quilogramas da série ${i+1}" title="Peso (kg)"><input type="number" inputmode="numeric" min="1" value="${prev?.reps ?? repTarget(ex.reps)}" data-set-reps="${i}" aria-label="Repetições da série ${i+1}" title="Repetições"><button class="set-check ${prev?'done':''}" data-set-done="${i}" aria-label="Marcar série ${i+1} como concluída">${prev?'✓':'○'}</button></div>`;
  };

  const baseCompleteSet=completeSet;
  completeSet=function(i){
    const ex=state.current?.exercises?.[state.current.currentIndex];
    const field=document.querySelector(`[data-set-load="${i}"]`);
    if(ex?.needsLoadCalibration&&(!field||field.value===''||Number(field.value)<=0)){
      toast('Informe o peso usado nesta série para calibrar sua carga.');field?.focus();return;
    }
    baseCompleteSet(i);
  };

  const baseCompleteExercise=completeExercise;
  completeExercise=function(){
    const ex=state.current?.exercises?.[state.current.currentIndex];
    if(ex?.needsLoadCalibration){
      const fields=[...document.querySelectorAll('[data-set-load]')];
      if(fields.some(f=>f.value===''||Number(f.value)<=0)){
        toast('Primeiro treino deste exercício: registre o peso de todas as séries para a AION aprender sua carga.');
        fields.find(f=>f.value===''||Number(f.value)<=0)?.focus();return;
      }
    }
    baseCompleteExercise();
  };

  renderWorkout=function(){
    const today=todaysItem();
    const strength=state.plan.filter(x=>x.type==='strength');
    return `<section class="workout-hero"><div><span class="eyebrow">TREINO</span><h1>${today?today.name:'Plano concluído'}</h1><p>${today?today.type==='run'?`Pace sugerido ${today.pace}/km • intensidade ${today.intensity}`:`Ênfase do ciclo: ${muscleNames[state.profile.priorityMuscle]}. ${today.exercises.length} exercícios em até ${today.duration} min.`:'Gere uma nova semana para continuar.'}</p></div>${today?`<button class="btn dark" data-start="${today.id}">▶ Iniciar agora</button>`:`<button class="btn primary" data-regenerate>Gerar semana</button>`}</section>
    <div class="grid two"><div class="card"><div class="card-head"><div><h2>Planejamento</h2><p>Musculação e corrida integradas</p></div></div><div class="plan-list">${state.plan.map(renderPlanItem).join('')}</div></div>
    <div class="card"><div class="card-head"><div><h2>Próximo treino de força</h2><p>Progressão orientada por esforço</p></div></div><div class="workout-list">${(strength.find(x=>x.status==='pending')?.exercises||[]).map(e=>`<div class="exercise-row"><div class="exercise-icon">${e.icon}</div><div><strong>${e.name}</strong><small>${muscleNames[e.muscle]}${e.priority?' • prioridade do ciclo':''}</small></div><div class="exercise-meta"><strong>${e.sets}× ${e.reps}</strong><small>${e.needsLoadCalibration?'Calibrar carga':e.load?`Sug. ${e.load} kg`:'Peso corporal'}</small></div></div>`).join('')||'<p style="color:#777">Nenhum treino pendente.</p>'}</div></div></div>`;
  };

  const style=document.createElement('style');
  style.textContent=`.set-row input::placeholder{color:#8d8d8d;font-size:11px}.calibration-note{font-size:11px;color:#c9c9c9}`;
  document.head.appendChild(style);
})();
