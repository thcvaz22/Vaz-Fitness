function repTarget(r){const n=String(r).match(/\d+/g);return n?+n[n.length-1]:45}
function completeSet(i){
  const c=state.current, ex=c.exercises[c.currentIndex];
  const load=+document.querySelector(`[data-set-load="${i}"]`).value||0;
  const reps=+document.querySelector(`[data-set-reps="${i}"]`).value||0;
  ex.completedSets[i]={load,reps}; save(); render(); toast(`Série ${i+1} registrada`);
}
function completeExercise(){
  const ex=state.current.exercises[state.current.currentIndex];
  for(let i=0;i<ex.sets;i++) if(!ex.completedSets[i]){
    const l=document.querySelector(`[data-set-load="${i}"]`),r=document.querySelector(`[data-set-reps="${i}"]`);
    ex.completedSets[i]={load:+l?.value||ex.load,reps:+r?.value||repTarget(ex.reps)};
  }
  pendingEffortExercise=ex; save(); document.getElementById('effortDialog').showModal();
}
function applyEffort(effort){
  const ex=pendingEffortExercise; if(!ex)return;
  ex.effort=effort;
  const maxLoad=Math.max(...ex.completedSets.map(s=>s.load||0),ex.load||0);
  ex.nextLoad=effort==='easy'?roundLoad(maxLoad*1.05):effort==='moderate'?roundLoad(maxLoad*1.025):roundLoad(maxLoad);
  document.getElementById('effortDialog').close(); pendingEffortExercise=null;
  if(state.current.currentIndex<state.current.exercises.length-1){state.current.currentIndex++;save();render();toast(effort==='easy'?`AION: ótimo. Próxima carga sugerida +5%.`:`Feedback salvo pela AION.`)}
  else finishWorkout();
}
function roundLoad(v){return Math.round(v*2)/2}
function finishWorkout(){
  clearInterval(workoutTimer);
  const c=state.current; const item=state.plan.find(x=>x.id===c.planId);
  const duration=Math.max(1,Math.round((Date.now()-c.startedAt)/60000));
  const exercises=c.exercises;
  const volume=exercises.reduce((a,e)=>a+e.completedSets.reduce((x,s)=>x+(s.load*s.reps),0),0);
  const muscleScore={};
  exercises.forEach(e=>{muscleScore[e.muscle]=(muscleScore[e.muscle]||0)+e.sets*3;e.secondary.forEach(m=>muscleScore[m]=(muscleScore[m]||0)+e.sets)});
  const session={id:Date.now(),date:new Date().toISOString(),name:item?.name||'Treino',duration,volume:Math.round(volume),exercises,muscleScore,planId:c.planId,extraWorkout:!!c.extraWorkout,executedOnRestDay:!!c.executedOnRestDay,originalPlanDay:c.originalPlanDay??item?.day,originalPlanId:c.originalPlanId||item?.id};
  state.sessions.push(session); if(item&&!c.extraWorkout)item.status='done'; state.current=null; state.score=Math.min(99,state.score+1); save();
  showSummary(session); activeView='home'; render();
}
function showSummary(s){
  const muscles=Object.entries(s.muscleScore).sort((a,b)=>b[1]-a[1]); const max=Math.max(...muscles.map(x=>x[1]),1);
  const easy=s.exercises.filter(e=>e.effort==='easy').length, hard=s.exercises.filter(e=>e.effort==='hard').length;
  const msg=easy>hard?'Seu treino teve boa margem de progressão. A AION elevou discretamente as cargas sugeridas onde o esforço ficou fácil.':hard>easy?'O treino ficou exigente. AION vai priorizar consolidação antes de novas subidas de carga.':'Carga e esforço ficaram equilibrados. O plano segue em progressão controlada.';
  document.getElementById('summaryContent').innerHTML=`<div class="summary-wrap"><div class="summary-hero"><span class="eyebrow">${s.extraWorkout?'TREINO EXTRA CONCLUÍDO':'TREINO CONCLUÍDO'}</span><h2>${s.name}</h2><p style="color:#bbb">${msg}</p></div><div class="summary-grid"><div class="summary-box"><small>Duração</small><strong>${s.duration} min</strong></div><div class="summary-box"><small>Volume</small><strong>${s.volume.toLocaleString('pt-BR')} kg</strong></div><div class="summary-box"><small>Exercícios</small><strong>${s.exercises.length}</strong></div></div><div class="card" style="margin-top:14px"><div class="card-head"><div><h3>Músculos estimulados</h3><p>Estimativa de estímulo relativo da sessão</p></div></div><div class="muscle-bars">${muscles.map(([m,v])=>`<div class="bar-row"><span>${muscleNames[m]||m}</span><div class="bar-track"><span style="width:${Math.round(v/max*100)}%"></span></div><strong>${Math.round(v/max*100)}%</strong></div>`).join('')}</div></div><div class="dialog-actions"><button class="btn primary" onclick="document.getElementById('summaryDialog').close()">Concluir</button></div></div>`;
  document.getElementById('summaryDialog').showModal();
}

