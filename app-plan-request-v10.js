// Vaz Fitness v10 — solicitação segura de novo treino, descansos na aba Treinos e sessões extras.
(()=>{
  const TOKEN_KEY='vazFitness.authToken';
  const dayNames=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const selectedRestDays=()=>[...new Set((state.profile.restDays||[]).map(Number).filter(d=>Number.isInteger(d)&&d>=0&&d<=6))].slice(0,5).sort((a,b)=>a-b);
  const trainingDays=()=>Math.max(2,Math.min(6,Number(state.profile.days)||4));
  const maxRestDays=()=>7-trainingDays();
  const isRestDayToday=()=>selectedRestDays().includes(new Date().getDay());
  function applyPlanDayOverrides(){
    const map=state.planDayOverrides&&typeof state.planDayOverrides==='object'?state.planDayOverrides:{},ids=new Set((state.plan||[]).map(x=>String(x.id)));
    Object.keys(map).forEach(id=>{if(!ids.has(String(id)))delete map[id]});
    (state.plan||[]).forEach(item=>{const day=Number(map[item.id]);if(Number.isInteger(day)&&day>=0&&day<=6&&Number(item.day)!==day){item.day=day;delete item.scheduledDate}});
    state.planDayOverrides=map;
  }
  const api=async(action,{method='GET',body=null}={})=>{
    const token=localStorage.getItem(TOKEN_KEY)||'';if(!token)throw new Error('Entre na sua conta para enviar a solicitação.');
    const r=await fetch(`${window.VAZ_API_BASE||''}/api/vf?action=${encodeURIComponent(action)}`,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:body?JSON.stringify(body):undefined});
    const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||'Não foi possível enviar a solicitação.');return d;
  };
  function restOptions(values=selectedRestDays()){
    return dayNames.map((name,day)=>`<label><input type="checkbox" name="requestRestDays" value="${day}" ${values.includes(day)?'checked':''}><span>${name.slice(0,3)}</span></label>`).join('');
  }
  function restTrainingCard(){
    const days=selectedRestDays(),todayRest=isRestDayToday();
    return `<div class="card vf-rest-card vf-training-rest-card"><div class="card-head"><div><h2>Dias de descanso</h2><p>Defina sua semana sem alterar os exercícios do plano.</p></div><span class="pill">${days.length} selecionado(s)</span></div>
      <div class="vf-rest-profile">${dayNames.map((name,day)=>`<label><input type="checkbox" data-rest-day value="${day}" ${days.includes(day)?'checked':''}><span>${name.slice(0,3)}</span></label>`).join('')}</div>
      <div class="vf-rest-card-foot"><small>Com ${trainingDays()} dias de treino, escolha até ${maxRestDays()} dia(s) de descanso. Depois, use “Remanejar treinos” para redistribuir somente os dias.</small>
      <button type="button" class="btn ghost" data-remap-workouts>↔ Remanejar treinos</button></div>
      ${todayRest?`<div class="vf-rest-today"><div><strong>Hoje é um dia de descanso planejado.</strong><span>Se quiser treinar, escolha um treino do seu plano. A sessão será registrada como treino extra e o treino original continuará no planejamento.</span></div><button type="button" class="btn primary" data-extra-workout-open>+ Selecionar treino extra</button></div>`:''}
    </div>`;
  }
  function requestStatusCard(){
    const r=state.planChangeRequest;if(!r||!['pending','reviewing'].includes(r.status))return '';
    return `<div class="card vf-plan-request-status"><div><span class="eyebrow">SOLICITAÇÃO ENVIADA</span><h2>Seu treino atual continua ativo.</h2><p>O personal recebeu o motivo da mudança e seus dias de descanso. O plano só será alterado depois que ele revisar e liberar a nova versão.</p></div><span class="pill">${r.status==='reviewing'?'EM ANÁLISE':'AGUARDANDO'}</span></div>`;
  }

  const baseProfile=renderProfile;
  renderProfile=function(){
    let html=baseProfile();
    html=html.replace(/<button class="btn dark" data-regenerate>[^<]*<\/button>/,'<button class="btn dark" data-request-plan>Gerar novo treino</button>');
    html=html.replace(/<button class="btn danger-soft" data-reset>[^<]*<\/button>/,'');
    return `${requestStatusCard()}${html}`;
  };

  const baseWorkout=renderWorkout;
  renderWorkout=function(){
    const html=baseWorkout();
    const card=restTrainingCard();
    const firstEnd=html.indexOf('</section>');
    return firstEnd>=0?html.slice(0,firstEnd+10)+card+html.slice(firstEnd+10):card+html;
  };

  function openRequestDialog(){
    const d=document.createElement('dialog');d.className='dialog vf-request-dialog';d.innerHTML=`<form data-plan-request-form><div class="vf-request-head"><div><span class="eyebrow">NOVO TREINO</span><h2>Solicitar mudança de plano</h2><p>Seu treino atual não será alterado agora. A solicitação será enviada para o personal revisar.</p></div><button type="button" class="training-detail-close" data-close>✕</button></div><label>Por que você quer um novo treino?<textarea name="reason" rows="4" minlength="8" maxlength="500" required placeholder="Ex.: mudei meus horários, quero trocar o objetivo, senti dificuldade em alguns exercícios…"></textarea></label><fieldset class="vf-request-rest"><legend>Dias de descanso</legend><div>${restOptions()}</div><small>Para ${trainingDays()} dias de treino, escolha no máximo ${maxRestDays()} dia(s).</small></fieldset><label class="check-row vf-confirm-request"><input type="checkbox" name="confirmed" required><span>Tenho certeza de que quero enviar esta solicitação ao meu personal.</span></label><div class="dialog-actions"><button type="button" class="btn ghost" data-close>Cancelar</button><button type="submit" class="btn primary">Enviar solicitação</button></div></form>`;document.body.appendChild(d);d.showModal();d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{d.close();d.remove()});
    d.querySelectorAll('input[name="requestRestDays"]').forEach(input=>input.onchange=()=>{const checked=[...d.querySelectorAll('input[name="requestRestDays"]:checked')];if(checked.length>maxRestDays()){input.checked=false;toast(`Escolha no máximo ${maxRestDays()} dia(s) de descanso.`)}});
    d.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),button=e.currentTarget.querySelector('button[type="submit"]'),restDays=f.getAll('requestRestDays').map(Number).slice(0,5);if(restDays.length>maxRestDays())return toast(`Escolha no máximo ${maxRestDays()} dia(s) de descanso.`);button.disabled=true;button.textContent='Enviando…';try{const data=await api('plan_change_request',{method:'POST',body:{reason:String(f.get('reason')||'').trim(),restDays}});state.profile.restDays=restDays;state.planChangeRequest={...data.request,createdAt:new Date().toISOString()};save();d.close();d.remove();render();toast('Solicitação enviada. Seu treino atual foi mantido.')}catch(err){button.disabled=false;button.textContent='Enviar solicitação';toast(err.message)}};
  }

  function applyRestSelection(input){
    const inputs=[...document.querySelectorAll('[data-rest-day]')],checked=inputs.filter(x=>x.checked);
    if(checked.length>maxRestDays()){
      input.checked=false;toast(`Com ${trainingDays()} dias de treino, escolha no máximo ${maxRestDays()} dia(s) de descanso.`);return;
    }
    state.profile.restDays=checked.map(x=>Number(x.value)).sort((a,b)=>a-b);
    state.weekOverrides={};
    state.weekOverridesResetPending=true;
    save();
    toast('Dias de descanso atualizados. Toque em “Remanejar treinos” para redistribuir o plano.');
  }

  async function remapWorkouts(){
    const rest=new Set(selectedRestDays()),allowed=[1,2,3,4,5,6,0].filter(d=>!rest.has(d));
    const workouts=(state.plan||[]).filter(x=>x&&x.status!=='abandoned'&&['strength','run'].includes(x.type));
    if(!allowed.length)return toast('Selecione menos dias de descanso.');
    if(!workouts.length)return toast('Não há treinos no plano para remanejar.');
    if(!confirm('Remanejar os dias dos treinos mantendo exatamente os mesmos exercícios e prescrições?'))return;
    state.planDayOverrides={};
    state.weekOverrides={};
    state.weekOverridesResetPending=true;
    workouts.forEach((item,index)=>{item.day=allowed[index%allowed.length];state.planDayOverrides[item.id]=item.day;delete item.scheduledDate});
    save();
    try{window.VazCalendar?.reconcile?.()}catch{}
    try{
      const reset=await fetch(`${window.VAZ_API_BASE||''}/api/health?scope=remap&action=reset_overrides`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem(TOKEN_KEY)||''}`},body:JSON.stringify({reason:'rest_days_changed'})});
      if(reset.ok){state.weekOverridesResetPending=false;save();}
    }catch{}
    try{await window.VazCloudSync?.syncNow?.()}catch{}
    render();
    toast('Treinos remanejados. Os descansos antigos foram substituídos pelos novos.');
  }

  function extraWorkoutOptions(){
    return (state.plan||[]).filter(x=>x&&['strength','run'].includes(x.type)&&x.status!=='abandoned');
  }
  function openExtraWorkoutDialog(){
    const options=extraWorkoutOptions();
    if(!options.length)return toast('Nenhum treino disponível no plano.');
    document.querySelector('#vfExtraWorkoutDialog')?.remove();
    const d=document.createElement('dialog');d.id='vfExtraWorkoutDialog';d.className='dialog vf-extra-dialog';
    d.innerHTML=`<div class="vf-extra-sheet"><div class="vf-request-head"><div><span class="eyebrow">TREINO EXTRA</span><h2>Qual treino você quer fazer hoje?</h2><p>Hoje é um dia de descanso. O treino escolhido será registrado como extra e não será removido da programação original.</p></div><button type="button" class="training-detail-close" data-close>✕</button></div><div class="vf-extra-list">${options.map(item=>`<button type="button" class="vf-extra-option" data-extra-plan="${item.id}"><div><span class="vf-extra-type">${item.type==='run'?'CORRIDA':'FORÇA'}</span><strong>${item.name}</strong><small>Previsto: ${dayNames[item.day]||'—'} • ${item.status==='done'?'já concluído — repetir como extra':'pendente no plano'}</small></div><b>Selecionar ›</b></button>`).join('')}</div></div>`;
    document.body.appendChild(d);d.showModal();
    d.querySelector('[data-close]')?.addEventListener('click',()=>{d.close();d.remove()});
    d.addEventListener('click',e=>{if(e.target===d){d.close();d.remove()}});
    d.querySelectorAll('[data-extra-plan]').forEach(button=>button.addEventListener('click',()=>{
      const id=button.dataset.extraPlan;
      state.pendingExtraWorkout={planId:id,selectedAt:Date.now(),executedOnRestDay:true,day:new Date().getDay()};
      save();d.close();d.remove();startItem(id);
    }));
  }

  function normalizeRestDayStartButtons(){
    if(!isRestDayToday())return;
    document.querySelectorAll('[data-start]').forEach(button=>{
      button.removeAttribute('data-start');
      button.setAttribute('data-extra-workout-open','');
      button.textContent='＋ Selecionar treino extra';
    });
    document.querySelectorAll('[data-extra-run]').forEach(button=>{
      button.removeAttribute('data-extra-run');
      button.setAttribute('data-extra-workout-open','');
      button.textContent='＋ Selecionar treino extra';
    });
  }

  const baseStartItem=startItem;
  startItem=function(id){
    const pending=state.pendingExtraWorkout,valid=pending&&String(pending.planId)===String(id)&&Date.now()-Number(pending.selectedAt||0)<30*60*1000;
    if(isRestDayToday()&&!valid){openExtraWorkoutDialog();return;}
    baseStartItem(id);
  };

  applyPlanDayOverrides();
  const baseRenderAll=render;
  render=function(){applyPlanDayOverrides();return baseRenderAll();};

  const baseBind=bindDynamic;
  bindDynamic=function(){
    normalizeRestDayStartButtons();
    baseBind();
    document.querySelector('[data-request-plan]')?.addEventListener('click',openRequestDialog);
    document.querySelectorAll('[data-rest-day]').forEach(input=>input.onchange=()=>applyRestSelection(input));
    document.querySelectorAll('[data-remap-workouts]').forEach(button=>button.onclick=remapWorkouts);
    document.querySelectorAll('[data-extra-workout-open]').forEach(button=>button.onclick=openExtraWorkoutDialog);
  };

  const style=document.createElement('style');style.textContent=`
    .vf-plan-request-status{display:flex;justify-content:space-between;gap:15px;align-items:flex-start;border-color:#e1c04b;background:#fffbed;margin-bottom:18px}.vf-plan-request-status h2{margin:5px 0}.vf-plan-request-status p{margin:0;color:var(--muted);line-height:1.55}
    .vf-rest-profile,.vf-request-rest>div{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.vf-rest-profile label,.vf-request-rest label{margin:0;min-width:0}.vf-rest-profile input,.vf-request-rest input{position:absolute;opacity:0}.vf-rest-profile span,.vf-request-rest label span{display:grid;place-items:center;padding:10px 3px;border:1px solid var(--line);border-radius:12px;font-size:10px;font-weight:850}.vf-rest-profile input:checked+span,.vf-request-rest input:checked+span{background:#191919;color:#fff;border-color:#191919}
    .vf-training-rest-card{margin:14px 0 18px}.vf-rest-card-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px}.vf-rest-card-foot small{display:block;color:var(--muted);line-height:1.45;max-width:650px}.vf-rest-today{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:13px;border:1px solid #ead273;background:#fff9df;border-radius:16px}.vf-rest-today strong,.vf-rest-today span{display:block}.vf-rest-today strong{font-size:12px}.vf-rest-today span{font-size:10px;color:var(--muted);line-height:1.45;margin-top:3px}
    .vf-request-dialog{width:min(650px,calc(100% - 20px));padding:22px}.vf-request-head{display:flex;justify-content:space-between;gap:12px}.vf-request-head h2{font-size:26px;margin:6px 0}.vf-request-head p{color:var(--muted);line-height:1.5}.vf-request-dialog textarea{width:100%;border:1px solid var(--line);border-radius:14px;padding:12px;font:inherit;resize:vertical;margin-top:6px}.vf-request-rest{border:1px solid var(--line);border-radius:16px;padding:13px;margin:14px 0}.vf-request-rest legend{font-weight:850;padding:0 5px}.vf-confirm-request{margin-top:12px}
    .vf-extra-dialog{width:min(650px,calc(100% - 20px));padding:0;overflow:hidden}.vf-extra-sheet{padding:20px}.vf-extra-list{display:grid;gap:8px;margin-top:14px;max-height:58vh;overflow:auto}.vf-extra-option{width:100%;border:1px solid var(--line);background:#fff;border-radius:16px;padding:13px;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;color:var(--ink)}.vf-extra-option:hover{border-color:#d0ad00;background:#fffdf2}.vf-extra-option strong,.vf-extra-option small,.vf-extra-type{display:block}.vf-extra-option strong{font-size:13px;margin:3px 0}.vf-extra-option small{font-size:10px;color:var(--muted)}.vf-extra-type{font-size:8px;font-weight:900;letter-spacing:.08em;color:#876d00}.vf-extra-option b{font-size:10px;white-space:nowrap}
    @media(max-width:600px){.vf-rest-profile,.vf-request-rest>div{grid-template-columns:repeat(4,minmax(0,1fr))}.vf-plan-request-status,.vf-rest-card-foot,.vf-rest-today{flex-direction:column;align-items:stretch}.vf-rest-card-foot .btn,.vf-rest-today .btn{width:100%}.vf-extra-sheet{padding:16px}.vf-extra-option{align-items:flex-start}.vf-extra-option b{display:none}}
  `;document.head.appendChild(style);
})();
