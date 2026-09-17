// Vaz Personal v9 — liberação segura do novo ciclo e validação dos dias de descanso.
(()=>{
  function activeRestDays(){
    const request=(selectedOps?.requests||[]).find(r=>['pending','reviewing'].includes(r.status));
    const source=request?.rest_days||selected?.state?.profile?.restDays||[];
    return [...new Set((source||[]).map(Number).filter(d=>Number.isInteger(d)&&d>=0&&d<=6))].slice(0,5).sort((a,b)=>a-b);
  }
  function validatePlanAgainstRestDays(plan){
    const blocked=activeRestDays();
    if(!blocked.length)return;
    const conflicts=(plan||[]).filter(day=>blocked.includes(Number(day.day)));
    if(!conflicts.length)return;
    const names=['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
    const conflictDays=[...new Set(conflicts.map(day=>Number(day.day)))].map(day=>names[day]).join(', ');
    throw new Error(`Há treino marcado em dia de descanso (${conflictDays}). Ajuste os dias antes de salvar.`);
  }

  savePlan=async function(options={}){
    const {silent=false,skipRender=false}=options&&typeof options==='object'?options:{};
    try{
      const plan=collectPlan();
      if(!plan.length)throw new Error('Adicione pelo menos um dia de treino antes de salvar.');
      validatePlanAgainstRestDays(plan);
      const notes=document.getElementById('planNotes')?.value||'';
      const data=await vfApi('personal_plan',{method:'POST',body:{athleteId:selected.athlete.id,plan,notes}});
      selected.plan={...selected.plan,plan,notes,plan_version:data.plan_version};
      aiDraft=false;
      if(!silent)toast('Plano salvo e sincronizado.');
      if(!skipRender)render();
      return data;
    }catch(error){
      if(!silent)toast(error.message||'Não foi possível salvar o plano.');
      throw error;
    }
  };

  releaseCycle=async function(){
    const cycleSelect=document.getElementById('cycleDays');
    const days=Number(cycleSelect?.value)||Number(selectedOps?.cycle?.days)||30;
    const athleteId=selected?.athlete?.id;
    if(!athleteId)return toast('Abra um aluno antes de liberar o ciclo.');
    try{
      // O plano é salvo primeiro. Se esta etapa falhar, ciclo e acesso NÃO são alterados.
      clientTab='plan';
      render();
      await new Promise(resolve=>setTimeout(resolve,0));
      await savePlan({silent:true,skipRender:true});
      await opsApi('cycle',{method:'POST',body:{athleteId,cycleDays:days,mode:'renew'}});
      if(selected.athlete.status!=='approved')await vfApi('personal_access',{method:'POST',body:{athleteId,mode:'approve'}});
      await loadPersonal();
      await openClient(athleteId,'management');
      toast('Novo ciclo liberado para o aluno. O Vaz Fitness será atualizado automaticamente.');
    }catch(error){
      toast(error.message||'O novo ciclo não foi liberado. Revise o plano e tente novamente.');
    }
  };
})();
