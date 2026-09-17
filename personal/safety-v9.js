// Vaz Personal v9 — rascunho separado da liberação, validação de descanso e sincronização segura.
(()=>{
  const draftApi=(athleteId,o={})=>req('/api/plan-draft',{...o,params:{...(o.params||{}),athleteId}});

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
  function currentEditorPlan(){
    const plan=collectPlan();
    if(!plan.length)throw new Error('Adicione pelo menos um dia de treino antes de salvar.');
    validatePlanAgainstRestDays(plan);
    return {plan,notes:document.getElementById('planNotes')?.value||''};
  }

  const baseOpenClientV9=openClient;
  openClient=async function(id,tab='summary'){
    await baseOpenClientV9(id,tab);
    if(!selected?.athlete?.id)return;
    try{
      const data=await draftApi(selected.athlete.id);
      if(data?.draft?.plan?.length){
        selected.plan={...(selected.plan||{}),plan:data.draft.plan,notes:data.draft.notes||'',__draft:true,draftUpdatedAt:data.draft.updated_at};
        aiDraft=true;
        render();
      }
    }catch{}
  };

  const baseRenderClientPlanV9=renderClientPlan;
  renderClientPlan=function(){
    const html=baseRenderClientPlanV9();
    if(!selected?.plan?.__draft)return html;
    const updated=selected.plan.draftUpdatedAt?fmtDate(selected.plan.draftUpdatedAt):'agora';
    return `<div class="vp-alert warn vp-section"><span>✎</span><div><strong>Rascunho do personal</strong><small>Salvo em ${safe(updated)}. O aluno continua usando o plano atual até você clicar em “Salvar e liberar novo ciclo”.</small></div></div>${html}`;
  };

  // “Salvar” passa a guardar apenas um rascunho no servidor. O treino ativo do aluno não é alterado.
  savePlan=async function(options={}){
    const {silent=false,skipRender=false}=options&&typeof options==='object'?options:{};
    try{
      const {plan,notes}=currentEditorPlan();
      const data=await draftApi(selected.athlete.id,{method:'POST',body:{athleteId:selected.athlete.id,plan,notes}});
      selected.plan={...selected.plan,plan,notes,__draft:true,draftUpdatedAt:data?.draft?.updated_at||new Date().toISOString()};
      aiDraft=true;
      if(!silent)toast('Rascunho salvo. O treino atual do aluno foi mantido.');
      if(!skipRender)render();
      return data;
    }catch(error){
      if(!silent)toast(error.message||'Não foi possível salvar o rascunho.');
      throw error;
    }
  };

  // Somente esta ação publica o novo plano no Vaz Fitness.
  releaseCycle=async function(){
    const cycleSelect=document.getElementById('cycleDays');
    const days=Number(cycleSelect?.value)||Number(selectedOps?.cycle?.days)||30;
    const athleteId=selected?.athlete?.id;
    if(!athleteId)return toast('Abra um aluno antes de liberar o ciclo.');
    try{
      clientTab='plan';
      render();
      await new Promise(resolve=>setTimeout(resolve,0));
      const {plan,notes}=currentEditorPlan();
      const published=await vfApi('personal_plan',{method:'POST',body:{athleteId,plan,notes}});
      selected.plan={...selected.plan,plan,notes,plan_version:published.plan_version,__draft:false,draftUpdatedAt:null};
      aiDraft=false;
      await draftApi(athleteId,{method:'DELETE'}).catch(()=>{});
      await opsApi('cycle',{method:'POST',body:{athleteId,cycleDays:days,mode:'renew'}});
      if(selected.athlete.status!=='approved')await vfApi('personal_access',{method:'POST',body:{athleteId,mode:'approve'}});
      await loadPersonal();
      await openClient(athleteId,'management');
      toast('Novo ciclo liberado. O Vaz Fitness será atualizado automaticamente.');
    }catch(error){
      toast(error.message||'O novo ciclo não foi liberado. Revise o plano e tente novamente.');
    }
  };
})();
