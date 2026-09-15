// Vaz Personal — gestão de preços e reajustes dos planos pelo Admin.
(()=>{
  let pricingPlans=[],pricingAssignments=[];
  const pricingApi=(action,o={})=>req('/api/personal-plans',{...o,params:{...(o.params||{}),action}});
  const brlPrice=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

  async function loadPricing(){
    if(!token||me?.role!=='admin')return;
    try{const d=await pricingApi('summary');pricingPlans=d.plans||[];pricingAssignments=d.assignments||[]}catch(err){console.warn('pricing unavailable',err?.code||err?.message||'error')}
  }
  const oldLoadAdminPricing=loadAdmin;
  loadAdmin=async function(){await oldLoadAdminPricing();await loadPricing()};

  function planSubscribers(code){return pricingAssignments.filter(x=>x.planCode===code).length}
  function pricingSection(){
    if(me?.role!=='admin')return '';
    return `<section class="vp-card vp-section"><div class="vp-page-head"><div><span class="vp-plan-kicker">PLANOS E PREÇOS</span><h2>Reajustes comerciais</h2><p>Altere o preço-base quando precisar. Você escolhe se o reajuste vale somente para novos contratos ou também para os atuais.</p></div></div><div class="vp-pricing-grid">${pricingPlans.map(p=>`<form class="vp-card compact vp-pricing-item" data-plan-price-form="${safe(p.code)}"><div class="vp-page-head"><div><strong>${safe(p.name)}</strong><small>Até ${p.studentLimit} alunos • ${planSubscribers(p.code)} personal(is) neste plano</small></div><span class="vp-badge info">${safe(p.code)}</span></div><div class="vp-form-grid"><div class="vp-field"><label>Mensalidade</label><input name="monthlyPrice" type="number" min="0" max="999999" step="0.01" value="${Number(p.monthlyPrice).toFixed(2)}" required></div><div class="vp-field"><label>Taxa de ativação</label><input name="activationFee" type="number" min="0" max="999999" step="0.01" value="${Number(p.activationFee||0).toFixed(2)}" required></div></div><label class="vp-reajuste-check"><input name="applyToExisting" type="checkbox"><span><strong>Aplicar aos personals atuais</strong><small>Se não marcar, o novo valor será usado apenas em novas adesões ou quando você trocar alguém para este plano.</small></span></label><div class="vp-actions" style="margin-top:10px"><button class="vp-btn primary">Salvar novo preço</button></div></form>`).join('')}</div></section>`;
  }

  const oldRenderAdminBillingPricing=renderAdminBilling;
  renderAdminBilling=function(){return `${pricingSection()}${oldRenderAdminBillingPricing()}`};

  const oldBindAdminPricing=bindAdmin;
  bindAdmin=function(){
    oldBindAdminPricing();
    document.querySelectorAll('[data-plan-price-form]').forEach(form=>form.onsubmit=async e=>{
      e.preventDefault();const fd=new FormData(form),planCode=form.dataset.planPriceForm,applyToExisting=fd.get('applyToExisting')==='on',count=planSubscribers(planCode);
      if(applyToExisting&&count>0&&!confirm(`Aplicar o novo valor também aos ${count} personal(is) atuais deste plano?`))return;
      const btn=form.querySelector('button');btn.disabled=true;btn.textContent='Salvando…';
      try{
        const d=await pricingApi('update_pricing',{method:'POST',body:{planCode,monthlyPrice:fd.get('monthlyPrice'),activationFee:fd.get('activationFee'),applyToExisting}});
        await loadAdmin();toast(d.applyToExisting?`Preço reajustado e aplicado a ${d.updatedSubscriptions} assinatura(s).`:'Preço-base atualizado. Contratos atuais foram preservados.');render();
      }catch(err){toast(err.message);btn.disabled=false;btn.textContent='Salvar novo preço'}
    });
  };

  const style=document.createElement('style');style.textContent=`
    .vp-pricing-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.vp-pricing-item{background:linear-gradient(180deg,#fff,#fffdf5)}.vp-pricing-item .vp-page-head{margin-bottom:10px}.vp-pricing-item small{display:block;color:var(--muted);margin-top:3px}.vp-reajuste-check{display:flex;gap:10px;align-items:flex-start;margin-top:10px;padding:10px;border:1px solid #ece7cf;border-radius:14px;background:#fffdf5;cursor:pointer}.vp-reajuste-check input{margin-top:3px}.vp-reajuste-check span,.vp-reajuste-check strong,.vp-reajuste-check small{display:block}.vp-reajuste-check small{margin-top:2px;color:var(--muted);line-height:1.3}@media(max-width:760px){.vp-pricing-grid{grid-template-columns:1fr}}
  `;document.head.appendChild(style);
})();
