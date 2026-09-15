// Vaz Personal — planos comerciais, capacidade de alunos e seleção no fluxo de aprovação.
(()=>{
  const planState={plans:[],assignments:[],mine:null};
  const planApi=(action,o={})=>req('/api/personal-plans',{...o,params:{...(o.params||{}),action}});
  const brl=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const assignmentFor=id=>planState.assignments.find(x=>x.personalId===id)||null;
  const planByCode=code=>planState.plans.find(x=>x.code===code)||null;

  async function loadPlanData(){
    if(!token||!me)return;
    try{
      const d=await planApi('summary');
      planState.plans=d.plans||[];
      if(me.role==='admin')planState.assignments=d.assignments||[];
      else planState.mine=d.assignment||null;
    }catch(err){console.warn('plan summary unavailable',err?.code||err?.message||'error')}
  }

  const oldLoadAdmin=loadAdmin;
  loadAdmin=async function(){await oldLoadAdmin();await loadPlanData()};
  const oldLoadPersonal=loadPersonal;
  loadPersonal=async function(){await oldLoadPersonal();await loadPlanData()};

  function planOptionHtml(selected=''){
    return planState.plans.map(p=>`<option value="${safe(p.code)}" ${p.code===selected?'selected':''}>Até ${p.studentLimit} alunos • ${brl(p.monthlyPrice)}/mês</option>`).join('');
  }
  function planUsageCard(){
    const a=planState.mine;
    if(!a||!a.planCode)return `<section class="vp-card vp-plan-card vp-section warning"><div><span class="vp-plan-kicker">PLANO DO PERSONAL</span><h2>Plano ainda não definido</h2><p>O administrador precisa selecionar um plano antes de você vincular novos alunos.</p></div>${badge('Aguardando plano','warn')}</section>`;
    const atLimit=a.studentLimit>0&&a.studentCount>=a.studentLimit;
    const low=!atLimit&&a.studentLimit>0&&a.remaining<=Math.max(2,Math.ceil(a.studentLimit*.2));
    return `<section class="vp-card vp-plan-card vp-section ${atLimit?'danger':low?'warning':''}"><div class="vp-plan-main"><span class="vp-plan-kicker">${safe(a.planName||a.planCode)}</span><h2>${a.studentCount} de ${a.studentLimit} alunos</h2><p>${atLimit?'Limite atingido. Solicite alteração de plano para cadastrar novos alunos.':`${a.remaining} vaga(s) disponível(is) no plano atual.`}</p><div class="vp-plan-progress"><i style="width:${Math.min(100,a.usagePercent||0)}%"></i></div></div><div class="vp-plan-price"><small>Plano mensal</small><strong>${brl(a.monthlyAmount)}</strong></div></section>`;
  }

  const oldRenderHome=renderHome;
  renderHome=function(){
    const html=oldRenderHome();
    return html.replace('<section class="vp-grid four">',`${planUsageCard()}<section class="vp-grid four">`);
  };
  const oldRenderStudents=renderStudents;
  renderStudents=function(){
    const html=oldRenderStudents();
    return html.replace('<section class="vp-card">',`${planUsageCard()}<section class="vp-card">`);
  };

  adminRows=function(list,context='manage'){
    if(!list.length)return '<div class="vp-empty">Nenhum personal nesta categoria.</div>';
    return list.map(p=>{
      const a=assignmentFor(p.id);
      const planText=a?.planCode?`${safe(a.planName||a.planCode)} • ${a.studentCount}/${a.studentLimit} alunos`:`Sem plano • ${p.athleteCount} aluno(s)`;
      return `<div class="vp-row"><div class="vp-avatar">${initials(p.name)}</div><div class="vp-row-main"><strong>${safe(p.name)}</strong><small>${safe(p.email)} • ${planText}</small></div>${p.accountStatus==='pending'?badge('Aguardando','warn'):p.accountStatus==='suspended'?badge('Suspenso','danger'):badge('Ativo','ok')}${context==='approval'?`<button class="vp-btn ok" data-admin-status="approve" data-personal="${p.id}">Escolher plano e aprovar</button>`:`<button class="vp-btn ghost" data-admin-manage="${p.id}">Gerenciar</button>`}</div>`;
    }).join('');
  };

  function approvalModal(id){
    const p=(adminData.personals||[]).find(x=>x.id===id);if(!p)return;
    if(!planState.plans.length){toast('Os planos ainda não estão disponíveis.');return;}
    const m=showModal(`<div class="vp-page-head"><div><span class="vp-plan-kicker">APROVAÇÃO</span><h2>${safe(p.name)}</h2><p>Escolha o limite de alunos antes de liberar o acesso.</p></div><button class="vp-btn ghost" id="closeModal">×</button></div><div class="vp-card compact"><div class="vp-field"><label>Plano do personal</label><select id="approvalPlan">${planOptionHtml('P20')}</select></div><div id="approvalPlanPreview" class="vp-plan-preview"></div><button class="vp-btn ok" id="confirmPlanApproval" style="margin-top:12px;width:100%">Aprovar com este plano</button></div>`);
    const select=m.querySelector('#approvalPlan'),preview=m.querySelector('#approvalPlanPreview');
    const sync=()=>{const pl=planByCode(select.value);preview.innerHTML=pl?`<strong>${safe(pl.name)}</strong><span>Até ${pl.studentLimit} alunos</span><span>${brl(pl.monthlyPrice)}/mês</span><small>Sem taxa de ativação</small>`:''};
    select.onchange=sync;sync();m.querySelector('#closeModal').onclick=()=>m.remove();
    m.querySelector('#confirmPlanApproval').onclick=async()=>{const btn=m.querySelector('#confirmPlanApproval');btn.disabled=true;btn.textContent='Aprovando…';try{await planApi('approve',{method:'POST',body:{personalId:id,planCode:select.value}});await loadAdmin();toast('Personal aprovado com plano definido.');m.remove();render()}catch(err){toast(err.message);btn.disabled=false;btn.textContent='Aprovar com este plano'}};
  }

  const oldAdminSetStatus=adminSetStatus;
  adminSetStatus=async function(id,mode){if(mode==='approve'){approvalModal(id);return}return oldAdminSetStatus(id,mode)};

  const oldAdminManageModal=adminManageModal;
  adminManageModal=function(id){
    oldAdminManageModal(id);
    const m=document.getElementById('vpModal'),box=m?.querySelector('.vp-modal');if(!box)return;
    const p=(adminData.personals||[]).find(x=>x.id===id),a=assignmentFor(id);
    const block=document.createElement('div');block.className='vp-card compact vp-admin-plan-box';
    block.innerHTML=`<div class="vp-page-head"><div><span class="vp-plan-kicker">PLANO E CAPACIDADE</span><h3>${a?.planName?safe(a.planName):'Plano não definido'}</h3><p>${a?.planCode?`${a.studentCount} de ${a.studentLimit} alunos • ${brl(a.monthlyAmount)}/mês`:'Defina o plano comercial deste personal.'}</p></div>${a?.overLimit?badge('Acima do limite','danger'):a?.planCode?badge(`${a.remaining} vagas`,'ok'):badge('Sem plano','warn')}</div><div class="vp-form-grid"><div class="vp-field"><label>Alterar plano</label><select id="managePlanSelect"><option value="">Selecione…</option>${planOptionHtml(a?.planCode||'')}</select></div><div class="vp-field"><label>Uso atual</label><input value="${a?.planCode?`${a.studentCount}/${a.studentLimit} alunos`:`${p?.athleteCount||0} alunos`}" disabled></div></div><button class="vp-btn primary" id="savePersonalPlan" style="margin-top:9px">Salvar plano</button>`;
    box.insertBefore(block,box.children[1]||null);
    block.querySelector('#savePersonalPlan').onclick=async()=>{const code=block.querySelector('#managePlanSelect').value;if(!code){toast('Selecione um plano.');return}try{const d=await planApi('set_plan',{method:'POST',body:{personalId:id,planCode:code}});await loadAdmin();toast(d.warning||'Plano atualizado.');m.remove();render()}catch(err){toast(err.message)}};
  };

  function openClaimModal(){
    const a=planState.mine;
    if(!a?.planCode){toast('Seu plano ainda não foi definido pelo administrador.');return}
    if(a.studentCount>=a.studentLimit){toast(`Você atingiu o limite de ${a.studentLimit} alunos do seu plano.`);return}
    const m=showModal(`<h2>Vincular aluno</h2><p>Digite o código ID enviado pelo aluno. Você possui ${a.remaining} vaga(s) disponível(is).</p><form id="planClaimForm"><div class="vp-field"><label>Código</label><input name="code" placeholder="VF-XXXX-XXXX-XXXX" required></div><button class="vp-btn primary" style="margin-top:10px">Vincular aluno</button></form>`);
    m.querySelector('#planClaimForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),btn=e.target.querySelector('button');btn.disabled=true;btn.textContent='Vinculando…';try{await planApi('claim',{method:'POST',body:{code:String(fd.get('code')||'').toUpperCase()}});await loadPersonal();m.remove();toast('Aluno vinculado ao seu plano.');render()}catch(err){toast(err.message);btn.disabled=false;btn.textContent='Vincular aluno'}};
  }

  const oldBindPersonal=bindPersonal;
  bindPersonal=function(){
    oldBindPersonal();
    const btn=document.getElementById('claimBtn'),a=planState.mine;
    if(btn){
      btn.onclick=openClaimModal;
      if(!a?.planCode||a.studentCount>=a.studentLimit){btn.classList.add('disabled');btn.title=!a?.planCode?'Plano ainda não definido.':'Limite de alunos atingido.';}
    }
  };

  const style=document.createElement('style');style.textContent=`
    .vp-plan-card{display:flex;align-items:center;justify-content:space-between;gap:18px;overflow:hidden;position:relative}.vp-plan-card:after{content:'';position:absolute;width:160px;height:160px;border-radius:50%;background:rgba(245,196,0,.12);right:-55px;top:-70px;pointer-events:none}.vp-plan-card.warning{border-color:#e9c95a}.vp-plan-card.danger{border-color:#e49b94}.vp-plan-kicker{font-size:10px;font-weight:900;letter-spacing:.12em;color:#8d7400}.vp-plan-card h2{margin:5px 0 3px}.vp-plan-card p{margin:0;color:var(--muted)}.vp-plan-main{flex:1;min-width:0}.vp-plan-price{text-align:right;z-index:1}.vp-plan-price small,.vp-plan-price strong{display:block}.vp-plan-price strong{font-size:20px;margin-top:4px}.vp-plan-progress{height:7px;border-radius:999px;background:#ecebe5;margin-top:12px;overflow:hidden}.vp-plan-progress i{display:block;height:100%;background:linear-gradient(90deg,#e0ad00,#f5c400);border-radius:inherit}.vp-plan-preview{display:grid;grid-template-columns:1fr auto;gap:5px 16px;background:#faf8ed;border:1px solid #eee5bd;border-radius:16px;padding:14px;margin-top:10px}.vp-plan-preview strong{font-size:17px}.vp-plan-preview span:nth-of-type(2){font-weight:900}.vp-plan-preview small{grid-column:1/-1;color:var(--muted)}.vp-admin-plan-box{margin-bottom:12px}.vp-btn.disabled{opacity:.48}.vp-btn:disabled{opacity:.48;cursor:not-allowed}@media(max-width:620px){.vp-plan-card{align-items:flex-start;flex-direction:column}.vp-plan-price{text-align:left}.vp-plan-preview{grid-template-columns:1fr}}
  `;document.head.appendChild(style);

  queueMicrotask(async()=>{if(token&&me){await loadPlanData();try{render()}catch{}}});
})();
