// Vaz Personal v15 — central diária acionável e notificações configuráveis.
(()=>{
  const STATE_KEY='vazPersonal.today.v15';
  const NOTIFICATION_KEY='vazPersonal.notifications.v15';
  const NOTIFIED_KEY='vazPersonal.notifiedTasks.v15';
  const LEGACY_NOTIFICATION_KEY='vazPersonal.notifications.v8';
  const DAILY_NOTIFICATION_ID=8150;
  let todayFilter='all';

  const jsonRead=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
  const jsonWrite=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
  const now=()=>Date.now();
  const taskId=item=>`${item.kind||'task'}:${item.athleteId||'none'}:${item.requestId||''}`;
  const categoryOf=kind=>kind==='billing'?'finance':kind==='approval'?'access':['health','feedback','recovery'].includes(kind)?'health':'training';
  const priorityOf=item=>Number(item.priority)||(item.kind==='cycle'&&item.severity==='danger'?100:item.kind==='request'?95:item.kind==='approval'?90:item.kind==='billing'?80:60);
  const metaOf=kind=>({request:{icon:'✦',label:'Solicitação de treino',action:'Revisar solicitação'},cycle:{icon:'◷',label:'Ciclo de treino',action:'Abrir gestão'},billing:{icon:'R$',label:'Financeiro',action:'Ver mensalidade'},approval:{icon:'✓',label:'Novo aluno',action:'Revisar cadastro'},health:{icon:'✚',label:'Lesão / limitação',action:'Ver aluno'},feedback:{icon:'!',label:'Feedback do treino',action:'Ver aluno'},recovery:{icon:'◌',label:'Recuperação',action:'Ver aluno'}}[kind]||{icon:'•',label:'Atenção',action:'Abrir aluno'});
  const notificationDefaults=()=>({enabled:false,time:'09:00',training:true,finance:true,access:true,health:true});
  function notificationConfig(){const saved=jsonRead(NOTIFICATION_KEY,null);return {...notificationDefaults(),...(saved&&typeof saved==='object'?saved:{})}}
  function taskState(){const state=jsonRead(STATE_KEY,{});return state&&typeof state==='object'?state:{}}
  function buildTasks(alerts=[],clientList=[]){
    const all=[...(Array.isArray(alerts)?alerts:[])];
    (Array.isArray(clientList)?clientList:[]).filter(c=>c?.status==='pending').forEach(c=>all.push({kind:'approval',severity:'warning',priority:90,athleteId:c.id,name:c.name,message:'Cadastro aguardando revisão e liberação.',actionTab:'access'}));
    const unique=new Map();
    all.filter(a=>a?.athleteId&&a?.name).forEach(raw=>{const item={...raw,id:taskId(raw),category:categoryOf(raw.kind),priority:priorityOf(raw),actionTab:raw.actionTab||(raw.kind==='approval'?'access':'management')};const previous=unique.get(item.id);if(!previous||item.priority>previous.priority)unique.set(item.id,item)});
    return [...unique.values()].sort((a,b)=>b.priority-a.priority||String(a.name).localeCompare(String(b.name),'pt-BR'));
  }
  function isUrgent(task){return task.severity==='danger'||task.priority>=90}
  function isSnoozed(task,state=taskState()){return Number(state[task.id]?.until||0)>now()}
  function activeTasks(){const state=taskState();return buildTasks(ops?.alerts||[],clients||[]).filter(task=>!isSnoozed(task,state))}
  function filteredTasks(){return activeTasks().filter(task=>todayFilter==='all'||todayFilter==='urgent'&&isUrgent(task)||task.category===todayFilter)}
  function longDate(){return new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'}).replace(/^./,x=>x.toUpperCase())}
  function detailText(task){if(task.kind==='billing'&&task.amount!=null)return `${task.message} • ${money(task.amount)}`;return task.message||'Ação pendente.'}
  function taskCard(task){const meta=metaOf(task.kind);return `<article class="vp-today-task ${isUrgent(task)?'urgent':''}" data-today-task="${safe(task.id)}"><div class="vp-today-task-icon ${safe(task.category)}">${safe(meta.icon)}</div><div class="vp-today-task-copy"><div class="vp-today-task-top"><strong>${safe(task.name)}</strong><span>${safe(meta.label)}</span></div><p>${safe(detailText(task))}</p></div><div class="vp-today-task-actions"><button class="vp-btn primary" data-open="${safe(task.athleteId)}" data-tab-target="${safe(task.actionTab)}">${safe(meta.action)}</button><button class="vp-btn ghost" data-snooze-task="${safe(task.id)}">Lembrar amanhã</button></div></article>`}
  function todayCenter(){
    const all=buildTasks(ops?.alerts||[],clients||[]),state=taskState(),snoozed=all.filter(task=>isSnoozed(task,state)),active=all.filter(task=>!isSnoozed(task,state)),shown=filteredTasks(),urgent=active.filter(isUrgent).length;
    const filters=[['all','Todas',active.length],['urgent','Urgentes',urgent],['health','Saúde',active.filter(x=>x.category==='health').length],['training','Treinos',active.filter(x=>x.category==='training').length],['finance','Financeiro',active.filter(x=>x.category==='finance').length],['access','Cadastros',active.filter(x=>x.category==='access').length]];
    return `<section class="vp-today-center"><div class="vp-today-summary"><div><span class="vp-today-eyebrow">CENTRAL DO DIA</span><h2>${active.length?`${active.length} ação(ões) para hoje`:'Tudo em ordem por aqui'}</h2><p>${active.length?'As prioridades mais importantes já estão organizadas para você.':'Nenhuma pendência exige sua atenção agora.'}</p></div><div class="vp-today-score ${urgent?'has-urgent':''}"><strong>${urgent}</strong><span>urgente(s)</span></div></div><div class="vp-today-filters">${filters.map(([id,label,count])=>`<button class="${todayFilter===id?'active':''}" data-today-filter="${id}">${label} <b>${count}</b></button>`).join('')}${snoozed.length?`<button data-show-snoozed>Adiadas <b>${snoozed.length}</b></button>`:''}</div><div class="vp-today-list">${shown.length?shown.map(taskCard).join(''):`<div class="vp-today-empty"><strong>${active.length?'Nenhuma ação neste filtro.':'Agenda limpa!'}</strong><span>${active.length?'Escolha outro filtro para ver as demais prioridades.':'Você concluiu ou não possui pendências para hoje.'}</span></div>`}</div></section>`;
  }

  renderHome=function(){
    const active=clients.filter(x=>x.status==='approved').length,pending=clients.filter(x=>x.status==='pending').length,f=ops.finance||{};
    return `${pageHead('O que fazer hoje',`Bom dia, ${me.name?.split(' ')[0]||'Personal'} • ${longDate()}`,`<button class="vp-btn ghost" id="refreshToday">↻ Atualizar</button>`)}${todayCenter()}<section class="vp-grid four vp-section vp-home-stats"><div class="vp-card compact vp-stat"><span>Alunos ativos</span><strong>${active}</strong></div><div class="vp-card compact vp-stat"><span>Novos cadastros</span><strong>${pending}</strong></div><div class="vp-card compact vp-stat"><span>Treinos a revisar</span><strong>${ops.counts?.cycleReview||0}</strong></div><div class="vp-card compact vp-stat"><span>Valor pendente</span><strong>${money(f.pendingRevenue||0)}</strong></div></section><section class="vp-grid two vp-section"><div class="vp-card vp-quick-card"><div class="vp-page-head"><div><h2>Ações rápidas</h2><p>Atalhos do dia a dia.</p></div></div><div class="vp-quick-grid"><button class="vp-quick-action primary" id="homeClaim"><span class="vp-quick-icon">+</span><span><strong>Vincular aluno</strong><small>Novo código ID</small></span><b>›</b></button><button class="vp-quick-action" data-view="billing"><span class="vp-quick-icon">R$</span><span><strong>Mensalidades</strong><small>Recebimentos e vencimentos</small></span><b>›</b></button><button class="vp-quick-action" data-view="workouts"><span class="vp-quick-icon">▦</span><span><strong>Biblioteca de treinos</strong><small>Planos e exercícios</small></span><b>›</b></button></div></div><div class="vp-card"><div class="vp-page-head"><div><h2>Alunos recentes</h2><p>Acesso rápido aos últimos cadastros.</p></div><button class="vp-btn ghost" data-view="students">Ver todos</button></div>${clientRows(clients.slice(0,4))}</div></section>`;
  };

  function settingsHtml(){const config=notificationConfig(),native=!!window.Capacitor?.Plugins?.LocalNotifications;return `<div class="vp-settings-card-head"><span>◉</span><div><h2>Notificações</h2><p>${native?'Lembrete diário mesmo com o aplicativo fechado.':'Alertas quando o Vaz Personal estiver aberto.'}</p></div></div><form id="todayNotificationForm"><label class="vp-notification-main"><input type="checkbox" name="enabled" ${config.enabled?'checked':''}><span><strong>Ativar lembretes</strong><small>Avise sobre novas prioridades e envie o resumo diário.</small></span></label><div class="vp-field vp-notification-time"><label>Horário do resumo diário</label><input type="time" name="time" value="${safe(config.time)}" required></div><div class="vp-notification-categories"><label><input type="checkbox" name="training" ${config.training?'checked':''}> Treinos e solicitações</label><label><input type="checkbox" name="finance" ${config.finance?'checked':''}> Mensalidades</label><label><input type="checkbox" name="access" ${config.access?'checked':''}> Novos cadastros</label><label><input type="checkbox" name="health" ${config.health?'checked':''}> Saúde e recuperação</label></div><button class="vp-btn primary">Salvar notificações</button><small class="vp-notification-status">${config.enabled?`Ativas • resumo às ${safe(config.time)}`:'Desativadas'}</small></form>`}
  function notificationTasks(config=notificationConfig()){return activeTasks().filter(task=>config[task.category]!==false)}
  function notificationBody(config=notificationConfig()){const tasks=notificationTasks(config),urgent=tasks.filter(isUrgent).length;if(!tasks.length)return'Nenhuma pendência importante para hoje.';return urgent?`${tasks.length} prioridade(s), sendo ${urgent} urgente(s). Abra sua central do dia.`:`${tasks.length} prioridade(s) organizadas na sua central do dia.`}
  async function applyNotificationConfig(config,{askPermission=true}={}){
    const local=window.Capacitor?.Plugins?.LocalNotifications;
    if(local){
      if(config.enabled&&askPermission){let permission=await local.checkPermissions();if(permission.display!=='granted')permission=await local.requestPermissions();if(permission.display!=='granted')throw new Error('Permissão de notificações não concedida.')}
      await local.cancel({notifications:[{id:8050},{id:DAILY_NOTIFICATION_ID}]}).catch(()=>{});
      if(config.enabled){const [hour,minute]=String(config.time||'09:00').split(':').map(Number);await local.schedule({notifications:[{id:DAILY_NOTIFICATION_ID,title:'Vaz Personal — o que fazer hoje',body:notificationBody(config),schedule:{on:{hour:Number.isInteger(hour)?hour:9,minute:Number.isInteger(minute)?minute:0},repeats:true,allowWhileIdle:true}}]})}
      return;
    }
    if(config.enabled&&askPermission){if(!('Notification'in window))throw new Error('As notificações não estão disponíveis neste navegador.');const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Permissão de notificações não concedida.')}
  }
  async function saveNotificationSettings(event){event.preventDefault();const form=event.currentTarget,fd=new FormData(form),config={enabled:fd.has('enabled'),time:String(fd.get('time')||'09:00'),training:fd.has('training'),finance:fd.has('finance'),access:fd.has('access'),health:fd.has('health')};if(config.enabled&&!config.training&&!config.finance&&!config.access&&!config.health){toast('Escolha ao menos um tipo de aviso.');return}const button=form.querySelector('button');button.disabled=true;button.textContent='Salvando…';try{await applyNotificationConfig(config);jsonWrite(NOTIFICATION_KEY,config);localStorage.removeItem(LEGACY_NOTIFICATION_KEY);jsonWrite(NOTIFIED_KEY,notificationTasks(config).map(x=>x.id));toast(config.enabled?`Notificações ativadas para ${config.time}.`:'Notificações desativadas.');render()}catch(error){button.disabled=false;button.textContent='Salvar notificações';toast(error.message||'Não foi possível configurar as notificações.')}}
  async function notifyNewPriorities(){const config=notificationConfig();if(!config.enabled)return;const tasks=notificationTasks(config),previous=jsonRead(NOTIFIED_KEY,null);if(!Array.isArray(previous)){jsonWrite(NOTIFIED_KEY,tasks.map(x=>x.id));return}const fresh=tasks.filter(task=>!previous.includes(task.id));jsonWrite(NOTIFIED_KEY,tasks.map(x=>x.id));if(!fresh.length)return;const body=fresh.length===1?`${fresh[0].name}: ${fresh[0].message}`:`${fresh.length} novas prioridades entraram na sua central do dia.`;try{const local=window.Capacitor?.Plugins?.LocalNotifications;if(local){await local.schedule({notifications:[{id:8200+Math.abs(fresh.map(x=>x.id).join('').split('').reduce((n,c)=>((n*31)+c.charCodeAt(0))%700,0)),title:'Vaz Personal — nova prioridade',body,schedule:{at:new Date(Date.now()+1200)}}]})}else if('Notification'in window&&Notification.permission==='granted')new Notification('Vaz Personal — nova prioridade',{body,icon:'./icon.svg'})}catch{}}

  const previousLoadPersonal=loadPersonal;
  loadPersonal=async function(){await previousLoadPersonal();await notifyNewPriorities()};
  const previousSettings=renderSettings;
  renderSettings=function(){return previousSettings()};
  const previousBindPersonal=bindPersonal;
  bindPersonal=function(){
    previousBindPersonal();
    document.getElementById('refreshToday')?.addEventListener('click',async()=>{try{toast('Atualizando prioridades…');await loadPersonal();render();toast('Central atualizada.')}catch(error){toast(error.message)}});
    document.querySelectorAll('[data-today-filter]').forEach(button=>button.onclick=()=>{todayFilter=button.dataset.todayFilter;render()});
    document.querySelectorAll('[data-snooze-task]').forEach(button=>button.onclick=()=>{const state=taskState(),tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);tomorrow.setHours(7,0,0,0);state[button.dataset.snoozeTask]={until:tomorrow.getTime()};jsonWrite(STATE_KEY,state);toast('Prioridade adiada para amanhã.');render()});
    document.querySelector('[data-show-snoozed]')?.addEventListener('click',()=>{jsonWrite(STATE_KEY,{});toast('Prioridades adiadas voltaram para a lista.');render()});
    const legacyButton=document.getElementById('enableNotifications'),card=legacyButton?.closest('.vp-card');if(card){card.innerHTML=settingsHtml();card.querySelector('#todayNotificationForm')?.addEventListener('submit',saveNotificationSettings)}
  };

  if(!localStorage.getItem(NOTIFICATION_KEY)&&localStorage.getItem(LEGACY_NOTIFICATION_KEY)==='on')jsonWrite(NOTIFICATION_KEY,{...notificationDefaults(),enabled:true});
  localStorage.removeItem(LEGACY_NOTIFICATION_KEY);
  window.addEventListener('load',()=>{const config=notificationConfig();if(config.enabled)applyNotificationConfig(config,{askPermission:false}).catch(()=>{});setTimeout(()=>{try{if(typeof me!=='undefined'&&me?.role==='personal'&&view==='home'&&!selected)render()}catch{}},0)},{once:true});
  window.__VAZ_TODAY_CENTER_TEST__={buildTasks,isUrgent,categoryOf,priorityOf,notificationBody};
})();
