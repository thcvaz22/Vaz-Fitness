// Vaz Personal v8 — central diária, notificações, histórico, backup e operação resiliente.
(()=>{
  const CACHE_PREFIX='vazPersonal.offline.v8:';
  const ALERT_KEY='vazPersonal.lastAlert.v8';
  const APP_VERSION='0.5.5';
  const advancedApi=(action,o={})=>req('/api/personal-ops',{...o,params:{...(o.params||{}),action}});
  const cacheKey=(path,o)=>CACHE_PREFIX+btoa(unescape(encodeURIComponent(`${path}|${JSON.stringify(o?.params||{})}`))).replace(/=+$/,'');
  const getCache=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
  const setCache=(key,value)=>{try{localStorage.setItem(key,JSON.stringify({savedAt:new Date().toISOString(),value}))}catch{}};
  let offlineMode=!navigator.onLine,updateInfo=null;

  const baseReq=req;
  req=async function(path,options={}){
    const method=String(options.method||'GET').toUpperCase(),key=cacheKey(path,options);
    try{
      const data=await baseReq(path,options);
      if(method==='GET')setCache(key,data);
      if(offlineMode){offlineMode=false;window.dispatchEvent(new CustomEvent('vp-connectivity'))}
      return data;
    }catch(error){
      if(method==='GET'){
        const cached=getCache(key);
        if(cached?.value){offlineMode=true;window.dispatchEvent(new CustomEvent('vp-connectivity'));return {...cached.value,_offline:true,_cachedAt:cached.savedAt}}
      }
      if(!navigator.onLine)error.message='Sem conexão. Seus dados continuam visíveis, mas esta alteração precisa de internet.';
      throw error;
    }
  };

  function connectivityBanner(){
    let el=document.getElementById('vpConnectivity');
    if(!el){el=document.createElement('div');el.id='vpConnectivity';el.className='vp-connectivity';document.body.appendChild(el)}
    el.hidden=!offlineMode;el.innerHTML='<strong>Modo offline</strong><span>Exibindo o último backup local. Alterações serão liberadas quando a conexão voltar.</span>';
  }
  window.addEventListener('online',async()=>{offlineMode=false;connectivityBanner();try{if(token&&me){await loadPersonal();render();toast('Conexão restabelecida. Dados sincronizados.')}}catch{}});
  window.addEventListener('offline',()=>{offlineMode=true;connectivityBanner()});
  window.addEventListener('vp-connectivity',connectivityBanner);

  const baseLoadPersonal=loadPersonal;
  loadPersonal=async function(){await baseLoadPersonal();checkNotifications();checkUpdate();connectivityBanner()};

  function pendingRequest(){return (selectedOps?.requests||[]).find(r=>['pending','reviewing'].includes(r.status))||null}
  function restDayNames(days=[]){const names=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];return (days||[]).map(d=>names[Number(d)]).filter(Boolean).join(', ')||'não informado'}
  function queueHtml(){
    const items=(ops.alerts||[]).slice(0,10);
    return `<section class="vp-card vp-section vp-today-card"><div class="vp-page-head"><div><h2>Fila de hoje</h2><p>Prioridades organizadas por impacto.</p></div>${badge(`${items.length} ação(ões)`,items.length?'warn':'ok')}</div>${items.length?items.map((a,i)=>`<button class="vp-action-row ${a.severity==='danger'?'danger':''}" data-open="${a.athleteId}" data-tab-target="${a.kind==='billing'?'management':a.kind==='request'?'management':'management'}"><span>${i+1}</span><div><strong>${safe(a.name)}</strong><small>${safe(a.message)}</small></div><b>${a.kind==='request'?'Solicitação':a.kind==='billing'?'Financeiro':'Treino'}</b></button>`).join(''):'<div class="vp-empty">Tudo em dia. Nenhuma ação urgente.</div>'}</section>`;
  }
  const baseHome=renderHome;
  renderHome=function(){
    const html=baseHome(),f=ops.finance||{};
    const finance=`<section class="vp-grid four vp-section"><div class="vp-card compact vp-stat"><span>Receita em dia</span><strong>${money(f.currentRevenue||0)}</strong></div><div class="vp-card compact vp-stat"><span>Valor pendente</span><strong>${money(f.pendingRevenue||0)}</strong></div><div class="vp-card compact vp-stat"><span>Solicitações de treino</span><strong>${ops.counts?.planRequests||0}</strong></div><div class="vp-card compact vp-stat"><span>Dados</span><strong>${offlineMode?'Offline':'Sincronizados'}</strong></div></section>`;
    return html+finance+queueHtml();
  };

  const baseBilling=renderBilling;
  renderBilling=function(){
    const f=ops.finance||{};
    const tools=`<section class="vp-card vp-section"><div class="vp-page-head"><div><h2>Visão financeira</h2><p>Receita prevista, valores pendentes e comunicação com alunos.</p></div><div class="vp-actions"><button class="vp-btn ghost" id="exportFinance">Exportar CSV</button><button class="vp-btn primary" id="shareBillingSummary">Compartilhar resumo</button></div></div><div class="vp-grid three"><div class="vp-stat"><span>Em dia</span><strong>${money(f.currentRevenue||0)}</strong></div><div class="vp-stat"><span>Pendente</span><strong>${money(f.pendingRevenue||0)}</strong></div><div class="vp-stat"><span>Inadimplentes</span><strong>${f.overdue||0}</strong></div></div></section>`;
    return baseBilling()+tools;
  };

  const baseManagement=renderClientManagement;
  renderClientManagement=function(){
    const request=pendingRequest();let html=baseManagement();
    const requestCard=request?`<section class="vp-card vp-section vp-request-card"><div class="vp-page-head"><div><span class="eyebrow">SOLICITAÇÃO DO ALUNO</span><h2>Novo treino solicitado</h2><p>${safe(request.reason)}</p></div>${badge(request.status==='reviewing'?'Em análise':'Nova','warn')}</div><div class="vp-kv"><span>Dias de descanso</span><strong>${safe(restDayNames(request.rest_days))}</strong></div><div class="vp-kv"><span>Enviada em</span><strong>${fmtDate(request.created_at)}</strong></div><div class="vp-actions"><button class="vp-btn dark" id="acceptPlanRequest">✦ Atender com AION</button><button class="vp-btn danger" id="rejectPlanRequest">Recusar solicitação</button></div></section>`:'';
    const history=`<section class="vp-card vp-section"><div class="vp-page-head"><div><h2>Histórico do plano</h2><p>Consulte versões anteriores e restaure com segurança.</p></div><button class="vp-btn ghost" id="openPlanHistory">Ver versões</button></div></section>`;
    const receiptButtons=(selectedOps?.payments||[]).filter(p=>p.status==='paid').slice(0,6).map(p=>`<button class="vp-btn ghost compact" data-receipt="${safe(p.id)}">Recibo ${fmtDate(p.due_date)}</button>`).join('');
    const receipts=receiptButtons?`<section class="vp-card vp-section"><div class="vp-page-head"><div><h2>Recibos</h2><p>Gere comprovantes dos pagamentos registrados.</p></div></div><div class="vp-actions">${receiptButtons}</div></section>`:'';
    return `${requestCard}${html}${history}${receipts}`;
  };

  const baseSettings=renderSettings;
  renderSettings=function(){
    const html=baseSettings();
    const tools=`<section class="vp-grid two vp-section"><div class="vp-card"><h2>Notificações</h2><p>Receba um resumo diário de ciclos, pagamentos e solicitações.</p><button class="vp-btn primary" id="enableNotifications">Ativar notificações</button></div><div class="vp-card"><h2>Backup</h2><p>Exporte alunos, planos, pagamentos, solicitações e histórico.</p><button class="vp-btn dark" id="exportBackup">Baixar backup completo</button></div></section>${updateInfo?.available?`<section class="vp-alert info vp-section"><span>⬆</span><div><strong>Nova versão ${safe(updateInfo.version)} disponível</strong><small>${safe(updateInfo.notes||'Atualização do Vaz Personal pronta para instalar.')}</small></div><a class="vp-btn primary" href="${safe(updateInfo.downloadUrl)}" target="_blank" rel="noopener">Baixar APK</a></section>`:''}`;
    return html+tools;
  };

  async function openHistory(){
    const m=showModal('<div class="vp-empty">Carregando versões…</div>');
    try{
      const d=await advancedApi('plan_history',{params:{athleteId:selected.athlete.id}}),rows=d.history||[];
      m.querySelector('.vp-modal').innerHTML=`<div class="vp-page-head"><div><h2>Histórico do plano</h2><p>Cada salvamento mantém uma cópia restaurável.</p></div><button class="vp-btn ghost" data-close>×</button></div>${rows.length?rows.map(x=>`<div class="vp-history-row"><div><strong>Versão ${Number(x.plan_version)||0}</strong><small>${fmtDate(x.created_at)} • ${x.days||0} dia(s) • ${safe(x.source||'salvo')}</small></div><button class="vp-btn ghost" data-restore="${safe(x.id)}">Restaurar</button></div>`).join(''):'<div class="vp-empty">O histórico começará no próximo salvamento.</div>'}`;
      m.querySelector('[data-close]').onclick=()=>m.remove();m.querySelectorAll('[data-restore]').forEach(b=>b.onclick=async()=>{if(!confirm('Restaurar esta versão? O plano atual também será preservado no histórico.'))return;try{const r=await advancedApi('restore_plan',{method:'POST',body:{athleteId:selected.athlete.id,historyId:b.dataset.restore}});selected.plan={...selected.plan,plan:r.plan,notes:r.notes,plan_version:r.plan_version};m.remove();render();toast('Versão restaurada e sincronizada.')}catch(e){toast(e.message)}});
    }catch(e){m.querySelector('.vp-modal').innerHTML=`<div class="vp-empty">${safe(e.message)}</div>`}
  }
  async function reviewRequest(status){
    const request=pendingRequest();if(!request)return;
    try{await advancedApi('review_request',{method:'POST',body:{requestId:request.id,status}});selectedOps=await advancedApi('client',{params:{athleteId:selected.athlete.id}});await loadPersonal();if(status==='reviewing'){toast('Solicitação em análise. AION vai preparar o rascunho.');await suggestPlan()}else{render();toast('Solicitação encerrada.')}}catch(e){toast(e.message)}
  }
  function download(name,type,content){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
  function exportFinance(){const rows=[['Aluno','Vencimento','Valor','Status'],...(ops.clients||[]).map(c=>[c.name,c.billing?.nextDueDate||'',Number(c.billing?.amount||0).toFixed(2),c.billing?.status==='pending'?'Pendente':c.billing?.configured?'Em dia':'Não configurada'])];download(`vaz-personal-financeiro-${new Date().toISOString().slice(0,10)}.csv`,'text/csv;charset=utf-8','\ufeff'+rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(';')).join('\n'))}
  async function shareText(text){try{if(navigator.share)await navigator.share({title:'Vaz Personal',text});else{await navigator.clipboard.writeText(text);toast('Resumo copiado.')}}catch{}}
  async function exportBackup(){try{toast('Preparando backup…');const d=await advancedApi('backup');download(`vaz-personal-backup-${new Date().toISOString().slice(0,10)}.json`,'application/json',JSON.stringify(d,null,2));toast('Backup baixado.')}catch(e){toast(e.message)}}
  function receipt(id){const p=(selectedOps?.payments||[]).find(x=>x.id===id);if(!p)return;const text=`RECIBO — VAZ PERSONAL\n\nRecebemos de ${selected.athlete.name} o valor de ${money(p.amount||0)}, referente à mensalidade com vencimento em ${fmtDate(p.due_date)}.\nPagamento registrado em ${fmtDate(p.paid_at)}.\n\nPersonal: ${me.name}\nCódigo: ${me.publicCode||''}\nEmitido em: ${new Date().toLocaleString('pt-BR')}`;download(`recibo-${selected.athlete.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}-${String(p.due_date).slice(0,10)}.txt`,'text/plain;charset=utf-8',text)}

  async function enableNotifications(){
    try{
      const local=window.Capacitor?.Plugins?.LocalNotifications;
      if(local){
        let permission=await local.checkPermissions();if(permission.display!=='granted')permission=await local.requestPermissions();if(permission.display!=='granted'){toast('Permissão de notificações não concedida.');return}
        await local.cancel({notifications:[{id:8050}]});
        await local.schedule({notifications:[{id:8050,title:'Vaz Personal — prioridades do dia',body:'Abra sua fila para revisar treinos, solicitações e mensalidades.',schedule:{on:{hour:9,minute:0},repeats:true,allowWhileIdle:true}}]});
        localStorage.setItem('vazPersonal.notifications.v8','on');toast('Notificação diária ativada para 9h.');return;
      }
      if(!('Notification' in window)){toast('As notificações não estão disponíveis neste dispositivo.');return}
      const permission=await Notification.requestPermission();if(permission!=='granted'){toast('Permissão de notificações não concedida.');return}
      localStorage.setItem('vazPersonal.notifications.v8','on');new Notification('Vaz Personal',{body:'Notificações ativadas. Você receberá alertas das prioridades do dia.'});toast('Notificações ativadas.')
    }catch{toast('Não foi possível ativar notificações agora.')}
  }
  function checkNotifications(){
    if(localStorage.getItem('vazPersonal.notifications.v8')!=='on'||!('Notification' in window)||Notification.permission!=='granted')return;
    const today=new Date().toISOString().slice(0,10);if(localStorage.getItem(ALERT_KEY)===today)return;
    const n=(ops.alerts||[]).length;if(!n)return;const critical=(ops.alerts||[]).filter(a=>a.severity==='danger').length;
    try{new Notification(`Vaz Personal — ${n} prioridade(s)`,{body:critical?`${critical} item(ns) urgente(s). Abra sua fila de hoje.`:'Há solicitações e ciclos para revisar hoje.',icon:'./icon.svg'});localStorage.setItem(ALERT_KEY,today)}catch{}
  }
  async function checkUpdate(){
    try{const r=await fetch(`./version.json?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)return;const d=await r.json();updateInfo={...d,available:String(d.version||'')!==APP_VERSION}}catch{}
  }

  const baseBindPersonal=bindPersonal;
  bindPersonal=function(){
    baseBindPersonal();
    document.getElementById('openPlanHistory')?.addEventListener('click',openHistory);
    document.getElementById('acceptPlanRequest')?.addEventListener('click',()=>reviewRequest('reviewing'));
    document.getElementById('rejectPlanRequest')?.addEventListener('click',()=>{if(confirm('Recusar esta solicitação de novo treino?'))reviewRequest('rejected')});
    document.getElementById('exportFinance')?.addEventListener('click',exportFinance);
    document.getElementById('shareBillingSummary')?.addEventListener('click',()=>shareText(`Vaz Personal — resumo financeiro\nEm dia: ${money(ops.finance?.currentRevenue||0)}\nPendente: ${money(ops.finance?.pendingRevenue||0)}\nAlunos inadimplentes: ${ops.finance?.overdue||0}`));
    document.getElementById('enableNotifications')?.addEventListener('click',enableNotifications);
    document.getElementById('exportBackup')?.addEventListener('click',exportBackup);
    document.querySelectorAll('[data-receipt]').forEach(b=>b.onclick=()=>receipt(b.dataset.receipt));
  };

  const style=document.createElement('style');style.textContent=`
    .vp-connectivity{position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:9999;width:min(620px,calc(100% - 20px));background:#201b06;color:#fff5b5;border:1px solid #806a10;border-radius:15px;padding:10px 14px;box-shadow:0 12px 40px #0003}.vp-connectivity strong,.vp-connectivity span{display:block}.vp-connectivity span{font-size:10px;margin-top:2px}.vp-action-row{width:100%;display:grid;grid-template-columns:34px 1fr auto;align-items:center;gap:10px;text-align:left;border:1px solid var(--line);background:#fff;border-radius:16px;padding:11px;margin-top:8px}.vp-action-row>span{width:30px;height:30px;border-radius:10px;background:#fff4b8;display:grid;place-items:center;font-weight:900}.vp-action-row strong,.vp-action-row small{display:block}.vp-action-row small{color:var(--muted);margin-top:3px}.vp-action-row>b{font-size:9px}.vp-action-row.danger{border-color:#efb5ae;background:#fff9f8}.vp-history-row{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid var(--line);padding:12px 0}.vp-history-row strong,.vp-history-row small{display:block}.vp-history-row small{color:var(--muted);margin-top:3px}.vp-request-card{border-color:#e3bd25;background:#fffdf3}@media(max-width:640px){.vp-action-row{grid-template-columns:30px 1fr}.vp-action-row>b{grid-column:2}.vp-history-row{align-items:flex-start}}
  `;document.head.appendChild(style);connectivityBanner();
})();