function startRun(item){
  const pending=state.pendingExtraWorkout,extra=!!(pending&&String(pending.planId)===String(item.id)&&Date.now()-Number(pending.selectedAt||0)<30*60*1000);
  document.getElementById('legacyRunDialog')?.remove();
  const d=document.createElement('dialog');d.id='legacyRunDialog';d.className='dialog';
  d.innerHTML=`<form class="coach-dialog-sheet" data-legacy-run><span class="eyebrow">${extra?'CORRIDA EXTRA':'CORRIDA'}</span><h2>${item.name}</h2><p>Pace sugerido: <strong>${item.pace}/km</strong> • ${item.duration} min</p><label>Pace realizado<input name="pace" value="${item.pace||''}" placeholder="Ex.: 5:15" required></label><label>Esforço<select name="effort"><option value="easy">Fácil</option><option value="moderate" selected>Moderado</option><option value="hard">Difícil</option></select></label><div class="dialog-actions"><button type="button" class="btn ghost" data-close>Cancelar</button><button class="btn primary">Registrar corrida</button></div></form>`;
  document.body.appendChild(d);d.showModal();d.querySelector('[data-close]').onclick=()=>{d.close();d.remove()};
  d.querySelector('form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget),feedback=String(f.get('pace')||item.pace||''),effort=String(f.get('effort')||'moderate');
    state.runSessions.push({id:Date.now(),date:new Date().toISOString(),name:item.name,duration:item.duration,plannedPace:item.pace,pace:feedback,effort,planId:item.id,extraWorkout:extra,executedOnRestDay:extra&&!!pending?.executedOnRestDay,originalPlanDay:item.day,originalPlanId:item.id});
    if(!extra){item.status='done';item.nextPace=suggestRunPace(item.intensity)}else state.pendingExtraWorkout=null;
    state.score=Math.min(99,state.score+1);save();d.close();d.remove();render();toast(extra?'Corrida extra registrada.':`Corrida registrada. Próximo pace sugerido: ${item.nextPace}/km`);
  };
}

function skipItem(id){
  const item=state.plan.find(x=>x.id===id); if(!item)return;
  item.status='skipped';state.skipped.push({id,date:new Date().toISOString(),name:item.name});
  if(item.type==='strength'){
    const missed={}; item.exercises.forEach(e=>missed[e.muscle]=(missed[e.muscle]||0)+e.sets);
    const future=state.plan.filter(x=>x.type==='strength'&&x.status==='pending'&&x.id!==id).slice(0,2);
    Object.keys(missed).forEach(m=>{
      const target=future.find(f=>f.exercises.some(e=>e.muscle===m||e.secondary.includes(m)))||future[0];
      if(target){const ex=target.exercises.find(e=>e.muscle===m||e.secondary.includes(m));if(ex){ex.sets+=1;ex.compensation=true}}
    });
  }
  save();render();toast('AION reorganizou o volume nos próximos treinos.');
}
