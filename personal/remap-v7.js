// Vaz Personal v7 — política e aprovação do remanejamento semanal AION.
(()=>{
  let remapSummary={alerts:[],count:0,clients:[]},selectedRemap=null;
  const esc=v=>safe(v==null?'':String(v));
  const addDays=(date,n)=>{const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const policyNames={auto:'AION automática',ask:'Pedir aprovação',off:'Não remanejar'};

  async function remapApi(action,{method='GET',body=null,params={}}={}){return req('/api/health',{method,body,params:{scope:'remap',action,...params}})}
  async function mergeSummary(){
    if(!me||me.role!=='personal')return;
    try{
      remapSummary=await remapApi('summary');
      ops.alerts=[...(ops.alerts||[]).filter(a=>a.kind!=='remap'),...(remapSummary.alerts||[])];
      ops.counts=ops.counts||{};ops.counts.remapPending=Number(remapSummary.count)||0;
      ops.counts.cycleReviewBase=ops.counts.cycleReviewBase??Number(ops.counts.cycleReview||0);
      ops.counts.cycleReview=Number(ops.counts.cycleReviewBase||0)+Number(remapSummary.count||0);
    }catch{}
  }
  async function loadSelectedRemap(){
    if(!selected?.athlete?.id){selectedRemap=null;return}
    try{selectedRemap=await remapApi('client',{params:{athleteId:selected.athlete.id}})}catch{selectedRemap=null}
  }

  const baseLoad=loadPersonal;
  loadPersonal=async function(){await baseLoad();await mergeSummary()};
  const baseOpen=openClient;
  openClient=async function(id,tab='summary'){await baseOpen(id,tab);await loadSelectedRemap();render()};

  function policyCard(){
    const p=selectedRemap?.policy||selected?.state?.remapPolicy||'ask';
    return `<section class="vp-card vp-remap-policy"><div class="vp-page-head"><div><span class="vp-plan-kicker">REManejamento semanal</span><h2>AION quando houver falta</h2><p>A alteração vale somente para a semana afetada. As outras semanas do ciclo permanecem iguais.</p></div><span class="vp-badge info">${esc(policyNames[p]||policyNames.ask)}</span></div><div class="vp-remap-options">${[
      ['auto','AION automática','A AION pode reorganizar a semana sozinha quando encontrar uma alternativa segura, sem empilhar dois treinos completos no mesmo dia.'],
      ['ask','Pedir aprovação','A AION monta a sugestão e envia um alerta para você aceitar, modificar a data ou recusar.'],
      ['off','Não remanejar','A falta é registrada, mas o treino não é redistribuído automaticamente.']
    ].map(([v,t,d])=>`<label class="vp-remap-option ${p===v?'active':''}"><input type="radio" name="remapPolicy" value="${v}" ${p===v?'checked':''}><span><strong>${t}</strong><small>${d}</small></span></label>`).join('')}</div><div class="vp-actions" style="margin-top:10px"><button class="vp-btn primary" id="saveRemapPolicy">Salvar regra de remanejamento</button></div></section>`;
  }
  function proposalLines(r){
    const entries=r?.proposal?.entries||[],moved=entries.filter(e=>e.mode==='move'),supp=entries.filter(e=>e.mode==='supplement');
    const rows=[];
    moved.forEach((e,i)=>rows.push(`<div class="vp-remap-line"><div><strong>${esc(e.plan?.name||r.workoutName)}</strong><small>Treino movido de ${fmtDate(e.sourceDate||r.skippedDate)}</small></div><div class="vp-field"><label>Nova data</label><input type="date" data-remap-move="${i}" value="${esc(e.date)}" min="${esc(r.weekKey)}" max="${esc(addDays(r.weekKey,6))}"></div></div>`));
    supp.forEach(e=>rows.push(`<div class="vp-remap-line supplement"><div><strong>${esc(e.plan?.name||'Treino ajustado')}</strong><small>${fmtDate(e.date)} • complemento curto para cobrir músculos do treino perdido</small></div><span class="vp-badge warn">Ajuste AION</span></div>`));
    return rows.join('')||'<div class="vp-empty">A sugestão não encontrou um remanejamento seguro. Escolha uma nova data antes de aprovar.</div>';
  }
  function pendingCards(){
    const requests=(selectedRemap?.requests||selected?.state?.remapRequests||[]).filter(r=>r.status==='pending');
    if(!requests.length)return `<section class="vp-card vp-section"><h2>Solicitações de remanejamento</h2><div class="vp-empty">Nenhuma solicitação aguardando sua análise.</div></section>`;
    return `<section class="vp-card vp-section"><div class="vp-page-head"><div><h2>Solicitações de remanejamento</h2><p>Aceite, altere a data ou recuse. Somente a semana desta falta será modificada.</p></div><span class="vp-badge warn">${requests.length} pendente(s)</span></div>${requests.map(r=>`<article class="vp-remap-request" data-remap-request="${esc(r.id)}"><div class="vp-remap-request-head"><div><strong>${esc(r.workoutName||'Treino')}</strong><small>Falta em ${fmtDate(r.skippedDate)} • semana de ${fmtDate(r.weekKey)}</small></div><span class="vp-badge warn">AION sugeriu</span></div><p>${esc(r.proposal?.summary||r.reason||'Sugestão pronta para revisão.')}</p>${proposalLines(r)}<div class="vp-actions"><button class="vp-btn danger" data-remap-reject="${esc(r.id)}">Recusar</button><button class="vp-btn ghost" data-remap-modify="${esc(r.id)}">Modificar e aceitar</button>${r.proposal?.safe!==false&&r.proposal?.coverageComplete!==false?`<button class="vp-btn primary" data-remap-approve="${esc(r.id)}">Aceitar sugestão</button>`:''}</div></article>`).join('')}</section>`;
  }

  const baseManagement=renderClientManagement;
  renderClientManagement=function(){return `${policyCard()}${pendingCards()}${baseManagement()}`};

  async function savePolicy(){
    const policy=document.querySelector('input[name="remapPolicy"]:checked')?.value||'ask';
    try{const d=await remapApi('policy',{method:'POST',body:{athleteId:selected.athlete.id,policy}});selectedRemap={...(selectedRemap||{}),policy:d.policy};selected.state={...(selected.state||{}),remapPolicy:d.policy};toast('Regra de remanejamento salva.');render()}catch(e){toast(e.message)}
  }
  function requestById(id){return (selectedRemap?.requests||selected?.state?.remapRequests||[]).find(r=>r.id===id)}
  function modifiedProposal(card,r){
    const p=JSON.parse(JSON.stringify(r.proposal||{})),moveEntries=(p.entries||[]).filter(e=>e.mode==='move'),inputs=[...card.querySelectorAll('[data-remap-move]')];
    inputs.forEach((inp,i)=>{if(moveEntries[i])moveEntries[i].date=inp.value});
    const baseDates=(p.entries||[]).filter(e=>e.mode==='base'||e.mode==='supplement').map(e=>e.date);
    for(const e of moveEntries){if(!e.date||baseDates.includes(e.date)){throw new Error('Escolha um dia de descanso da mesma semana para não sobrecarregar outro treino.')}}
    p.safe=true;p.coverageComplete=true;p.summary='Data ajustada pelo personal após revisar a sugestão da AION.';return p;
  }
  async function decide(id,decision){
    const r=requestById(id),card=document.querySelector(`[data-remap-request="${CSS.escape(id)}"]`);if(!r||!card)return;
    try{
      let proposal=null;if(decision==='modify')proposal=modifiedProposal(card,r);
      if(decision==='reject'&&!confirm('Recusar este remanejamento? A falta continuará registrada somente nesta semana.'))return;
      await remapApi('decision',{method:'POST',body:{athleteId:selected.athlete.id,requestId:id,decision,proposal}});
      await loadSelectedRemap();await mergeSummary();toast(decision==='reject'?'Remanejamento recusado.':'Semana ajustada e liberada para o aluno.');render();
    }catch(e){toast(e.message)}
  }

  const baseBind=bindPersonal;
  bindPersonal=function(){
    baseBind();
    document.getElementById('saveRemapPolicy')?.addEventListener('click',savePolicy);
    document.querySelectorAll('[data-remap-approve]').forEach(b=>b.onclick=()=>decide(b.dataset.remapApprove,'approve'));
    document.querySelectorAll('[data-remap-modify]').forEach(b=>b.onclick=()=>decide(b.dataset.remapModify,'modify'));
    document.querySelectorAll('[data-remap-reject]').forEach(b=>b.onclick=()=>decide(b.dataset.remapReject,'reject'));
  };

  const style=document.createElement('style');style.textContent=`
    .vp-remap-policy{margin-bottom:14px}.vp-remap-options{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.vp-remap-option{display:flex;gap:10px;border:1px solid var(--vp-line,#e7e3d8);border-radius:18px;padding:13px;background:#fff;cursor:pointer}.vp-remap-option.active{border-color:#d6b300;background:#fffbea}.vp-remap-option input{accent-color:#f5c400;margin-top:3px}.vp-remap-option strong,.vp-remap-option small{display:block}.vp-remap-option small{font-size:10px;line-height:1.45;color:#777;margin-top:4px}.vp-remap-request{border:1px solid #eadb8c;background:#fffdf2;border-radius:20px;padding:15px;margin-top:10px}.vp-remap-request-head,.vp-remap-line{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.vp-remap-request-head strong,.vp-remap-request-head small,.vp-remap-line strong,.vp-remap-line small{display:block}.vp-remap-request-head small,.vp-remap-line small{font-size:10px;color:#777;margin-top:3px}.vp-remap-request>p{font-size:11px;line-height:1.55;color:#665600}.vp-remap-line{border-top:1px solid #eee3ad;padding:10px 0}.vp-remap-line .vp-field{min-width:145px}.vp-remap-line.supplement{align-items:center}@media(max-width:720px){.vp-remap-options{grid-template-columns:1fr}.vp-remap-line{flex-direction:column}.vp-remap-line .vp-field{width:100%}}
  `;document.head.appendChild(style);

  setTimeout(async()=>{if(me?.role==='personal'){await mergeSummary();if(selected)await loadSelectedRemap();render()}},900);
})();
