// Vaz Personal v12 — rascunho separado e liberação explícita de novo treino.
(()=>{
  function activePlanRequest(){return (selectedOps?.requests||[]).find(r=>['pending','reviewing'].includes(r.status))||null}
  function applySavedDraft(request){
    if(!request||!Array.isArray(request.draft_plan)||!request.draft_plan.length)return false;
    selected.plan={...(selected.plan||{}),plan:request.draft_plan,notes:request.draft_notes??selected.plan?.notes??''};
    aiDraft=true;return true;
  }

  openClient=async function(id,tab='summary'){
    try{
      const [athleteData,opsData]=await Promise.all([vfApi('personal_client',{params:{athleteId:id}}),opsApi('client',{params:{athleteId:id}})]);
      selected=athleteData;selectedOps=opsData;clientTab=tab;view='students';aiDraft=false;
      applySavedDraft(activePlanRequest());render();
    }catch(error){toast(error.message)}
  };

  const previousRenderPlan=renderClientPlan;
  renderClientPlan=function(){
    const request=activePlanRequest(),html=previousRenderPlan();
    if(!request)return html;
    const controls='<button class="vp-btn primary" id="savePlan">Salvar rascunho</button><button class="vp-btn ok" id="releaseRequestedPlan">Liberar novo treino</button>';
    const changed=html.replace('<button class="vp-btn primary" id="savePlan">Salvar</button>',controls);
    const status=request.status==='reviewing'?'Em análise pelo personal':'Nova solicitação';
    const banner='<section class="vp-alert warn"><div><strong>'+status+'</strong><small>O treino atual do aluno continua ativo. Este rascunho só será enviado ao tocar em “Liberar novo treino”.</small></div></section>';
    return banner+changed;
  };

  const previousRenderManagement=renderClientManagement;
  renderClientManagement=function(){
    const request=activePlanRequest(),html=previousRenderManagement();
    if(request?.status!=='reviewing')return html;
    return html.replace('<button class="vp-btn dark" id="acceptPlanRequest">✦ Atender com AION</button>','<button class="vp-btn dark" id="continuePlanRequest">Continuar rascunho</button>');
  };

  const publishRequest=async(request,cycleDays=null)=>{
    const plan=collectPlan(),notes=document.getElementById('planNotes')?.value||'';
    if(!plan.length){toast('Adicione pelo menos um dia ao novo treino.');return false}
    if(!confirm('Liberar este novo treino agora? O plano atual do aluno será substituído.'))return false;
    const result=await vfApi('personal_plan',{method:'POST',body:{athleteId:selected.athlete.id,requestId:request.id,plan,notes}});
    selected.plan={...selected.plan,plan,notes,plan_version:result.plan_version};aiDraft=false;
    if(cycleDays)await opsApi('cycle',{method:'POST',body:{athleteId:selected.athlete.id,cycleDays,mode:'renew'}});
    return true;
  };

  const previousSavePlan=savePlan;
  savePlan=async function(){
    const request=activePlanRequest();if(!request)return previousSavePlan();
    try{
      const plan=collectPlan(),notes=document.getElementById('planNotes')?.value||'';
      const result=await opsApi('save_request_draft',{method:'POST',body:{requestId:request.id,plan,notes}});
      request.status='reviewing';request.draft_plan=plan;request.draft_notes=notes;request.draft_updated_at=result.request?.draftUpdatedAt||new Date().toISOString();
      selected.plan={...selected.plan,plan,notes};aiDraft=true;
      toast('Rascunho salvo. O treino atual do aluno não foi alterado.');render();
    }catch(error){toast(error.message)}
  };

  async function releaseRequestedPlan(){
    const request=activePlanRequest();if(!request){toast('Não há solicitação ativa para liberar.');return}
    try{
      const athleteId=selected.athlete.id;if(!await publishRequest(request))return;
      await loadPersonal();await openClient(athleteId,'management');toast('Novo treino liberado para o aluno.');
    }catch(error){toast(error.message)}
  }

  const previousReleaseCycle=releaseCycle;
  releaseCycle=async function(){
    const request=activePlanRequest();if(!request)return previousReleaseCycle();
    const cycleDays=Number(document.getElementById('cycleDays')?.value)||30,athleteId=selected.athlete.id;
    clientTab='plan';render();await new Promise(resolve=>setTimeout(resolve,0));
    try{
      if(!await publishRequest(request,cycleDays)){clientTab='management';render();return}
      if(selected.athlete.status!=='approved')await vfApi('personal_access',{method:'POST',body:{athleteId,mode:'approve'}});
      await loadPersonal();await openClient(athleteId,'management');toast('Novo treino e novo ciclo liberados para o aluno.');
    }catch(error){toast(error.message)}
  };

  const previousBindPersonal=bindPersonal;
  bindPersonal=function(){
    previousBindPersonal();
    document.getElementById('releaseRequestedPlan')?.addEventListener('click',releaseRequestedPlan);
    document.getElementById('continuePlanRequest')?.addEventListener('click',()=>{applySavedDraft(activePlanRequest());clientTab='plan';render()});
  };
})();