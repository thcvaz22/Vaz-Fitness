// Vaz Fitness v33 — corrida estruturada detalhada e resumo sem mapa esquemático.
(()=>{
  if(window.__VAZ_RUNNING_STRUCTURED_V33__)return;
  window.__VAZ_RUNNING_STRUCTURED_V33__=true;

  const esc=v=>typeof escapeHtml==='function'?escapeHtml(String(v??'')):String(v??'');
  const paceText=v=>{const x=String(v||'').trim();return x?x.replace(/\/km$/i,'')+'/km':'ritmo confortável'};
  const distanceText=(km,m,sec)=>{
    if(Number(m)>0)return Number(m)>=1000?`${(Number(m)/1000).toFixed(Number(m)%1000?1:0)} km`:`${Math.round(Number(m))} m`;
    if(Number(km)>0)return `${Number(km).toFixed(Number(km)<10?1:0)} km`;
    if(Number(sec)>0)return typeof formatRunTime==='function'?formatRunTime(Number(sec)):`${Math.round(Number(sec)/60)} min`;
    return 'conforme orientação';
  };

  window.renderStructuredRunPlan=function(rs,{compact=false}={}){
    if(!rs||typeof rs!=='object')return '';
    const phase=(title,p)=>p&&typeof p==='object'?`<div class="run-v33-phase"><span>${title}</span><strong>${distanceText(p.distanceKm,0,(Number(p.durationMin)||0)*60)}</strong><small>${esc(p.pace?paceText(p.pace):(p.instructions||''))}</small>${p.instructions&&p.pace?`<em>${esc(p.instructions)}</em>`:''}</div>`:'';
    const blocks=Array.isArray(rs.blocks)?rs.blocks:[];
    const blocksHtml=blocks.map((b,i)=>{
      const work=distanceText(0,b.workDistanceM,b.workDurationSec),recovery=distanceText(0,b.recoveryDistanceM,b.recoveryDurationSec),repeat=Math.max(1,Number(b.repeat)||1);
      return `<div class="run-v33-block"><div class="run-v33-order">${i+1}</div><div><strong>${repeat>1?`${repeat}× `:''}${esc(b.label||'Bloco')}</strong><span>Esforço: ${esc(work)} • ${esc(paceText(b.workPace))}</span>${(b.recoveryDistanceM||b.recoveryDurationSec||b.recoveryPace)?`<span>Recuperação: ${esc(recovery)} • ${esc(paceText(b.recoveryPace||'leve'))}</span>`:''}${b.instructions?`<small>${esc(b.instructions)}</small>`:''}</div></div>`;
    }).join('');
    const typeNames={easy:'Leve',recovery:'Recuperação',long:'Longão',tempo:'Tempo',progressive:'Progressivo',intervals:'Intervalado',sprints:'Tiros',fartlek:'Fartlek'};
    return `<section class="run-v33-card ${compact?'compact':''}"><div class="run-v33-head"><div><span class="eyebrow">ESTRUTURA DA CORRIDA</span><h3>${esc(typeNames[rs.workoutType]||rs.workoutType||'Treino estruturado')}</h3></div>${rs.targetRpe?`<b>RPE ${Math.max(1,Math.min(10,Number(rs.targetRpe)||1))}/10</b>`:''}</div>${phase('Aquecimento',rs.warmup)}${blocksHtml?`<div class="run-v33-blocks">${blocksHtml}</div>`:''}${phase('Volta à calma',rs.cooldown)}${rs.estimatedTotalKm?`<div class="run-v33-total"><span>Distância estimada</span><strong>~${Number(rs.estimatedTotalKm).toFixed(1)} km</strong></div>`:''}${rs.notes?`<p class="run-v33-notes">${esc(rs.notes)}</p>`:''}</section>`;
  };

  if(typeof startRun==='function'){
    const previousStartRun=startRun;
    startRun=function(item){
      previousStartRun(item);
      if(state.currentRun){
        state.currentRun.plannedStructure=item?.runStructure?JSON.parse(JSON.stringify(item.runStructure)):null;
        save();
      }
    };
  }

  if(typeof renderRunLive==='function'){
    const previousRenderRunLive=renderRunLive;
    renderRunLive=function(){
      let html=previousRenderRunLive(),r=state.currentRun;
      if(!r?.plannedStructure)return html;
      const detail=window.renderStructuredRunPlan(r.plannedStructure);
      return html.replace('<div class="run-dashboard-card">',detail+'<div class="run-dashboard-card">');
    };
  }

  if(typeof finishRunSession==='function'){
    const previousFinishRunSession=finishRunSession;
    finishRunSession=function(){
      const structure=state.currentRun?.plannedStructure?JSON.parse(JSON.stringify(state.currentRun.plannedStructure)):null;
      previousFinishRunSession();
      const last=state.runSessions?.at(-1);
      if(last&&structure){last.plannedStructure=structure;save();}
    };
  }

  if(typeof showRunSummary==='function'){
    const previousShowRunSummary=showRunSummary;
    showRunSummary=function(session){
      previousShowRunSummary(session);
      requestAnimationFrame(()=>{
        document.querySelectorAll('.run-summary-plus .card').forEach(card=>{
          const title=card.querySelector('h3')?.textContent?.trim();
          if(title==='Trajeto da corrida')card.remove();
        });
        const host=document.querySelector('.run-summary-plus');
        if(host&&session?.plannedStructure&&!host.querySelector('.run-v33-card')){
          host.insertAdjacentHTML('afterbegin',window.renderStructuredRunPlan(session.plannedStructure,{compact:true}));
        }
      });
    };
  }

  const style=document.createElement('style');
  style.textContent=`
    .run-v33-card{background:#fff;border:1px solid var(--line);border-radius:24px;padding:18px;margin:0 0 14px;color:var(--text);box-shadow:var(--shadow)}
    .run-v33-card.compact{box-shadow:none;margin:0 0 12px}
    .run-v33-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}
    .run-v33-head h3{margin:4px 0 0}.run-v33-head>b{background:#171717;color:#fff;border-radius:999px;padding:7px 10px;font-size:10px;white-space:nowrap}
    .run-v33-phase{display:grid;grid-template-columns:100px 105px minmax(0,1fr);gap:9px;align-items:center;padding:10px 0;border-top:1px solid var(--line)}
    .run-v33-phase>span{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
    .run-v33-phase>strong{font-size:13px}.run-v33-phase>small{font-size:11px;color:var(--muted)}.run-v33-phase>em{grid-column:3;font-style:normal;font-size:10px;color:var(--muted)}
    .run-v33-blocks{display:grid;gap:8px;margin:8px 0}.run-v33-block{display:grid;grid-template-columns:30px minmax(0,1fr);gap:9px;background:#fafafa;border:1px solid var(--line);border-radius:15px;padding:10px}
    .run-v33-order{width:28px;height:28px;border-radius:10px;background:var(--yellow);display:grid;place-items:center;font-weight:900;font-size:11px;color:#171717}
    .run-v33-block strong,.run-v33-block span,.run-v33-block small{display:block}.run-v33-block span{font-size:11px;margin-top:4px}.run-v33-block small{color:var(--muted);font-size:10px;line-height:1.45;margin-top:4px}
    .run-v33-total{display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line);padding-top:10px;margin-top:8px;font-size:11px}.run-v33-notes{margin:9px 0 0;color:var(--muted);font-size:10px;line-height:1.5}
    @media(max-width:700px){.run-v33-phase{grid-template-columns:1fr 1fr}.run-v33-phase>small,.run-v33-phase>em{grid-column:1/-1}}
  `;
  document.head.appendChild(style);
})();