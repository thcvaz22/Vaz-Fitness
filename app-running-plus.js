// Vaz Fitness — Running Plus: splits, alertas e visual do trajeto GPS.
(function installRunningPlus(){
  state.runSettings=state.runSettings||{audioCues:true,vibration:true};
  save();

  function routeSvg(route){
    const pts=(route||[]).filter(p=>Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng)));
    if(pts.length<2)return '<div class="route-empty">Trajeto GPS indisponível para esta atividade.</div>';
    const lats=pts.map(p=>Number(p.lat)),lngs=pts.map(p=>Number(p.lng));
    const minLat=Math.min(...lats),maxLat=Math.max(...lats),minLng=Math.min(...lngs),maxLng=Math.max(...lngs);
    const latSpan=Math.max(0.000001,maxLat-minLat),lngSpan=Math.max(0.000001,maxLng-minLng);
    const w=360,h=190,pad=18;
    const mapped=pts.map(p=>{
      const x=pad+(Number(p.lng)-minLng)/lngSpan*(w-pad*2);
      const y=h-pad-(Number(p.lat)-minLat)/latSpan*(h-pad*2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const start=mapped[0].split(','),end=mapped.at(-1).split(',');
    return `<div class="route-visual"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Trajeto GPS da corrida"><polyline points="${mapped.join(' ')}" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${start[0]}" cy="${start[1]}" r="7" class="route-start"/><circle cx="${end[0]}" cy="${end[1]}" r="7" class="route-end"/></svg><div class="route-legend"><span><i class="start"></i>Início</span><span><i class="end"></i>Fim</span><small>Trajeto GPS • visualização esquemática</small></div></div>`;
  }
  function cueText(split){return `Quilômetro ${split.km}. Pace ${String(split.pace).replace(':',' minutos e ')} segundos por quilômetro.`;}
  function notifySplit(split){
    if(state.runSettings.vibration&&navigator.vibrate)try{navigator.vibrate([180,80,180]);}catch{}
    if(state.runSettings.audioCues&&'speechSynthesis' in window){
      try{window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(cueText(split));u.lang='pt-BR';u.rate=1.02;window.speechSynthesis.speak(u);}catch{}
    }
    toast(`Km ${split.km}: ${split.pace}/km`);
  }

  const baseBeginRunTracking=beginRunTracking;
  beginRunTracking=function(){baseBeginRunTracking();if(state.currentRun){state.currentRun.splits=[];state.currentRun.lastSplitSec=0;save();}};

  const baseUpdateRunMetrics=updateRunMetrics;
  updateRunMetrics=function(){
    baseUpdateRunMetrics();
    const r=state.currentRun;if(!r||r.status!=='running')return;
    r.splits=Array.isArray(r.splits)?r.splits:[];
    let nextKm=r.splits.length+1;
    while(Number(r.distanceKm||0)>=nextKm){
      const cumulative=Math.max(1,Number(r.elapsedSec)||1),previous=r.splits.at(-1)?.cumulativeSec||0;
      const splitSec=Math.max(1,cumulative-previous);
      const split={km:nextKm,splitSec,cumulativeSec:cumulative,pace:formatRunPace(splitSec)};
      r.splits.push(split);r.lastSplitSec=cumulative;save();notifySplit(split);nextKm++;
    }
  };

  const baseRenderRunLive=renderRunLive;
  renderRunLive=function(){
    let html=baseRenderRunLive();const r=state.currentRun;if(!r)return html;
    const splits=r.splits||[];
    if(splits.length){
      const block=`<div class="run-splits-live"><div class="run-splits-head"><strong>Splits</strong><span>por quilômetro</span></div>${splits.slice(-5).reverse().map(s=>`<div class="run-split-row"><span>KM ${s.km}</span><strong>${s.pace}/km</strong><small>${formatRunTime(s.cumulativeSec)}</small></div>`).join('')}</div>`;
      html=html.replace('</div>\n  </section>',`${block}</div>\n  </section>`);
    }
    return html;
  };

  let pendingSplits=null;
  const baseFinishRunSession=finishRunSession;
  finishRunSession=function(){pendingSplits=(state.currentRun?.splits||[]).map(x=>({...x}));baseFinishRunSession();const s=state.runSessions.at(-1);if(s&&pendingSplits){s.splits=pendingSplits;save();}pendingSplits=null;};

  const baseShowRunSummary=showRunSummary;
  showRunSummary=function(s){
    if(pendingSplits?.length&&!s.splits)s.splits=pendingSplits;
    baseShowRunSummary(s);
    const content=document.getElementById('summaryContent');if(!content)return;
    const actions=content.querySelector('.dialog-actions');
    const extras=document.createElement('div');extras.className='run-summary-plus';
    extras.innerHTML=`${s.splits?.length?`<div class="card"><div class="card-head"><div><h3>Splits por quilômetro</h3><p>Ritmo de cada quilômetro completo</p></div></div><div class="summary-splits">${s.splits.map(x=>`<div><span>KM ${x.km}</span><strong>${x.pace}/km</strong><small>${formatRunTime(x.splitSec)}</small></div>`).join('')}</div></div>`:''}<div class="card"><div class="card-head"><div><h3>Trajeto da corrida</h3><p>Desenho do caminho gravado pelo GPS</p></div></div>${routeSvg(s.route)}</div>`;
    if(actions)actions.before(extras);else content.appendChild(extras);
  };

  const baseRenderProfile=renderProfile;
  renderProfile=function(){
    const html=baseRenderProfile();
    const card=`<div class="card"><div class="card-head"><div><h2>Alertas da corrida</h2><p>Feedback durante atividades registradas pelo Vaz Fitness</p></div></div><div class="run-setting-list"><label><span><strong>Áudio por quilômetro</strong><small>Anuncia o split e o pace ao completar cada km.</small></span><input type="checkbox" data-run-setting="audioCues" ${state.runSettings.audioCues?'checked':''}></label><label><span><strong>Vibração por quilômetro</strong><small>Vibra quando um novo split é registrado.</small></span><input type="checkbox" data-run-setting="vibration" ${state.runSettings.vibration?'checked':''}></label></div></div>`;
    return html.replace(/<\/section>\s*$/,`${card}</section>`);
  };

  const previousBindDynamic=bindDynamic;
  bindDynamic=function(){previousBindDynamic();document.querySelectorAll('[data-run-setting]').forEach(input=>input.addEventListener('change',()=>{state.runSettings[input.dataset.runSetting]=input.checked;save();toast('Preferência de corrida atualizada.');}));};

  const style=document.createElement('style');style.textContent=`
    .run-splits-live{margin-top:14px;border-top:1px solid rgba(255,255,255,.1);padding-top:12px}.run-splits-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}.run-splits-head span{font-size:10px;color:var(--muted)}.run-split-row{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:8px 0;border-top:1px solid rgba(255,255,255,.08)}.run-split-row span,.run-split-row small{font-size:10px;color:#aaa}.run-split-row strong{font-size:13px}.run-summary-plus{display:flex;flex-direction:column;gap:14px;margin-top:14px}.summary-splits{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.summary-splits>div{padding:11px;border:1px solid var(--line);border-radius:14px;background:#fafafa}.summary-splits span,.summary-splits small{display:block;font-size:9px;color:var(--muted)}.summary-splits strong{display:block;margin:3px 0}.route-visual{color:#d6ad00}.route-visual svg{display:block;width:100%;height:auto;background:linear-gradient(135deg,#fafafa,#f2f2f2);border:1px solid var(--line);border-radius:18px}.route-start{fill:#2fa85d}.route-end{fill:#e0524d}.route-legend{display:flex;flex-wrap:wrap;align-items:center;gap:11px;margin-top:8px;font-size:9px;color:var(--muted)}.route-legend span{display:flex;align-items:center;gap:5px}.route-legend i{width:8px;height:8px;border-radius:50%}.route-legend i.start{background:#2fa85d}.route-legend i.end{background:#e0524d}.route-legend small{margin-left:auto}.route-empty{padding:24px 10px;text-align:center;color:var(--muted);font-size:11px}.run-setting-list{display:flex;flex-direction:column;gap:9px}.run-setting-list label{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:13px;border:1px solid var(--line);border-radius:15px}.run-setting-list strong,.run-setting-list small{display:block}.run-setting-list small{color:var(--muted);font-size:10px;margin-top:3px}.run-setting-list input{width:22px;height:22px}@media(max-width:560px){.summary-splits{grid-template-columns:1fr 1fr}.route-legend small{width:100%;margin-left:0}}
  `;document.head.appendChild(style);
})();
