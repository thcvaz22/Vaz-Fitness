// Vaz Fitness v10 — solicitação segura de novo treino e dias fixos de descanso.
(()=>{
  const TOKEN_KEY='vazFitness.authToken';
  const dayNames=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const selectedRestDays=()=>[...new Set((state.profile.restDays||[]).map(Number).filter(d=>Number.isInteger(d)&&d>=0&&d<=6))].slice(0,5).sort((a,b)=>a-b);
  const api=async(action,{method='GET',body=null}={})=>{
    const token=localStorage.getItem(TOKEN_KEY)||'';if(!token)throw new Error('Entre na sua conta para enviar a solicitação.');
    const r=await fetch(`${window.VAZ_API_BASE||''}/api/vf?action=${encodeURIComponent(action)}`,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:body?JSON.stringify(body):undefined});
    const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||'Não foi possível enviar a solicitação.');return d;
  };
  function restOptions(values=selectedRestDays()){
    return dayNames.map((name,day)=>`<label><input type="checkbox" name="requestRestDays" value="${day}" ${values.includes(day)?'checked':''}><span>${name.slice(0,3)}</span></label>`).join('');
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
    const days=selectedRestDays(),restCard=`<div class="card vf-rest-card"><div class="card-head"><div><h2>Dias de descanso</h2><p>A AION evita agendar treinos nos dias selecionados.</p></div></div><div class="vf-rest-profile">${dayNames.map((name,day)=>`<label><input type="checkbox" data-rest-day value="${day}" ${days.includes(day)?'checked':''}><span>${name.slice(0,3)}</span></label>`).join('')}</div><small>As alterações serão sincronizadas com seu personal.</small></div>`;
    return `${requestStatusCard()}${html.replace(/<\/section>\s*$/,`${restCard}</section>`)}`;
  };
  function openRequestDialog(){
    const d=document.createElement('dialog');d.className='dialog vf-request-dialog';d.innerHTML=`<form data-plan-request-form><div class="vf-request-head"><div><span class="eyebrow">NOVO TREINO</span><h2>Solicitar mudança de plano</h2><p>Seu treino atual não será alterado agora. A solicitação será enviada para o personal revisar.</p></div><button type="button" class="training-detail-close" data-close>✕</button></div><label>Por que você quer um novo treino?<textarea name="reason" rows="4" minlength="8" maxlength="500" required placeholder="Ex.: mudei meus horários, quero trocar o objetivo, senti dificuldade em alguns exercícios…"></textarea></label><fieldset class="vf-request-rest"><legend>Dias de descanso</legend><div>${restOptions()}</div></fieldset><label class="check-row vf-confirm-request"><input type="checkbox" name="confirmed" required><span>Tenho certeza de que quero enviar esta solicitação ao meu personal.</span></label><div class="dialog-actions"><button type="button" class="btn ghost" data-close>Cancelar</button><button type="submit" class="btn primary">Enviar solicitação</button></div></form>`;document.body.appendChild(d);d.showModal();d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{d.close();d.remove()});
    d.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),button=e.currentTarget.querySelector('button[type="submit"]'),restDays=f.getAll('requestRestDays').map(Number).slice(0,5);button.disabled=true;button.textContent='Enviando…';try{const data=await api('plan_change_request',{method:'POST',body:{reason:String(f.get('reason')||'').trim(),restDays}});state.profile.restDays=restDays;state.planChangeRequest={...data.request,createdAt:new Date().toISOString()};save();d.close();d.remove();render();toast('Solicitação enviada. Seu treino atual foi mantido.')}catch(err){button.disabled=false;button.textContent='Enviar solicitação';toast(err.message)}};
  }
  const baseBind=bindDynamic;
  bindDynamic=function(){
    baseBind();
    document.querySelector('[data-request-plan]')?.addEventListener('click',openRequestDialog);
    document.querySelectorAll('[data-rest-day]').forEach(input=>input.onchange=()=>{const checked=[...document.querySelectorAll('[data-rest-day]:checked')].map(x=>Number(x.value));if(checked.length>5){input.checked=false;toast('Escolha no máximo 5 dias de descanso.');return}state.profile.restDays=checked;save();render();toast('Dias de descanso atualizados.')});
  };
  const style=document.createElement('style');style.textContent=`
    .vf-plan-request-status{display:flex;justify-content:space-between;gap:15px;align-items:flex-start;border-color:#e1c04b;background:#fffbed;margin-bottom:18px}.vf-plan-request-status h2{margin:5px 0}.vf-plan-request-status p{margin:0;color:var(--muted);line-height:1.55}.vf-rest-profile,.vf-request-rest>div{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.vf-rest-profile label,.vf-request-rest label{margin:0}.vf-rest-profile input,.vf-request-rest input{position:absolute;opacity:0}.vf-rest-profile span,.vf-request-rest label span{display:grid;place-items:center;padding:10px 3px;border:1px solid var(--line);border-radius:12px;font-size:10px;font-weight:850}.vf-rest-profile input:checked+span,.vf-request-rest input:checked+span{background:#191919;color:#fff;border-color:#191919}.vf-rest-card>small{display:block;color:var(--muted);margin-top:9px}.vf-request-dialog{width:min(650px,calc(100% - 20px));padding:22px}.vf-request-head{display:flex;justify-content:space-between;gap:12px}.vf-request-head h2{font-size:26px;margin:6px 0}.vf-request-head p{color:var(--muted);line-height:1.5}.vf-request-dialog textarea{width:100%;border:1px solid var(--line);border-radius:14px;padding:12px;font:inherit;resize:vertical;margin-top:6px}.vf-request-rest{border:1px solid var(--line);border-radius:16px;padding:13px;margin:14px 0}.vf-request-rest legend{font-weight:850;padding:0 5px}.vf-confirm-request{margin-top:12px}.v10-measure-figure{margin:12px 0 0;border:1px solid var(--line);border-radius:20px;overflow:hidden;background:#faf8f1}.v10-measure-figure img{display:block;width:100%;height:auto;aspect-ratio:2/1;object-fit:cover}.v10-measure-figure figcaption{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:var(--line)}.v10-measure-figure figcaption span{background:#fff;padding:9px 3px;text-align:center;font-size:10px;font-weight:850}.v10-measure-instructions{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:12px}.v10-measure-instructions p{margin:0;background:#fafafa;border:1px solid var(--line);border-radius:14px;padding:11px;font-size:10px;line-height:1.5;color:var(--muted)}.v10-measure-instructions strong{color:#222}@media(max-width:600px){.vf-rest-profile,.vf-request-rest>div{grid-template-columns:repeat(4,1fr)}.vf-plan-request-status{flex-direction:column}.v10-measure-figure{overflow-x:auto}.v10-measure-figure img{width:820px;max-width:none}.v10-measure-figure figcaption{width:820px}.v10-measure-instructions{grid-template-columns:1fr}}
  `;document.head.appendChild(style);
})();
