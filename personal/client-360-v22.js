(()=>{
  const n=v=>Number(v)||0;
  const pct=v=>Math.max(0,Math.min(100,Math.round(v)));
  const asDate=v=>{const d=new Date(v||0);return Number.isNaN(d.getTime())?null:d};
  const latest=(arr=[])=>Array.isArray(arr)&&arr.length?arr[arr.length-1]:null;
  const sinceDays=(arr,days)=>{const cutoff=Date.now()-days*86400000;return (Array.isArray(arr)?arr:[]).filter(x=>{const d=asDate(x?.date||x?.endedAt||x?.startedAt);return d&&d.getTime()>=cutoff})};
  const healthOpen=(st={})=>(Array.isArray(st.healthRecords)?st.healthRecords:[]).filter(x=>x&&x.status!=='resolved');
  const feedbackRows=(st={})=>[...(st.sessions||[]),...(st.runSessions||[])].filter(x=>x?.sessionFeedback).sort((a,b)=>(asDate(a.date)?.getTime()||0)-(asDate(b.date)?.getTime()||0));
  function attentionItems(st,management){
    const items=[],health=healthOpen(st),readiness=latest(st.readinessCheckins||[]),feedback=latest(feedbackRows(st)),billing=management?.billing||{},cycle=management?.cycle||{};
    if(health.length){const h=health.slice().sort((a,b)=>n(b.severity)-n(a.severity))[0];items.push({level:n(h.severity)>=4?'danger':'warn',title:'Limitação ativa',text:`${h.area||h.type||'Região não informada'} • atenção ${n(h.severity)||1}/5`,tab:'summary'})}
    if(readiness?.pain)items.push({level:'danger',title:'Dor no check-in',text:'Aluno registrou dor diferente do desconforto muscular habitual.',tab:'evolution'});
    if(readiness&&n(readiness.score)>0&&n(readiness.score)<50)items.push({level:'warn',title:'Prontidão baixa',text:`${n(readiness.score)}% no check-in mais recente.`,tab:'evolution'});
    if(feedback){const f=feedback.sessionFeedback||{},notes=String(f.notes||'');if(n(f.fatigue)>=8||n(f.effort)>=9||/dor|doeu|desconfort|les[aã]o|pontada|incha/i.test(notes))items.push({level:/dor|doeu|desconfort|les[aã]o|pontada|incha/i.test(notes)?'danger':'warn',title:'Feedback do último treino',text:notes||`Fadiga ${n(f.fatigue)}/10 • esforço ${n(f.effort)}/10`,tab:'evolution'})}
    if(billing.status==='pending')items.push({level:'warn',title:'Mensalidade pendente',text:billing.nextDueDate?`Vencimento: ${fmtDate(billing.nextDueDate)}`:'Pagamento pendente.',tab:'management'});
    if(['due_soon','expired'].includes(cycle.status))items.push({level:cycle.status==='expired'?'danger':'warn',title:cycle.status==='expired'?'Ciclo vencido':'Revisão próxima',text:cycle.status==='expired'?'O treino precisa ser revisado.':`Vence em ${Math.max(0,n(cycle.daysLeft))} dia(s).`,tab:'management'});
    return items;
  }
  function render360(){
    const st=selected?.state||{},p=st.profile||{},management=selectedOps||{},strength=st.sessions||[],runs=st.runSessions||[],all=[...strength,...runs],last28=sinceDays(all,28),expected=Math.max(1,n(p.days||selected?.plan?.plan?.length||4)*4),adherence=pct(last28.length/expected*100),body=st.bodyMeasurements||[],lastBody=latest(body)||{},prevBody=body.length>1?body[body.length-2]:null,weight=n(lastBody.weight||p.weight),delta=prevBody&&n(prevBody.weight)?(weight-n(prevBody.weight)).toFixed(1):null,readiness=latest(st.readinessCheckins||[]),feedback=latest(feedbackRows(st)),health=healthOpen(st),cycle=management.cycle||{},billing=management.billing||{},plan=Array.isArray(selected?.plan?.plan)?selected.plan.plan:[],attention=attentionItems(st,management),lastSession=all.slice().sort((a,b)=>(asDate(a.date)?.getTime()||0)-(asDate(b.date)?.getTime()||0)).at(-1);
    const status=selected?.athlete?.status==='approved'?'Ativo':selected?.athlete?.status==='suspended'?'Suspenso':'Aguardando';
    return `<section class="vp-360-hero"><div><span class="vp-360-kicker">VISÃO 360º DO ALUNO</span><h2>${safe(selected?.athlete?.name||'Aluno')}</h2><p>Treino, evolução, recuperação, saúde, ciclo e financeiro em uma única leitura.</p></div><div class="vp-360-score"><strong>${adherence}%</strong><span>aderência 28 dias</span></div></section>
    <section class="vp-grid four vp-360-stats">
      <div class="vp-card compact vp-stat"><span>Status</span><strong style="font-size:14px">${safe(status)}</strong></div>
      <div class="vp-card compact vp-stat"><span>Treinos 28d</span><strong>${last28.length}</strong><small>meta estimada ${expected}</small></div>
      <div class="vp-card compact vp-stat"><span>Peso atual</span><strong>${weight?weight+' kg':'—'}</strong><small>${delta!=null?(Number(delta)>0?'+':'')+delta+' kg vs. anterior':'sem comparação'}</small></div>
      <div class="vp-card compact vp-stat"><span>Prontidão</span><strong>${readiness?.score!=null?n(readiness.score)+'%':'—'}</strong><small>${readiness?.date?fmtDate(readiness.date):'sem check-in'}</small></div>
    </section>
    <section class="vp-grid two vp-section vp-360-main">
      <div class="vp-card"><div class="vp-page-head"><div><h2>Sinais de atenção</h2><p>O que merece revisão primeiro.</p></div><span class="vp-360-count">${attention.length}</span></div>
        ${attention.length?attention.map(x=>`<button class="vp-360-attention ${x.level}" data-360-tab="${x.tab}"><span>${x.level==='danger'?'!':'•'}</span><div><strong>${safe(x.title)}</strong><small>${safe(x.text)}</small></div><b>›</b></button>`).join(''):'<div class="vp-empty">Nenhum sinal prioritário identificado agora.</div>'}
      </div>
      <div class="vp-card vp-360-aion"><div class="vp-page-head"><div><h2>AION • plano de ação</h2><p>Leitura integrada da situação atual.</p></div><button class="vp-btn dark" data-360-aion>✦ Analisar</button></div><div id="client360Aion" class="vp-aion-360-box"><strong>AION pronta para analisar</strong><small>Ela cruza treino, aderência, feedbacks, métricas, prontidão, limitações, ciclo e mensalidade.</small></div></div>
    </section>
    <section class="vp-grid two vp-section">
      <div class="vp-card"><h2>Treino & ciclo</h2>
        <div class="vp-kv"><span>Plano atual</span><strong>${plan.length} dia(s)</strong></div>
        <div class="vp-kv"><span>Último treino</span><strong>${lastSession?.date?fmtDate(lastSession.date):'—'}</strong></div>
        <div class="vp-kv"><span>Ciclo</span><strong>${cycle.status==='expired'?'Vencido':cycle.status==='due_soon'?'Revisão próxima':cycle.status==='active'?'Ativo':'Não iniciado'}</strong></div>
        <div class="vp-kv"><span>Próxima revisão</span><strong>${cycle.endsAt?fmtDate(cycle.endsAt):'—'}</strong></div>
        <div class="vp-360-actions"><button class="vp-btn primary" data-360-tab="plan">Abrir treino</button><button class="vp-btn ghost" data-360-tab="management">Gerenciar ciclo</button></div>
      </div>
      <div class="vp-card"><h2>Saúde & recuperação</h2>
        <div class="vp-kv"><span>Limitações ativas</span><strong>${health.length}</strong></div>
        <div class="vp-kv"><span>Check-in recente</span><strong>${readiness?.score!=null?n(readiness.score)+'%':'—'}</strong></div>
        <div class="vp-kv"><span>Dor registrada</span><strong>${readiness?.pain?'Sim':'Não'}</strong></div>
        <div class="vp-kv"><span>Feedback recente</span><strong>${feedback?.date?fmtDate(feedback.date):'—'}</strong></div>
        <div class="vp-360-actions"><button class="vp-btn ghost" data-360-tab="evolution">Ver evolução</button><button class="vp-btn ghost" data-360-tab="summary" data-360-health>Ver detalhes</button></div>
      </div>
    </section>
    <section class="vp-grid two vp-section">
      <div class="vp-card"><h2>Perfil & objetivo</h2>${[['Idade',p.age?`${p.age} anos`:'—'],['Altura',p.height?`${p.height} cm`:'—'],['Modalidade',modeNames[p.mode]||'—'],['Objetivo',goalNames[p.goal]||p.goal||'—'],['Dias/semana',p.days||'—'],['Prioridade',muscleNames[p.priorityMuscle]||p.priorityMuscle||'—']].map(([k,v])=>`<div class="vp-kv"><span>${k}</span><strong>${safe(v)}</strong></div>`).join('')}</div>
      <div class="vp-card"><h2>Financeiro</h2><div class="vp-kv"><span>Situação</span><strong>${billing.status==='pending'?'Pendente':billing.status==='paid'?'Pago':'Em dia'}</strong></div><div class="vp-kv"><span>Próximo vencimento</span><strong>${billing.nextDueDate?fmtDate(billing.nextDueDate):'—'}</strong></div><div class="vp-kv"><span>Valor</span><strong>${billing.amount!=null?money(billing.amount):'—'}</strong></div><div class="vp-360-actions"><button class="vp-btn ghost" data-360-tab="management">Abrir mensalidade</button></div></div>
    </section>`;
  }
  async function analyze360(){
    const box=document.getElementById('client360Aion');if(!box||!selected)return;box.innerHTML='<strong>AION analisando…</strong><small>Cruzando todo o contexto do aluno.</small>';
    const st=selected.state||{},management=selectedOps||{},all=[...(st.sessions||[]),...(st.runSessions||[])],feedback=all.slice(-15).filter(x=>x.sessionFeedback).map(x=>({date:x.date,name:x.name,feedback:x.sessionFeedback}));
    try{
      const d=await req('/api/aion',{method:'POST',auth:false,body:{message:'Você é o analista interno de um personal trainer. Faça uma leitura 360º deste aluno e entregue: 1) resumo executivo curto, 2) prioridades em ordem, 3) plano de ação prático em 3 a 5 etapas, 4) o que acompanhar nos próximos 7 dias. Considere aderência, treino, feedbacks, prontidão, evolução corporal, limitações/lesões, ciclo e mensalidade. Não faça diagnóstico médico; em caso de dor ou lesão, priorize segurança, adaptação e encaminhamento quando apropriado.',context:{profile:st.profile||{},goals:st.goals||{},plan:selected.plan?.plan||[],cycle:management.cycle||{},billing:management.billing||{},bodyMeasurements:(st.bodyMeasurements||[]).slice(-10),healthRecords:(st.healthRecords||[]).slice(-12),readiness:(st.readinessCheckins||[]).slice(-10),recentStrength:(st.sessions||[]).slice(-10),recentRuns:(st.runSessions||[]).slice(-10),recentFeedback:feedback,requests:management.requests||[]}}});
      box.innerHTML=`<strong>Plano de ação AION</strong><div>${safe(String(d.message||'Sem análise disponível.')).replace(/\n/g,'<br>')}</div><div class="vp-360-actions"><button class="vp-btn primary" data-360-tab="plan">Abrir treino</button><button class="vp-btn ghost" data-360-tab="evolution">Ver evolução</button><button class="vp-btn ghost" data-360-tab="management">Gestão</button></div>`;bind360Actions();
    }catch{box.innerHTML='<strong>AION indisponível</strong><small>Tente novamente em instantes.</small>'}
  }
  function bind360Actions(){
    document.querySelectorAll('[data-360-tab]').forEach(b=>b.onclick=()=>{clientTab=b.dataset.threeSixtyTab||b.dataset['360Tab']||b.getAttribute('data-360-tab')||'summary';render()});
    document.querySelector('[data-360-aion]')?.addEventListener('click',analyze360);
  }
  const oldSummary=renderClientSummary;
  renderClientSummary=function(){return render360()};
  const oldRenderClient=renderClient;
  renderClient=function(){return oldRenderClient().replace('>Resumo</button>','>Visão 360º</button>')};
  const oldBind=bindPersonal;
  bindPersonal=function(){oldBind();bind360Actions()};
  const style=document.createElement('style');style.textContent=`
    .vp-360-hero{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;padding:24px;border-radius:24px;background:linear-gradient(135deg,var(--ink,#171717),#333);color:#fff;overflow:hidden;position:relative}.vp-360-hero:after{content:'';position:absolute;width:180px;height:180px;border-radius:50%;right:-45px;top:-65px;background:var(--yellow,#f5c400);opacity:.18}.vp-360-kicker{font-size:9px;font-weight:900;letter-spacing:.13em;color:var(--yellow,#f5c400)}.vp-360-hero h2{font-size:30px;margin:6px 0}.vp-360-hero p{margin:0;color:#d8d8d8;font-size:11px;max-width:620px}.vp-360-score{text-align:right;z-index:1}.vp-360-score strong,.vp-360-score span{display:block}.vp-360-score strong{font-size:36px;color:var(--yellow,#f5c400)}.vp-360-score span{font-size:9px;color:#ddd}.vp-360-stats{margin-top:14px}.vp-360-stats small{display:block;font-size:8px;color:var(--muted);margin-top:4px}.vp-360-count{display:grid;place-items:center;min-width:30px;height:30px;border-radius:10px;background:var(--yellow-soft,#fff5c0);font-size:11px;font-weight:900}.vp-360-attention{width:100%;display:grid;grid-template-columns:31px minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid var(--line);background:#fff;border-radius:14px;padding:10px;text-align:left;margin-top:7px}.vp-360-attention>span{width:31px;height:31px;border-radius:10px;display:grid;place-items:center;font-weight:900}.vp-360-attention.warn>span{background:#fff6cc;color:#7a6100}.vp-360-attention.danger>span{background:#fff0ed;color:#a7372f}.vp-360-attention strong,.vp-360-attention small{display:block}.vp-360-attention strong{font-size:10px}.vp-360-attention small{font-size:9px;color:var(--muted);line-height:1.4;margin-top:2px}.vp-aion-360-box{border:1px solid var(--line);background:#fafaf8;border-radius:16px;padding:13px}.vp-aion-360-box strong,.vp-aion-360-box small{display:block}.vp-aion-360-box small{font-size:9px;color:var(--muted);line-height:1.5;margin-top:4px}.vp-aion-360-box>div{font-size:11px;line-height:1.6;margin-top:8px}.vp-360-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}
    @media(max-width:700px){.vp-360-hero{align-items:flex-start;flex-direction:column}.vp-360-score{text-align:left}.vp-360-hero h2{font-size:25px}.vp-360-main{grid-template-columns:1fr}.vp-360-actions .vp-btn{flex:1 1 auto}}
  `;document.head.appendChild(style);
})();
