// Vaz Fitness — confirmação ao encerrar treino incompleto.
(function installWorkoutExitFlow(){
  function completedSetCount(ex){return (ex?.completedSets||[]).filter(Boolean).length;}
  function workoutProgress(){
    const c=state.current;
    if(!c)return {planned:0,done:0,percent:0,complete:false};
    const planned=c.exercises.reduce((sum,e)=>sum+(Number(e.sets)||0),0);
    const done=c.exercises.reduce((sum,e)=>sum+completedSetCount(e),0);
    const allEffort=c.exercises.every(e=>completedSetCount(e)>=Number(e.sets||0)&&!!e.effort);
    const percent=planned?Math.round(done/planned*100):0;
    return {planned,done,percent,complete:planned>0&&done>=planned&&allEffort};
  }

  const dialog=document.createElement('dialog');
  dialog.id='workoutExitDialog';
  dialog.className='dialog workout-exit-dialog';
  dialog.innerHTML=`<div class="workout-exit-content">
    <span class="eyebrow">ENCERRAR TREINO</span>
    <h2>Seu treino ainda não terminou.</h2>
    <p id="workoutExitText">Existem séries ou exercícios pendentes.</p>
    <div class="workout-exit-progress"><div><span>Séries concluídas</span><strong id="workoutExitSeries">0/0</strong></div><div><span>Progresso</span><strong id="workoutExitPercent">0%</strong></div></div>
    <div class="workout-exit-note"><strong>Finalizar mesmo</strong><span>Salva o que você fez e marca o treino como concluído parcialmente.</span></div>
    <div class="workout-exit-note danger"><strong>Abandonar treino</strong><span>O treino não será marcado como concluído e aparecerá como falha/abandono no calendário.</span></div>
    <div class="workout-exit-actions">
      <button type="button" class="btn ghost" data-exit-continue>Continuar treino</button>
      <button type="button" class="btn white" data-exit-finalize>Finalizar mesmo</button>
      <button type="button" class="btn danger-soft" data-exit-abandon>Abandonar treino</button>
    </div>
  </div>`;
  document.body.appendChild(dialog);

  function openWorkoutExit(){
    if(!state.current)return;
    const p=workoutProgress();
    if(p.complete){finishWorkout();return;}
    const remaining=Math.max(0,p.planned-p.done);
    document.getElementById('workoutExitText').textContent=`Você concluiu ${p.done} de ${p.planned} séries. Ainda ${remaining===1?'falta 1 série':`faltam ${remaining} séries`} ou exercícios para finalizar o planejamento.`;
    document.getElementById('workoutExitSeries').textContent=`${p.done}/${p.planned}`;
    document.getElementById('workoutExitPercent').textContent=`${p.percent}%`;
    dialog.showModal();
  }

  function partialMuscleScore(exercises){
    const score={};
    exercises.forEach(e=>{
      const sets=completedSetCount(e);
      if(!sets)return;
      score[e.muscle]=(score[e.muscle]||0)+sets*3;
      (e.secondary||[]).forEach(m=>score[m]=(score[m]||0)+sets);
    });
    return score;
  }

  function finalizePartialWorkout(){
    if(!state.current)return;
    dialog.close();
    clearInterval(workoutTimer);
    const c=state.current;
    const item=state.plan.find(x=>x.id===c.planId);
    const progress=workoutProgress();
    const duration=Math.max(1,Math.round((Date.now()-c.startedAt)/60000));
    const exercises=c.exercises
      .filter(e=>completedSetCount(e)>0)
      .map(e=>({...e,completedSets:(e.completedSets||[]).filter(Boolean)}));
    const volume=exercises.reduce((a,e)=>a+e.completedSets.reduce((x,s)=>x+((Number(s.load)||0)*(Number(s.reps)||0)),0),0);
    const session={
      id:Date.now(),date:new Date().toISOString(),name:item?.name||'Treino',duration,volume:Math.round(volume),exercises,
      muscleScore:partialMuscleScore(exercises),planId:c.planId,partial:true,completionPercent:progress.percent,
      completedSeries:progress.done,plannedSeries:progress.planned,plannedExerciseCount:c.exercises.length,
      extraWorkout:!!c.extraWorkout,executedOnRestDay:!!c.executedOnRestDay,
      originalPlanDay:c.originalPlanDay??item?.day,originalPlanId:c.originalPlanId||item?.id
    };
    state.sessions.push(session);
    if(item&&!c.extraWorkout){item.status='done';item.partial=true;item.completionPercent=progress.percent;}
    state.current=null;
    state.score=Math.min(99,state.score+1);
    save();
    window.VazCalendar?.reconcile?.();
    showSummary(session);
    const hero=document.querySelector('#summaryContent .summary-hero');
    if(hero){
      const eyebrow=hero.querySelector('.eyebrow');if(eyebrow)eyebrow.textContent=session.extraWorkout?'TREINO EXTRA FINALIZADO PARCIALMENTE':'TREINO FINALIZADO PARCIALMENTE';
      hero.insertAdjacentHTML('afterend',`<div class="partial-summary-banner"><strong>${progress.percent}% concluído</strong><span>${progress.done} de ${progress.planned} séries registradas. O histórico considera somente o que foi realmente executado.</span></div>`);
    }
    activeView='home';render();
  }

  function abandonWorkout(){
    if(!state.current)return;
    dialog.close();
    clearInterval(workoutTimer);
    const c=state.current;
    const item=state.plan.find(x=>x.id===c.planId);
    const progress=workoutProgress();
    const now=new Date().toISOString();
    if(item&&!c.extraWorkout){
      item.status='abandoned';
      item.abandonedAt=now;
      item.completionPercent=progress.percent;
      state.skipped=Array.isArray(state.skipped)?state.skipped:[];
      if(!state.skipped.some(x=>x.id===item.id&&x.reason==='abandoned'))state.skipped.push({id:item.id,date:now,name:item.name,reason:'abandoned',completionPercent:progress.percent});
    }
    state.abandoned=Array.isArray(state.abandoned)?state.abandoned:[];
    state.abandoned.push({id:Date.now(),planId:c.planId,date:now,name:item?.name||'Treino',completedSeries:progress.done,plannedSeries:progress.planned,completionPercent:progress.percent,extraWorkout:!!c.extraWorkout,executedOnRestDay:!!c.executedOnRestDay});
    state.current=null;
    save();
    window.VazCalendar?.reconcile?.();
    activeView='home';render();
    toast('Treino abandonado. Ele não foi marcado como concluído.');
  }

  dialog.querySelector('[data-exit-continue]').addEventListener('click',()=>dialog.close());
  dialog.querySelector('[data-exit-finalize]').addEventListener('click',finalizePartialWorkout);
  dialog.querySelector('[data-exit-abandon]').addEventListener('click',abandonWorkout);
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});

  const previousBindDynamic=bindDynamic;
  bindDynamic=function(){
    previousBindDynamic();
    document.querySelectorAll('[data-finish-early]').forEach(button=>button.onclick=openWorkoutExit);
  };

  const previousRenderPlanItem=renderPlanItem;
  renderPlanItem=function(p){
    if(p.status!=='abandoned')return previousRenderPlanItem(p);
    return `<div class="plan-item skipped"><div class="day-dot">${weekdayNames[p.day]}</div><div class="plan-copy"><strong>${p.name}</strong><small>${p.type==='run'?`${p.duration} min • ${p.pace}/km`:`${p.exercises.length} exercícios • ~${p.duration} min`}</small></div><div class="plan-tag">ABANDONADO</div></div>`;
  };

  const style=document.createElement('style');
  style.textContent=`
    .workout-exit-dialog{width:min(560px,calc(100% - 24px));padding:0;overflow:hidden}.workout-exit-content{padding:24px}.workout-exit-content h2{font-size:28px;margin:6px 0 8px}.workout-exit-content>p{color:var(--muted);line-height:1.5;margin-bottom:18px}.workout-exit-progress{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0}.workout-exit-progress>div{background:#fafafa;border:1px solid var(--line);border-radius:16px;padding:14px}.workout-exit-progress span{display:block;color:var(--muted);font-size:10px}.workout-exit-progress strong{display:block;margin-top:4px;font-size:18px}.workout-exit-note{display:flex;flex-direction:column;gap:4px;padding:13px 14px;border:1px solid var(--line);border-radius:14px;margin-top:9px;background:#fff}.workout-exit-note strong{font-size:13px}.workout-exit-note span{font-size:11px;color:var(--muted);line-height:1.4}.workout-exit-note.danger{background:#fff7f6;border-color:#ffd8d4}.workout-exit-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:20px}.workout-exit-actions [data-exit-abandon]{grid-column:1/-1}.partial-summary-banner{display:flex;flex-direction:column;gap:5px;margin:14px 0;padding:14px 16px;border-radius:16px;background:#fff8d6;border:1px solid #ffe47b}.partial-summary-banner strong{font-size:17px}.partial-summary-banner span{font-size:11px;line-height:1.45;color:#695a12}@media(max-width:520px){.workout-exit-content{padding:20px}.workout-exit-content h2{font-size:24px}.workout-exit-actions{grid-template-columns:1fr}.workout-exit-actions [data-exit-abandon]{grid-column:auto}}
  `;
  document.head.appendChild(style);
})();
