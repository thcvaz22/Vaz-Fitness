// Vaz Fitness v6 — feedback pós-treino, lesões/limitações e metas gamificadas.
(function installExperienceV6(){
  const pad=n=>String(n).padStart(2,'0');
  const monthKey=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}`};
  const dateKey=v=>{const d=new Date(v||0);return Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
  const safe=v=>escapeHtml(v==null?'':String(v));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
  const uid=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

  function ensureState(){
    state.healthRecords=Array.isArray(state.healthRecords)?state.healthRecords:[];
    state.medalHall=Array.isArray(state.medalHall)?state.medalHall:[];
    state.monthlyChallenges=Array.isArray(state.monthlyChallenges)?state.monthlyChallenges:[];
    state.customGameGoals=Array.isArray(state.customGameGoals)?state.customGameGoals:[];
    state.goals=state.goals||{};
    state.profile=state.profile||{};
  }
  function monthStats(){
    const p=monthKey();
    const strength=(state.sessions||[]).filter(s=>dateKey(s.date).startsWith(p));
    const runs=(state.runSessions||[]).filter(s=>dateKey(s.date).startsWith(p));
    return {sessions:strength.length+runs.length,strengthSessions:strength.length,runSessions:runs.length,runKm:runs.reduce((a,r)=>a+(Number(r.distance)||0),0),activeMinutes:[...strength,...runs].reduce((a,s)=>a+(Number(s.duration)||0),0),feedbacks:[...strength,...runs].filter(s=>s.sessionFeedback).length};
  }
  function metricValue(metric){const s=monthStats();return metric==='runKm'?s.runKm:metric==='activeMinutes'?s.activeMinutes:metric==='strengthSessions'?s.strengthSessions:metric==='runSessions'?s.runSessions:metric==='feedbacks'?s.feedbacks:metric==='manual'?0:s.sessions}
  function metricLabel(metric){return ({sessions:'Treinos concluídos',strengthSessions:'Treinos de força',runSessions:'Corridas',runKm:'Km de corrida',activeMinutes:'Minutos ativos',feedbacks:'Feedbacks registrados',manual:'Meta livre'})[metric]||'Meta'}
  function targetUnit(metric){return metric==='runKm'?' km':metric==='activeMinutes'?' min':''}
  function challengeProgress(c){if(c.metric==='manual')return c.completedAt?c.target:0;return metricValue(c.metric)}
  function difficultyName(n){return ['','Bronze','Prata','Ouro','Lendária'][clamp(n,1,4)]}

  function autoChallenges(){
    const days=clamp(state.profile?.days||4,2,6),mode=state.profile?.mode||'hybrid',runTarget=Number(state.goals?.monthlyRunKm)||30;
    const list=[
      {id:`${monthKey()}-consistency`,title:'Ritmo do mês',description:'Mantenha consistência durante o mês.',metric:'sessions',target:Math.max(6,days*3),difficulty:2,medalKind:'calendar'},
      {id:`${monthKey()}-feedback`,title:'Atleta consciente',description:'Registre como o corpo respondeu após os treinos.',metric:'feedbacks',target:6,difficulty:1,medalKind:'mind'},
      {id:`${monthKey()}-minutes`,title:'Motor ligado',description:'Acumule tempo ativo ao longo do mês.',metric:'activeMinutes',target:Math.max(360,days*180),difficulty:3,medalKind:'flame'}
    ];
    if(mode!=='run')list.push({id:`${monthKey()}-strength`,title:'Força constante',description:'Complete sessões de musculação com regularidade.',metric:'strengthSessions',target:Math.max(6,Math.round(days*2)),difficulty:2,medalKind:'strength'});
    if(mode!=='strength')list.push({id:`${monthKey()}-run`,title:'Estrada conquistada',description:'Some quilômetros de corrida no mês.',metric:'runKm',target:runTarget,difficulty:runTarget>=60?4:runTarget>=40?3:2,medalKind:'run'});
    return list;
  }
  function ensureMonthlyChallenges(){
    const key=monthKey();if(state.challengeMonth===key&&state.monthlyChallenges.length)return;
    state.challengeMonth=key;state.monthlyChallenges=autoChallenges();
  }
  function medalFor(c){return {id:`medal-${c.id}`,challengeId:c.id,title:c.title,description:c.description,difficulty:c.difficulty||1,kind:c.medalKind||c.metric||'star',earnedAt:new Date().toISOString(),month:monthKey()}}
  function evaluateChallenges(){
    ensureMonthlyChallenges();
    [...state.monthlyChallenges,...state.customGameGoals].forEach(c=>{
      if(c.completedAt)return;const value=challengeProgress(c);
      if(c.metric!=='manual'&&value>=Number(c.target||0)){
        c.completedAt=new Date().toISOString();
        if(!state.medalHall.some(m=>m.challengeId===c.id))state.medalHall.push(medalFor(c));
      }
    });
    state.medalHall=state.medalHall.slice(-180);state.customGameGoals=state.customGameGoals.slice(-60);
  }
  function syncHealthContext(){
    const active=state.healthRecords.filter(x=>x.status!=='resolved').slice(-12).map(x=>({type:x.type,area:x.area,status:x.status,severity:x.severity,avoid:x.avoid||'',guidance:x.guidance||'',notes:x.notes||''}));
    state.profile.healthContext={activeRestrictions:active,updatedAt:new Date().toISOString()};
  }
  function syncGoalContext(){state.goals.gamification={month:monthKey(),active:[...state.monthlyChallenges,...state.customGameGoals].filter(x=>!x.completedAt).slice(0,12).map(x=>({title:x.title,metric:x.metric,target:x.target,current:challengeProgress(x),difficulty:x.difficulty}))}}
  function syncExperience(){ensureState();ensureMonthlyChallenges();evaluateChallenges();syncHealthContext();syncGoalContext()}
  ensureState();syncExperience();

  const baseSave=save;
  save=function(){syncExperience();baseSave()};
  baseSave();

  function feedbackLabels(v,type){
    const n=Number(v);
    if(type==='fatigue')return n<=3?'Pouco cansado':n<=6?'Cansaço moderado':n<=8?'Bem cansado':'Muito cansado';
    if(type==='effort')return n<=3?'Esforço leve':n<=6?'Bom esforço':n<=8?'Esforço alto':'Esforço máximo';
    return n<=3?'Leve':n<=6?'Moderada':n<=8?'Intensa':'Muito intensa';
  }
  function feedbackCard(s,{run=false}={}){
    const f=s.sessionFeedback||{intensity:6,fatigue:5,effort:7,notes:''};
    const ranges=[['intensity','Intensidade do treino',f.intensity],['fatigue','Quanto cansado você ficou',f.fatigue],['effort','Quanto esforço você fez',f.effort]];
    return `<div class="card vf-session-feedback" data-feedback-session="${s.id}" data-feedback-run="${run?'1':'0'}"><div class="card-head"><div><span class="eyebrow">COMO FOI O TREINO?</span><h3>Seu feedback melhora os próximos ajustes.</h3><p>A AION e seu personal usarão essa percepção junto com os dados do treino.</p></div></div>${ranges.map(([k,l,v])=>`<label class="vf-feedback-range"><div><strong>${l}</strong><span data-feedback-label="${k}">${feedbackLabels(v,k)}</span></div><input type="range" min="1" max="10" value="${v}" data-feedback-range="${k}"><div class="vf-range-scale"><small>1</small><b>${v}/10</b><small>10</small></div></label>`).join('')}<label class="vf-feedback-notes"><strong>Observações</strong><textarea rows="3" data-feedback-notes placeholder="Dor, exercício desconfortável, energia, algo que queira contar ao personal…">${safe(f.notes||'')}</textarea></label><div class="dialog-actions"><button class="btn ghost" data-feedback-skip>Agora não</button><button class="btn primary" data-feedback-save>Salvar feedback e concluir</button></div></div>`;
  }
  function bindFeedback(root,s,closeFn){
    if(!root)return;
    root.querySelectorAll('[data-feedback-range]').forEach(inp=>inp.addEventListener('input',()=>{
      const label=root.querySelector(`[data-feedback-label="${inp.dataset.feedbackRange}"]`);if(label)label.textContent=feedbackLabels(inp.value,inp.dataset.feedbackRange);
      const value=inp.closest('.vf-feedback-range')?.querySelector('.vf-range-scale b');if(value)value.textContent=`${inp.value}/10`;
    }));
    root.querySelector('[data-feedback-save]')?.addEventListener('click',()=>{
      const target=(state.sessions||[]).find(x=>String(x.id)===String(s.id))||(state.runSessions||[]).find(x=>String(x.id)===String(s.id));
      if(target){target.sessionFeedback={intensity:Number(root.querySelector('[data-feedback-range="intensity"]')?.value||0),fatigue:Number(root.querySelector('[data-feedback-range="fatigue"]')?.value||0),effort:Number(root.querySelector('[data-feedback-range="effort"]')?.value||0),notes:String(root.querySelector('[data-feedback-notes]')?.value||'').trim().slice(0,800),createdAt:new Date().toISOString()};save()}
      closeFn();toast('Feedback salvo. AION e personal receberão esse contexto.');
    });
    root.querySelector('[data-feedback-skip]')?.addEventListener('click',closeFn);
  }
  const baseShowSummary=showSummary;
  showSummary=function(s){
    baseShowSummary(s);const box=document.getElementById('summaryContent');if(!box)return;
    box.querySelector('.dialog-actions')?.remove();box.insertAdjacentHTML('beforeend',feedbackCard(s));
    bindFeedback(box.querySelector('.vf-session-feedback'),s,()=>document.getElementById('summaryDialog').close());
  };
  if(typeof startRun==='function'){
    const baseStartRun=startRun;
    startRun=async function(item){
      const before=(state.runSessions||[]).length;const out=await baseStartRun(item);
      if((state.runSessions||[]).length>before){
        const s=state.runSessions.at(-1),d=document.getElementById('summaryDialog'),box=document.getElementById('summaryContent');
        if(d&&box){box.innerHTML=`<div class="summary-wrap"><div class="summary-hero"><span class="eyebrow">CORRIDA CONCLUÍDA</span><h2>${safe(s.name||'Corrida')}</h2><p style="color:#bbb">${safe(s.pace||'')} ${s.distance?`• ${Number(s.distance).toFixed(1)} km`:''}</p></div>${feedbackCard(s,{run:true})}</div>`;d.showModal();bindFeedback(box.querySelector('.vf-session-feedback'),s,()=>d.close())}
      }
      return out;
    };
  }

  function healthView(){
    const active=state.healthRecords.filter(x=>x.status!=='resolved');
    const history=state.healthRecords.filter(x=>x.status==='resolved');
    return `<section class="vf-experience-page"><div class="workout-hero"><div><span class="eyebrow">SAÚDE E LIMITAÇÕES</span><h1>Treino consciente do seu contexto.</h1><p>Registre restrições e orientações que precisam ser consideradas pelo personal e pela AION.</p></div><button class="btn primary" data-health-add>+ Registrar</button></div><div class="grid two"><div class="card"><div class="card-head"><div><h2>Registros ativos</h2><p>${active.length} ponto(s) para considerar no planejamento</p></div></div>${active.length?active.map(healthRow).join(''):'<div class="coach-chart-empty">Nenhuma limitação ativa registrada.</div>'}</div><div class="card"><h2>Como a AION usa isso</h2><p class="vf-health-copy">Esses dados entram no contexto da IA para tornar sugestões mais conservadoras, evitar movimentos marcados por você e respeitar orientações profissionais cadastradas.</p><div class="vf-health-warning"><strong>Segurança primeiro</strong><span>A AION não diagnostica nem trata lesões. Dor aguda, piora importante, perda de força/sensibilidade ou outros sintomas relevantes precisam de avaliação profissional.</span></div></div></div>${history.length?`<div class="card" style="margin-top:18px"><div class="card-head"><div><h2>Histórico</h2><p>Registros resolvidos permanecem disponíveis.</p></div></div>${history.slice().reverse().map(healthRow).join('')}</div>`:''}</section>`;
  }
  function healthRow(r){return `<article class="vf-health-item"><div class="vf-health-head"><div><strong>${safe(r.area||'Registro')}</strong><small>${r.type==='limitation'?'Limitação':'Lesão'} • ${r.status==='recovering'?'Em recuperação':r.status==='resolved'?'Resolvida':'Ativa'} • nível ${r.severity||1}/5</small></div>${r.status!=='resolved'?`<button class="btn ghost compact" data-health-resolve="${r.id}">Marcar resolvida</button>`:'<span class="pill">HISTÓRICO</span>'}</div>${r.avoid?`<p><b>Evitar / limitar:</b> ${safe(r.avoid)}</p>`:''}${r.guidance?`<p><b>Orientação profissional:</b> ${safe(r.guidance)}</p>`:''}${r.notes?`<p>${safe(r.notes)}</p>`:''}</article>`}
  function healthModal(){
    const d=document.createElement('dialog');d.className='dialog vf-health-dialog';
    d.innerHTML=`<form method="dialog" id="vfHealthForm"><span class="eyebrow">NOVO REGISTRO</span><h2>Lesão ou limitação</h2><div class="field-row"><label>Tipo<select name="type"><option value="injury">Lesão</option><option value="limitation">Limitação</option></select></label><label>Região / condição<input name="area" required maxlength="80" placeholder="Ex.: joelho direito"></label></div><div class="field-row"><label>Status<select name="status"><option value="active">Ativa</option><option value="recovering">Em recuperação</option><option value="resolved">Resolvida</option></select></label><label>Nível de atenção (1–5)<input name="severity" type="range" min="1" max="5" value="3"></label></div><label>Movimentos / situações a evitar ou limitar<textarea name="avoid" rows="2" maxlength="500" placeholder="Ex.: impacto, agachamento profundo, corrida em descida…"></textarea></label><label>Orientação de fisioterapeuta/médico/profissional, se houver<textarea name="guidance" rows="2" maxlength="500"></textarea></label><label>Observações<textarea name="notes" rows="3" maxlength="800"></textarea></label><div class="dialog-actions"><button type="button" class="btn ghost" data-health-cancel>Cancelar</button><button class="btn primary" type="submit">Salvar registro</button></div></form>`;
    document.body.appendChild(d);d.showModal();
    d.querySelector('[data-health-cancel]').onclick=()=>{d.close();d.remove()};
    d.querySelector('form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);state.healthRecords.push({id:uid('health'),type:f.get('type'),area:String(f.get('area')||'').trim(),status:f.get('status'),severity:Number(f.get('severity'))||1,avoid:String(f.get('avoid')||'').trim(),guidance:String(f.get('guidance')||'').trim(),notes:String(f.get('notes')||'').trim(),createdAt:new Date().toISOString()});state.healthRecords=state.healthRecords.slice(-40);save();d.close();d.remove();render();toast('Registro salvo e incluído no contexto da AION.')};
  }

  function medalSvg(kind='star',difficulty=1){
    const d=clamp(difficulty,1,4);
    const symbol={run:'➤',strength:'◆',calendar:'✓',mind:'◎',flame:'✦',star:'★',manual:'★'}[kind]||'★';
    const shapes={run:'50,5 68,30 96,34 75,55 82,86 50,72 18,86 25,55 4,34 32,30',strength:'50,5 82,22 93,56 70,88 30,88 7,56 18,22',calendar:'50,7 80,20 93,50 80,80 50,93 20,80 7,50 20,20',mind:'50,5 75,16 92,40 86,70 62,92 38,92 14,70 8,40 25,16',flame:'50,4 64,25 91,26 75,50 91,77 62,72 50,96 38,72 9,77 25,50 9,26 36,25',manual:'50,4 61,33 92,25 75,50 94,74 63,68 50,96 37,68 6,74 25,50 8,25 39,33',star:'50,4 61,33 92,25 75,50 94,74 63,68 50,96 37,68 6,74 25,50 8,25 39,33'};
    const normal='50,8 78,22 92,50 78,78 50,92 22,78 8,50 22,22';
    const points=d>=3?(shapes[kind]||shapes.star):normal;
    return `<svg viewBox="0 0 100 118" aria-hidden="true"><path d="M31 75 L20 116 49 101 50 75Z" class="rib a"/><path d="M69 75 L80 116 51 101 50 75Z" class="rib b"/><polygon points="${points}" class="medal-shape"/><circle cx="50" cy="50" r="${d>=3?30:25}" class="medal-ring"/><text x="50" y="59" text-anchor="middle" class="medal-symbol">${symbol}</text>${d>=3?'<circle cx="50" cy="50" r="37" class="medal-dots"/>':''}${d===4?'<circle cx="50" cy="50" r="43" class="medal-legend"/>':''}</svg>`;
  }
  function goalCard(c,custom=false){
    const current=challengeProgress(c),target=Number(c.target)||1,pct=Math.min(100,Math.round(current/target*100)),done=!!c.completedAt;
    return `<article class="vf-goal-card ${done?'done':''}"><div class="vf-goal-medal tier-${c.difficulty||1} ${done?'earned':'locked'}">${medalSvg(c.medalKind||c.metric,c.difficulty||1)}</div><div class="vf-goal-copy"><span>${difficultyName(c.difficulty||1)}</span><h3>${safe(c.title)}</h3><p>${safe(c.description||metricLabel(c.metric))}</p><div class="vf-goal-progress"><i style="width:${pct}%"></i></div><small>${c.metric==='manual'?(done?'Concluída':'Marque quando concluir'):`${Number(current).toFixed(c.metric==='runKm'?1:0)}${targetUnit(c.metric)} / ${target}${targetUnit(c.metric)} • ${pct}%`}</small>${custom&&c.metric==='manual'&&!done?`<button class="btn primary compact" data-goal-complete="${c.id}">Concluir meta</button>`:''}</div></article>`;
  }
  function achievementsView(){
    evaluateChallenges();
    const earned=state.medalHall.slice().reverse();
    const hallHtml=earned.length
      ? `<div class="vf-medal-grid">${earned.map(m=>`<article class="vf-medal tier-${m.difficulty}">${medalSvg(m.kind,m.difficulty)}<strong>${safe(m.title)}</strong><small>${difficultyName(m.difficulty)} • ${new Date(m.earnedAt).toLocaleDateString('pt-BR')}</small></article>`).join('')}</div>`
      : `<div class="vf-empty-hall"><div class="vf-goal-medal tier-3 locked">${medalSvg('star',3)}</div><strong>Sua primeira medalha está esperando.</strong><span>Complete um desafio do mês para iniciar sua coleção.</span></div>`;
    return `<section class="vf-experience-page"><div class="vf-game-hero"><div><span class="eyebrow">METAS & CONQUISTAS</span><h1>Seu mês virou uma jornada.</h1><p>Cumpra desafios, crie metas próprias e monte seu Hall de Medalhas.</p></div><div class="vf-game-level"><small>MEDALHAS</small><strong>${earned.length}</strong><span>${earned.filter(x=>x.difficulty>=3).length} raras</span></div></div><div class="card"><div class="card-head"><div><h2>Desafios de ${new Date().toLocaleDateString('pt-BR',{month:'long'})}</h2><p>O sistema cria desafios compatíveis com sua modalidade e rotina.</p></div><button class="btn primary compact" data-goal-add>+ Criar minha meta</button></div><div class="vf-goal-grid">${state.monthlyChallenges.map(c=>goalCard(c)).join('')}${state.customGameGoals.filter(x=>!x.completedAt).map(c=>goalCard(c,true)).join('')}</div></div><div class="card vf-medal-hall" style="margin-top:18px"><div class="card-head"><div><span class="eyebrow">HALL DE MEDALHAS</span><h2>Sua coleção</h2><p>Desafios mais difíceis geram medalhas maiores e mais detalhadas.</p></div></div>${hallHtml}</div></section>`;
  }
  function goalModal(){
    const d=document.createElement('dialog');d.className='dialog vf-health-dialog';
    d.innerHTML=`<form id="vfGoalForm"><span class="eyebrow">NOVA META</span><h2>Crie seu próprio desafio</h2><label>Nome da meta<input name="title" required maxlength="70" placeholder="Ex.: completar 12 treinos"></label><div class="field-row"><label>Medir por<select name="metric"><option value="sessions">Treinos concluídos</option><option value="strengthSessions">Treinos de força</option><option value="runSessions">Corridas</option><option value="runKm">Km de corrida</option><option value="activeMinutes">Minutos ativos</option><option value="feedbacks">Feedbacks pós-treino</option><option value="manual">Meta livre / manual</option></select></label><label>Meta<input name="target" type="number" min="1" step="1" value="8"></label></div><label>Dificuldade<select name="difficulty"><option value="1">Bronze</option><option value="2" selected>Prata</option><option value="3">Ouro</option><option value="4">Lendária</option></select></label><label>Descrição<input name="description" maxlength="140" placeholder="O que você quer conquistar?"></label><div class="dialog-actions"><button type="button" class="btn ghost" data-goal-cancel>Cancelar</button><button class="btn primary">Criar desafio</button></div></form>`;
    document.body.appendChild(d);d.showModal();d.querySelector('[data-goal-cancel]').onclick=()=>{d.close();d.remove()};
    d.querySelector('form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget),metric=f.get('metric');state.customGameGoals.push({id:uid('goal'),title:String(f.get('title')||'').trim(),description:String(f.get('description')||'').trim(),metric,target:metric==='manual'?1:Math.max(1,Number(f.get('target'))||1),difficulty:clamp(f.get('difficulty'),1,4),medalKind:metric==='runKm'||metric==='runSessions'?'run':metric==='strengthSessions'?'strength':metric==='activeMinutes'?'flame':metric==='feedbacks'?'mind':'manual',createdAt:new Date().toISOString()});save();d.close();d.remove();render();toast('Meta criada. Boa jornada!')};
  }

  // Lesões e conquistas são páginas principais; o Perfil contém apenas dados pessoais.
  window.VazExperienceViews={
    renderHealth(){syncExperience();return healthView()},
    renderAchievements(){syncExperience();return achievementsView()}
  };

  const baseContext=buildAionContext;
  buildAionContext=function(){
    const ctx=baseContext();syncExperience();ctx.healthContext=state.profile.healthContext||{};
    ctx.recentWorkoutFeedback=[...(state.sessions||[]),...(state.runSessions||[])].slice(-10).map(s=>({date:s.date,name:s.name,feedback:s.sessionFeedback||null})).filter(x=>x.feedback);
    ctx.gameGoals=state.goals.gamification||{};return ctx;
  };

  const baseBind=bindDynamic;
  bindDynamic=function(){
    baseBind();
    document.querySelector('[data-health-add]')?.addEventListener('click',healthModal);
    document.querySelectorAll('[data-health-resolve]').forEach(b=>b.onclick=()=>{const r=state.healthRecords.find(x=>x.id===b.dataset.healthResolve);if(r){r.status='resolved';r.resolvedAt=new Date().toISOString();save();render();toast('Registro movido para o histórico.')}});
    document.querySelector('[data-goal-add]')?.addEventListener('click',goalModal);
    document.querySelectorAll('[data-goal-complete]').forEach(b=>b.onclick=()=>{const g=state.customGameGoals.find(x=>x.id===b.dataset.goalComplete);if(g&&!g.completedAt){g.completedAt=new Date().toISOString();if(!state.medalHall.some(m=>m.challengeId===g.id))state.medalHall.push(medalFor(g));save();render();toast('🏅 Meta concluída! Nova medalha adicionada ao Hall.')}});
  };

  const style=document.createElement('style');style.textContent=`
    .vf-session-feedback{margin-top:14px;background:#fff}.vf-feedback-range{display:block;border-top:1px solid var(--line);padding:14px 0}.vf-feedback-range>div:first-child{display:flex;justify-content:space-between;gap:10px}.vf-feedback-range span{font-size:11px;color:var(--muted)}.vf-feedback-range input{width:100%;accent-color:var(--yellow);margin:12px 0 4px}.vf-range-scale{display:flex;justify-content:space-between;align-items:center;color:var(--muted)}.vf-range-scale b{color:#222}.vf-feedback-notes{display:block;margin-top:8px}.vf-feedback-notes strong{display:block;margin-bottom:7px}.vf-feedback-notes textarea{width:100%;border:1px solid var(--line);border-radius:15px;padding:12px;font:inherit;resize:vertical}.vf-experience-tabs{display:flex;gap:7px;overflow:auto;margin-bottom:16px;padding:3px 0;scrollbar-width:none}.vf-experience-tabs button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:10px 14px;font:inherit;font-size:11px;font-weight:850;white-space:nowrap}.vf-experience-tabs button.active{background:#171717;color:#fff;border-color:#171717}.vf-health-copy{color:var(--muted);line-height:1.6}.vf-health-warning{display:flex;flex-direction:column;gap:5px;border:1px solid #f0d889;background:#fff9dc;border-radius:16px;padding:14px}.vf-health-warning span{font-size:11px;line-height:1.5;color:#685912}.vf-health-item{padding:14px 0;border-bottom:1px solid var(--line)}.vf-health-item:last-child{border-bottom:0}.vf-health-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.vf-health-head strong,.vf-health-head small{display:block}.vf-health-head small{color:var(--muted);margin-top:4px}.vf-health-item p{font-size:11px;line-height:1.55;margin:8px 0 0}.vf-health-dialog{width:min(620px,calc(100% - 22px));padding:22px}.vf-health-dialog label{display:block;font-size:11px;font-weight:800;margin-top:10px}.vf-health-dialog input,.vf-health-dialog select,.vf-health-dialog textarea{width:100%;margin-top:5px;border:1px solid var(--line);border-radius:14px;padding:11px;font:inherit}.vf-game-hero{display:flex;justify-content:space-between;gap:18px;background:linear-gradient(135deg,#171717,#2b260f);color:#fff;border-radius:28px;padding:24px;margin-bottom:18px}.vf-game-hero h1{margin:5px 0 8px;font-size:clamp(28px,6vw,46px)}.vf-game-hero p{color:#cfcfcf;max-width:580px}.vf-game-level{min-width:120px;border:1px solid #4b4420;background:#211f16;border-radius:22px;padding:16px;text-align:center}.vf-game-level small,.vf-game-level span{display:block;color:#cbbb61}.vf-game-level strong{display:block;font-size:38px;color:#f5c400}.vf-goal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.vf-goal-card{display:flex;align-items:center;gap:13px;border:1px solid var(--line);border-radius:20px;padding:14px;background:#fff}.vf-goal-card.done{background:#fffdf1;border-color:#ead16c}.vf-goal-copy{flex:1}.vf-goal-copy>span{font-size:9px;font-weight:900;letter-spacing:.1em;color:#887000}.vf-goal-copy h3{margin:3px 0}.vf-goal-copy p,.vf-goal-copy small{font-size:10px;color:var(--muted);line-height:1.4}.vf-goal-progress{height:7px;background:#eee;border-radius:999px;overflow:hidden;margin:9px 0 5px}.vf-goal-progress i{display:block;height:100%;background:linear-gradient(90deg,#c89d00,#f5c400);border-radius:inherit}.vf-goal-medal{flex:0 0 auto}.vf-goal-medal svg,.vf-medal svg{width:100%;height:100%}.vf-goal-medal.tier-1{width:60px;height:72px}.vf-goal-medal.tier-2{width:68px;height:80px}.vf-goal-medal.tier-3{width:78px;height:92px}.vf-goal-medal.tier-4{width:90px;height:106px}.locked{filter:grayscale(1);opacity:.32}.earned{filter:none;opacity:1}.medal-shape{fill:#f5c400;stroke:#7e6500;stroke-width:3}.medal-ring{fill:#fff4b0;stroke:#b89000;stroke-width:3}.medal-symbol{font-size:28px;font-weight:900;fill:#2a2200}.rib.a{fill:#161616}.rib.b{fill:#4a3d00}.medal-dots{fill:none;stroke:#fff2a2;stroke-width:2;stroke-dasharray:2 6}.medal-legend{fill:none;stroke:#f5c400;stroke-width:2;stroke-dasharray:1 4}.vf-medal-grid{display:flex;flex-wrap:wrap;align-items:flex-end;gap:18px;padding:12px 0}.vf-medal{text-align:center}.vf-medal.tier-1{width:82px}.vf-medal.tier-2{width:96px}.vf-medal.tier-3{width:112px}.vf-medal.tier-4{width:132px}.vf-medal strong,.vf-medal small{display:block}.vf-medal strong{font-size:11px}.vf-medal small{font-size:9px;color:var(--muted);margin-top:3px}.vf-empty-hall{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;padding:24px}.vf-empty-hall>span{font-size:11px;color:var(--muted)}@media(max-width:680px){.vf-goal-grid{grid-template-columns:1fr}.vf-game-hero{flex-direction:column}.vf-game-level{display:flex;align-items:center;justify-content:space-between}.vf-game-level strong{font-size:28px}.vf-health-head{flex-direction:column}.vf-medal-grid{justify-content:center}}
  `;document.head.appendChild(style);
})();
