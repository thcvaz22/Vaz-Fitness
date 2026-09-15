// Vaz Personal — ciclos de treino, mensalidades e renovação assistida pela AION.
(function installPersonalManagement(){
  let ops={clients:[],alerts:[],counts:{cycleReview:0,billingPending:0}},opsLoaded=false,opsLoading=false;
  const clientOps=new Map();
  const aiDrafts=new Map();

  async function opsApi(action,{method='GET',body=null,params={}}={}){
    const u=new URL(`${API_BASE}/api/personal-ops`,location.origin);u.searchParams.set('action',action);Object.entries(params).forEach(([k,v])=>v!=null&&u.searchParams.set(k,v));
    const headers={'Content-Type':'application/json'};if(token)headers.Authorization=`Bearer ${token}`;
    const r=await fetch(u,{method,headers,body:body?JSON.stringify(body):undefined});const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.message||'Não foi possível concluir esta operação.');return data;
  }
  async function refreshOps(force=false){
    if(!token||!me||opsLoading||opsLoaded&&!force)return;opsLoading=true;
    try{const data=await opsApi('summary');ops={clients:data.clients||[],alerts:data.alerts||[],counts:data.counts||{cycleReview:0,billingPending:0}};opsLoaded=true;}
    catch(e){if(!String(e.message).includes('ativada no banco'))console.warn(e)}finally{opsLoading=false}
  }
  async function loadClientOps(id,force=false){
    if(!id)return null;if(clientOps.has(id)&&!force)return clientOps.get(id);
    try{const data=await opsApi('client',{params:{athleteId:id}});clientOps.set(id,data);return data}catch(e){toast(e.message);return null}
  }
  function opClient(id){return ops.clients.find(c=>c.id===id)||null}
  function brl(v){return v==null?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
  function dateBR(v){if(!v)return '—';const [y,m,d]=String(v).slice(0,10).split('-');return y&&m&&d?`${d}/${m}/${y}`:fmtDate(v)}
  function cycleLabel(c){if(!c)return 'Não configurado';if(c.status==='expired')return 'Vencido';if(c.status==='due_soon')return `Vence em ${Math.max(0,c.daysLeft)} dia(s)`;if(c.status==='active')return `Ativo • ${c.daysLeft} dia(s)`;return 'Ainda não iniciado'}
  function billingLabel(b){return !b?.configured?'Não configurada':b.status==='pending'?'Mensalidade pendente':'Em dia'}
  function statusBadge(kind,status){
    if(kind==='cycle'){const cls=status==='expired'?'danger':status==='due_soon'?'warning':status==='active'?'success':'neutral';return `<span class="ops-badge ${cls}">${safe(cycleLabel(status&&typeof status==='object'?status:{status}))}</span>`}
    const cls=status==='pending'?'danger':status==='current'?'success':'neutral';return `<span class="ops-badge ${cls}">${safe(status==='pending'?'Pendente':status==='current'?'Em dia':'Não configurada')}</span>`;
  }

  function alertsPanel(){
    if(!opsLoaded)return `<section class="card ops-alert-card"><div class="card-head"><div><h2>Atenções</h2><p>Carregando ciclos e mensalidades…</p></div></div></section>`;
    if(!ops.alerts.length)return `<section class="card ops-alert-card"><div class="card-head"><div><h2>Atenções</h2><p>Nenhuma pendência importante agora.</p></div><span class="ops-badge success">Tudo em dia</span></div></section>`;
    return `<section class="card ops-alert-card"><div class="card-head"><div><h2>Atenções</h2><p>Itens que precisam da sua decisão.</p></div><span class="ops-badge danger">${ops.alerts.length}</span></div><div class="ops-alert-list">${ops.alerts.slice(0,8).map(a=>`<button class="ops-alert ${a.severity}" data-ops-open="${safe(a.athleteId)}"><span>${a.kind==='billing'?'$':'↻'}</span><div><strong>${safe(a.name)}</strong><small>${safe(a.message)}</small></div><b>›</b></button>`).join('')}</div></section>`;
  }
  function dashboardSummary(){
    const cycle=ops.counts?.cycleReview||0,bill=ops.counts?.billingPending||0;
    return `<section class="grid two ops-summary-grid"><div class="stat ops-stat-action" data-ops-view="renewals"><span>Treinos para revisar</span><strong>${cycle}</strong><small>${cycle?'AION pode sugerir o próximo ciclo':'Nenhum vencimento próximo'}</small></div><div class="stat ops-stat-action" data-ops-view="billing"><span>Mensalidades pendentes</span><strong>${bill}</strong><small>${bill?'Revisar e bloquear se necessário':'Pagamentos em dia'}</small></div></section>`;
  }

  const baseDashboard=renderDashboard;
  renderDashboard=function(){
    if(view==='billing')return renderBillingPage();
    if(view==='renewals')return renderRenewalsPage();
    const html=baseDashboard();return `${html}${dashboardSummary()}${alertsPanel()}`;
  };
  const baseShell=renderShell;
  renderShell=function(){
    let html=baseShell();
    const billing=`<button class="nav-btn ${view==='billing'?'active':''}" data-view="billing">$ Mensalidades</button><button class="nav-btn ${view==='renewals'?'active':''}" data-view="renewals">↻ Renovações</button>`;
    html=html.replace('<div class="side-note">',`${billing}<div class="side-note">`);
    const mobile=`<button class="${view==='billing'?'active':''}" data-view="billing">Mensal.</button>`;
    html=html.replace('<button id="mobileLogout">Sair</button>',`${mobile}<button id="mobileLogout">Sair</button>`);
    return html;
  };
  function renderBillingPage(){
    const items=ops.clients||[],pending=items.filter(x=>x.billing?.status==='pending'),current=items.filter(x=>x.billing?.status==='current');
    const totalPending=pending.reduce((s,x)=>s+(Number(x.billing?.amount)||0),0);
    return `<section class="hero"><span class="eyebrow">CENTRAL DE MENSALIDADES</span><h1>Pagamento e acesso em um só lugar.</h1><p>Acompanhe vencimentos, marque pagamentos e decida quando suspender o acesso de um aluno inadimplente.</p></section><section class="grid four stats"><div class="stat"><span>Alunos configurados</span><strong>${items.filter(x=>x.billing?.configured).length}</strong></div><div class="stat"><span>Pendentes</span><strong>${pending.length}</strong></div><div class="stat"><span>Em dia</span><strong>${current.length}</strong></div><div class="stat"><span>Valor pendente</span><strong>${brl(totalPending)}</strong></div></section><section class="card"><div class="card-head"><div><h2>Controle mensal</h2><p>O vencimento gera alerta; o bloqueio continua sob sua decisão.</p></div></div>${items.length?`<div class="billing-list">${items.map(renderBillingRow).join('')}</div>`:'<div class="empty">Nenhum aluno vinculado.</div>'}</section>`;
  }
  function renderBillingRow(c){const b=c.billing||{};return `<div class="billing-row"><div class="client-avatar">${initials(c.name)}</div><div class="billing-main"><strong>${safe(c.name)}</strong><small>${b.configured?`Vence ${dateBR(b.nextDueDate)} • ${brl(b.amount)}`:'Mensalidade ainda não configurada'}</small></div>${statusBadge('billing',b.status)}<div class="billing-actions">${b.configured?`<button class="btn success small" data-pay-paid="${safe(c.id)}">Marcar pago</button><button class="btn ghost small" data-pay-pending="${safe(c.id)}">Pendente</button>`:''}${b.status==='pending'&&c.accessStatus!=='suspended'?`<button class="btn danger small" data-ops-block="${safe(c.id)}">Bloquear</button>`:''}<button class="btn ghost small" data-ops-open="${safe(c.id)}">Abrir</button></div></div>`}
  function renderRenewalsPage(){const items=(ops.clients||[]).filter(c=>['expired','due_soon','not_started'].includes(c.cycle?.status));return `<section class="hero"><span class="eyebrow">RENOVAÇÃO DE TREINOS</span><h1>Atualize o plano no momento certo.</h1><p>Ciclos de 30, 45, 60 ou 90 dias. Quando chegar a hora, a AION usa o histórico real para sugerir um novo rascunho.</p></section><section class="grid three stats"><div class="stat"><span>Precisam revisão</span><strong>${ops.counts?.cycleReview||0}</strong></div><div class="stat"><span>Vencidos</span><strong>${(ops.clients||[]).filter(c=>c.cycle?.status==='expired').length}</strong></div><div class="stat"><span>Próximos 7 dias</span><strong>${(ops.clients||[]).filter(c=>c.cycle?.status==='due_soon').length}</strong></div></section><section class="card"><div class="card-head"><div><h2>Fila de renovação</h2><p>Abra o aluno para gerar, revisar e liberar o próximo ciclo.</p></div></div>${items.length?`<div class="client-list">${items.map(c=>`<div class="client-row"><div class="client-avatar">${initials(c.name)}</div><div><strong>${safe(c.name)}</strong><small>${safe(cycleLabel(c.cycle))}${c.cycle?.endsAt?` • até ${dateBR(c.cycle.endsAt)}`:''}</small></div>${statusBadge('cycle',c.cycle)}<button class="btn primary small" data-ops-open="${safe(c.id)}">Revisar</button></div>`).join('')}</div>`:'<div class="empty">Nenhum ciclo precisa de revisão agora.</div>'}</section>`}

  const baseClient=renderClient;
  renderClient=function(){
    if(clientTab==='management')return renderManagementClient();
    let html=baseClient();html=html.replace('</div>'+(/./.test(html)?'':''),'__NOOP__').replace('__NOOP__','</div>');
    return html.replace(/(<div class="tabs">[\s\S]*?)(<\/div>)/,`$1<button class="tab" data-tab="management">Gestão</button>$2`);
  };
  function clientHeadWithTabs(){
    const a=selected.athlete,st=selected.state||{},p=st.profile||{};return `<div class="client-head"><div class="client-title"><button class="btn ghost small back-btn" data-back>← Alunos</button><span class="eyebrow">ALUNO • <span class="code">${safe(a.publicCode)}</span></span><h1>${safe(a.name)}</h1><p>${safe(modeNames[p.mode]||'Perfil')} • ${safe(goalNames[p.goal]||p.goal||'Objetivo não informado')}</p></div><div class="client-head-actions"><span class="status ${statusClass(a.status)}">${statusLabel(a.status)}</span></div></div><div class="tabs">${[['summary','Resumo'],['plan','Plano de treino'],['evolution','Evolução'],['management','Gestão'],['access','Acesso']].map(([id,l])=>`<button class="tab ${clientTab===id?'active':''}" data-tab="${id}">${l}</button>`).join('')}</div>`;
  }
  function renderManagementClient(){
    const id=selected.athlete.id,d=clientOps.get(id);if(!d){setTimeout(()=>loadClientOps(id,true).then(()=>render()),0);return `${clientHeadWithTabs()}<section class="card"><div class="empty">Carregando ciclo e mensalidade…</div></section>`}
    const c=d.cycle||{},b=d.billing||{};return `${clientHeadWithTabs()}<section class="grid two"><div class="card"><div class="card-head"><div><h2>Ciclo do treino</h2><p>Defina por quanto tempo este plano ficará vigente.</p></div>${statusBadge('cycle',c)}</div><div class="cycle-config"><label>Duração<select id="cycleDays">${[30,45,60,90].map(n=>`<option value="${n}" ${Number(c.days)===n?'selected':''}>${n} dias</option>`).join('')}</select></label><div class="ops-info"><span>Início</span><strong>${c.startedAt?fmtDate(c.startedAt):'Ainda não iniciado'}</strong></div><div class="ops-info"><span>Vencimento</span><strong>${c.endsAt?fmtDate(c.endsAt):'—'}</strong></div></div><div class="management-actions"><button class="btn ghost" id="saveCycle">Salvar duração</button><button class="btn primary" id="renewCycle">${c.startedAt?'Iniciar novo ciclo':'Iniciar ciclo'}</button></div></div><div class="card"><div class="card-head"><div><h2>Mensalidade</h2><p>Vencimento recorrente mensal.</p></div>${statusBadge('billing',b.status)}</div><form id="billingForm" class="billing-form"><label>Próximo vencimento<input type="date" name="dueDate" value="${safe(b.nextDueDate||'')}" required></label><label>Valor mensal (R$)<input type="number" name="amount" min="0" step="0.01" value="${b.amount==null?'':safe(b.amount)}" placeholder="Opcional"></label><label>Observações<input name="notes" maxlength="500" value="${safe(d.billingNotes||'')}" placeholder="Ex.: pagamento via PIX"></label><button class="btn primary">Salvar mensalidade</button></form>${b.configured?`<div class="management-actions"><button class="btn success" id="markPaid">Marcar como pago</button><button class="btn ghost" id="markPending">Marcar pendente</button>${b.status==='pending'&&selected.athlete.status!=='suspended'?'<button class="btn danger" id="blockForPayment">Bloquear acesso</button>':''}</div>`:''}</div></section><section class="card aion-renew-card" style="margin-top:16px"><div class="card-head"><div><h2>AION — próximo ciclo</h2><p>Gera um rascunho usando os dados reais do aluno; você revisa antes de salvar.</p></div><button class="btn dark" id="generateNextPlan">Gerar automaticamente</button></div><div class="ai-box">${aiDrafts.has(id)?safe(aiDrafts.get(id).summary):'Quando o treino vencer — ou quando você decidir revisar — a AION compara objetivo, evolução, cargas, esforço, prontidão, corrida, medidas e consistência para sugerir um novo plano.'}</div></section>${renderPaymentHistory(d.payments||[])}`;
  }
  function renderPaymentHistory(rows){return `<section class="card" style="margin-top:16px"><div class="card-head"><div><h2>Histórico de pagamentos</h2><p>Últimos lançamentos do aluno.</p></div></div>${rows.length?rows.map(p=>`<div class="activity"><div><strong>${dateBR(p.due_date)}</strong><small>${brl(p.amount)}</small></div><div style="text-align:right"><span class="ops-badge ${p.status==='paid'?'success':'warning'}">${p.status==='paid'?'Pago':'Pendente'}</span><small>${p.paid_at?`Pago em ${fmtDate(p.paid_at)}`:''}</small></div></div>`).join(''):'<div class="empty">Nenhum pagamento registrado.</div>'}</section>`}

  const basePlanTab=renderPlanTab;
  renderPlanTab=function(){
    let html=basePlanTab();const id=selected?.athlete?.id,draft=aiDrafts.get(id);if(draft)html=`<div class="success-note ops-draft-note"><strong>Rascunho gerado pela AION.</strong><br>${safe(draft.summary)}<br><small>Revise dias, exercícios, séries, repetições, cargas e corrida. Depois salve o plano e inicie o novo ciclo.</small></div>${html}<button class="btn primary ops-renew-plan" id="saveAndRenew">Salvar plano e iniciar novo ciclo</button>`;return html;
  };

  async function openOpsClient(id){await openClient(id);await loadClientOps(id,true);render()}
  async function configureCycle(mode){const days=Number(document.getElementById('cycleDays')?.value||30);try{const data=await opsApi('cycle',{method:'POST',body:{athleteId:selected.athlete.id,cycleDays:days,mode}});const d=clientOps.get(selected.athlete.id)||{};d.cycle=data.cycle;clientOps.set(selected.athlete.id,d);await refreshOps(true);toast(mode==='configure'?'Duração salva.':'Novo ciclo iniciado.');render()}catch(e){toast(e.message)}}
  async function saveBilling(e){e.preventDefault();const fd=new FormData(e.currentTarget);try{await opsApi('billing_config',{method:'POST',body:{athleteId:selected.athlete.id,dueDate:fd.get('dueDate'),amount:fd.get('amount'),notes:fd.get('notes')}});await loadClientOps(selected.athlete.id,true);await refreshOps(true);toast('Mensalidade configurada.');render()}catch(err){toast(err.message)}}
  async function markBilling(status,id=selected?.athlete?.id){if(!id)return;try{await opsApi('billing_mark',{method:'POST',body:{athleteId:id,status}});await loadClientOps(id,true);await refreshOps(true);toast(status==='paid'?'Pagamento marcado como pago.':'Mensalidade marcada como pendente.');render()}catch(e){toast(e.message)}}
  async function blockAthlete(id){if(!confirm('Bloquear o acesso deste aluno por pendência? O Vaz Fitness mostrará “Não foi possível entrar, contate seu personal.”'))return;try{await api('personal_access',{method:'POST',body:{athleteId:id,mode:'suspend',reason:'Mensalidade pendente'}});await loadClients();await refreshOps(true);if(selected?.athlete?.id===id)selected.athlete.status='suspended';toast('Acesso bloqueado.');render()}catch(e){toast(e.message)}}
  async function generatePlan(){const id=selected.athlete.id,btn=document.getElementById('generateNextPlan');if(btn){btn.disabled=true;btn.textContent='AION analisando…'}try{const data=await opsApi('suggest_plan',{method:'POST',body:{athleteId:id}});aiDrafts.set(id,data);selected.plan={...(selected.plan||{}),plan:data.plan,notes:[selected.plan?.notes,data.summary].filter(Boolean).join('\n\n')};clientTab='plan';toast('Rascunho criado. Revise cada item antes de liberar.');render()}catch(e){toast(e.message);render()}}
  async function saveAndRenew(){const plan=collectPlan(),notes=document.getElementById('planNotes')?.value||'';const id=selected.athlete.id;try{const saved=await api('personal_plan',{method:'POST',body:{athleteId:id,plan,notes}});selected.plan={...selected.plan,plan,notes,plan_version:saved.plan_version};const detail=await loadClientOps(id,true);const days=Number(detail?.cycle?.days)||30;await opsApi('cycle',{method:'POST',body:{athleteId:id,cycleDays:days,mode:'renew'}});aiDrafts.delete(id);await loadClientOps(id,true);await refreshOps(true);toast('Novo plano salvo e ciclo reiniciado.');render()}catch(e){toast(e.message)}}

  const baseAccess=setAccess;
  setAccess=async function(mode){await baseAccess(mode);if(mode==='approve'&&selected?.athlete?.status==='approved'){try{const d=await loadClientOps(selected.athlete.id,true),days=Number(d?.cycle?.days)||30;if(!d?.cycle?.startedAt)await opsApi('cycle',{method:'POST',body:{athleteId:selected.athlete.id,cycleDays:days,mode:'start'}});await loadClientOps(selected.athlete.id,true);await refreshOps(true)}catch{}}};
  const baseLoadClients=loadClients;
  loadClients=async function(){await baseLoadClients();await refreshOps(true).catch(()=>{})};
  const baseBind=bind;
  bind=function(){
    baseBind();
    document.querySelectorAll('[data-ops-view]').forEach(b=>b.onclick=()=>{selected=null;view=b.dataset.opsView;render()});
    document.querySelectorAll('[data-ops-open]').forEach(b=>b.onclick=()=>openOpsClient(b.dataset.opsOpen));
    document.querySelectorAll('[data-ops-block]').forEach(b=>b.onclick=()=>blockAthlete(b.dataset.opsBlock));
    document.querySelectorAll('[data-pay-paid]').forEach(b=>b.onclick=()=>markBilling('paid',b.dataset.payPaid));
    document.querySelectorAll('[data-pay-pending]').forEach(b=>b.onclick=()=>markBilling('pending',b.dataset.payPending));
    document.querySelector('[data-tab="management"]')?.addEventListener('click',async e=>{e.preventDefault();clientTab='management';await loadClientOps(selected.athlete.id,true);render()});
    document.getElementById('saveCycle')?.addEventListener('click',()=>configureCycle('configure'));
    document.getElementById('renewCycle')?.addEventListener('click',()=>configureCycle(clientOps.get(selected.athlete.id)?.cycle?.startedAt?'renew':'start'));
    const bf=document.getElementById('billingForm');if(bf)bf.onsubmit=saveBilling;
    document.getElementById('markPaid')?.addEventListener('click',()=>markBilling('paid'));
    document.getElementById('markPending')?.addEventListener('click',()=>markBilling('pending'));
    document.getElementById('blockForPayment')?.addEventListener('click',()=>blockAthlete(selected.athlete.id));
    document.getElementById('generateNextPlan')?.addEventListener('click',generatePlan);
    document.getElementById('saveAndRenew')?.addEventListener('click',saveAndRenew);
  };

  const style=document.createElement('style');style.textContent=`
    .ops-summary-grid{margin:16px 0}.ops-stat-action{cursor:pointer;transition:.18s}.ops-stat-action:hover{transform:translateY(-2px);box-shadow:var(--shadow)}.ops-stat-action small{display:block;color:var(--muted);margin-top:5px;font-size:10px}.ops-alert-card{margin-top:16px}.ops-alert-list{display:grid;gap:8px}.ops-alert{border:1px solid var(--line);background:#fff;border-radius:16px;padding:12px;display:grid;grid-template-columns:36px 1fr auto;align-items:center;gap:10px;text-align:left}.ops-alert>span{width:36px;height:36px;border-radius:12px;display:grid;place-items:center;background:#f3f3f3;font-weight:950}.ops-alert strong,.ops-alert small{display:block}.ops-alert small{color:var(--muted);margin-top:3px}.ops-alert.danger{border-color:#ffd2cd;background:#fff8f7}.ops-alert.warning{border-color:#ffe5a0;background:#fffdf5}.ops-badge{font-size:9px;font-weight:900;padding:7px 9px;border-radius:999px;display:inline-flex;align-items:center;white-space:nowrap}.ops-badge.success{background:#e8f8ee;color:#24703d}.ops-badge.danger{background:#ffebe9;color:#a8322c}.ops-badge.warning{background:#fff4ce;color:#815f00}.ops-badge.neutral{background:#f0f0f0;color:#666}.billing-list{display:grid;gap:9px}.billing-row{display:grid;grid-template-columns:42px minmax(0,1fr) auto auto;align-items:center;gap:11px;padding:12px;border:1px solid var(--line);border-radius:17px}.billing-main strong,.billing-main small{display:block}.billing-main small{color:var(--muted);margin-top:3px}.billing-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.cycle-config{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:10px}.cycle-config label,.billing-form label{font-size:11px;font-weight:800}.ops-info{padding:12px;border:1px solid var(--line);border-radius:14px;background:#fafafa}.ops-info span,.ops-info strong{display:block}.ops-info span{font-size:10px;color:var(--muted)}.ops-info strong{margin-top:5px}.management-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.billing-form{display:grid;grid-template-columns:1fr 1fr;gap:10px}.billing-form label:last-of-type{grid-column:1/-1}.billing-form button{grid-column:1/-1}.aion-renew-card{background:linear-gradient(145deg,#fffbe7,#fff)}.ops-draft-note{margin-bottom:12px}.ops-renew-plan{margin-top:12px;width:100%}@media(max-width:780px){.billing-row{grid-template-columns:40px 1fr auto}.billing-actions{grid-column:1/-1;justify-content:stretch}.billing-actions .btn{flex:1}.cycle-config,.billing-form{grid-template-columns:1fr}.billing-form label:last-of-type,.billing-form button{grid-column:auto}}`;
  document.head.appendChild(style);
  setTimeout(()=>{if(token&&me)refreshOps(true).then(()=>render()).catch(()=>{})},450);
})();
