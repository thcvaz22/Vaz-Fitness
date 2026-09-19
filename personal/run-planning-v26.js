// Vaz Personal v26 — detalhamento profissional dos treinos de corrida.
(()=>{
  if(window.__VAZ_RUN_PLANNING_V26__)return;
  window.__VAZ_RUN_PLANNING_V26__=true;

  const DRAFT_PREFIX='vazPersonal.studentPlanDraft.v25.';
  const typeLabels={easy:'Leve',recovery:'Recuperação',long:'Longão',tempo:'Tempo',progressive:'Progressivo',intervals:'Intervalado',sprints:'Tiros',fartlek:'Fartlek'};
  let modal=null,editingIndex=-1,working=null;

  const clone=v=>JSON.parse(JSON.stringify(v));
  const esc=v=>safe(v==null?'':String(v));
  const athleteId=()=>selected?.athlete?.id||'';
  const draftKey=()=>DRAFT_PREFIX+athleteId();

  function getDraft(){
    const base={athleteId:athleteId(),baseVersion:Number(selected?.plan?.plan_version)||0,plan:clone(Array.isArray(selected?.plan?.plan)?selected.plan.plan:[]),notes:selected?.plan?.notes||'',cycleDays:Number(selectedOps?.cycle?.days)||30,dirty:false,source:'current',updatedAt:Date.now()};
    try{
      const saved=JSON.parse(localStorage.getItem(draftKey())||'null');
      if(saved&&saved.athleteId===base.athleteId&&Number(saved.baseVersion)===base.baseVersion&&Array.isArray(saved.plan))return {...base,...saved,plan:clone(saved.plan)};
    }catch{}
    return base;
  }
  function saveDraft(d){
    d.updatedAt=Date.now();d.dirty=true;
    localStorage.setItem(draftKey(),JSON.stringify(d));
    selected.plan={...(selected.plan||{}),plan:clone(d.plan),notes:d.notes};
    aiDraft=d.source==='aion';
  }
  function blankStructure(){
    return {workoutType:'intervals',targetRpe:7,estimatedTotalKm:0,notes:'',warmup:{durationMin:10,distanceKm:0,pace:'leve',instructions:'Comece confortável e aumente gradualmente.'},blocks:[{order:1,label:'Bloco principal',repeat:4,workDistanceM:400,workDurationSec:0,workPace:'',recoveryDistanceM:200,recoveryDurationSec:0,recoveryPace:'leve',instructions:'Mantenha técnica estável e controle o esforço.'}],cooldown:{durationMin:8,distanceKm:0,pace:'leve',instructions:'Reduza o ritmo progressivamente até normalizar a respiração.'}};
  }
  function phaseLine(title,p){
    if(!p)return '';
    const amount=Number(p.distanceKm)>0?`${Number(p.distanceKm).toFixed(1)} km`:Number(p.durationMin)>0?`${Number(p.durationMin)} min`:'—';
    return `<div class="vp-run-v26-phase"><span>${title}</span><strong>${amount}</strong><small>${esc(p.pace||p.instructions||'')}</small></div>`;
  }
  function detailHtml(rs,index){
    if(!rs)return `<div class="vp-run-v26-empty"><span>Corrida sem estrutura detalhada.</span><button class="vp-btn ghost compact" data-edit-run-v26="${index}">Detalhar corrida</button></div>`;
    const blocks=Array.isArray(rs.blocks)?rs.blocks:[];
    return `<div class="vp-run-v26-detail">
      <div class="vp-run-v26-title"><div><b>${esc(typeLabels[rs.workoutType]||rs.workoutType||'Corrida estruturada')}</b><small>${rs.targetRpe?`RPE ${Number(rs.targetRpe)}/10`:''}${rs.estimatedTotalKm?` • ~${Number(rs.estimatedTotalKm).toFixed(1)} km`:''}</small></div><button class="vp-btn ghost compact" data-edit-run-v26="${index}">Editar estrutura</button></div>
      ${phaseLine('Aquecimento',rs.warmup)}
      <div class="vp-run-v26-blocks">${blocks.map((b,i)=>`<div><span>${i+1}</span><p><strong>${Math.max(1,Number(b.repeat)||1)}× ${esc(b.label||'Bloco')}</strong><small>Esforço: ${Number(b.workDistanceM)>0?`${Number(b.workDistanceM)} m`:Number(b.workDurationSec)>0?`${Number(b.workDurationSec)} s`:'—'} ${b.workPace?`• ${esc(b.workPace)}/km`:''}<br>Recuperação: ${Number(b.recoveryDistanceM)>0?`${Number(b.recoveryDistanceM)} m`:Number(b.recoveryDurationSec)>0?`${Number(b.recoveryDurationSec)} s`:'—'} ${b.recoveryPace?`• ${esc(b.recoveryPace)}`:''}</small></p></div>`).join('')}</div>
      ${phaseLine('Volta à calma',rs.cooldown)}
      ${rs.notes?`<p class="vp-run-v26-note">${esc(rs.notes)}</p>`:''}
    </div>`;
  }

  const previousRenderClientPlan=renderClientPlan;
  renderClientPlan=function(){
    const html=previousRenderClientPlan(),draft=getDraft(),host=document.createElement('div');host.innerHTML=html;
    host.querySelectorAll('.vp-plan-preview-day').forEach(card=>{
      const btn=card.querySelector('[data-edit-student-day]'),index=Number(btn?.dataset.editStudentDay);
      const day=draft.plan?.[index];
      if(day?.type==='run'&&!card.querySelector('.vp-run-v26-detail,.vp-run-v26-empty')){
        card.insertAdjacentHTML('beforeend',detailHtml(day.runStructure,index));
      }
    });
    return host.innerHTML;
  };

  function phaseEditor(name,label,p={}){
    return `<section class="vp-card compact vp-run-v26-phase-edit"><h3>${label}</h3><div class="vp-form-grid">
      <div class="vp-field"><label>Tempo (min)</label><input type="number" min="0" max="180" data-run-phase="${name}" data-run-field="durationMin" value="${Number(p.durationMin)||0}"></div>
      <div class="vp-field"><label>Distância (km)</label><input type="number" min="0" step="0.1" data-run-phase="${name}" data-run-field="distanceKm" value="${Number(p.distanceKm)||0}"></div>
      <div class="vp-field"><label>Pace</label><input data-run-phase="${name}" data-run-field="pace" value="${esc(p.pace||'')}" placeholder="Ex.: 5:30-5:45"></div>
    </div><div class="vp-field" style="margin-top:8px"><label>Orientação</label><input data-run-phase="${name}" data-run-field="instructions" value="${esc(p.instructions||'')}"></div></section>`;
  }
  function blockEditor(b,i){
    return `<section class="vp-card compact vp-run-v26-block" data-run-v26-block="${i}">
      <div class="vp-page-head"><div><h3>Bloco ${i+1}</h3><p>Esforço e recuperação que se repetem.</p></div><button type="button" class="vp-btn danger compact" data-remove-run-block="${i}">Remover</button></div>
      <div class="vp-form-grid">
        <div class="vp-field"><label>Nome</label><input data-run-block-field="label" value="${esc(b.label||'Bloco')}"></div>
        <div class="vp-field"><label>Repetições</label><input type="number" min="1" max="30" data-run-block-field="repeat" value="${Math.max(1,Number(b.repeat)||1)}"></div>
        <div class="vp-field"><label>Esforço (m)</label><input type="number" min="0" max="50000" data-run-block-field="workDistanceM" value="${Number(b.workDistanceM)||0}"></div>
        <div class="vp-field"><label>Esforço (s)</label><input type="number" min="0" max="7200" data-run-block-field="workDurationSec" value="${Number(b.workDurationSec)||0}"></div>
        <div class="vp-field"><label>Pace do esforço</label><input data-run-block-field="workPace" value="${esc(b.workPace||'')}" placeholder="Ex.: 4:10-4:20"></div>
        <div class="vp-field"><label>Recuperação (m)</label><input type="number" min="0" max="10000" data-run-block-field="recoveryDistanceM" value="${Number(b.recoveryDistanceM)||0}"></div>
        <div class="vp-field"><label>Recuperação (s)</label><input type="number" min="0" max="3600" data-run-block-field="recoveryDurationSec" value="${Number(b.recoveryDurationSec)||0}"></div>
        <div class="vp-field"><label>Pace recuperação</label><input data-run-block-field="recoveryPace" value="${esc(b.recoveryPace||'')}" placeholder="leve / 6:00-6:30"></div>
      </div>
      <div class="vp-field" style="margin-top:8px"><label>Orientação do bloco</label><input data-run-block-field="instructions" value="${esc(b.instructions||'')}"></div>
    </section>`;
  }
  function editorHtml(){
    const rs=working;
    return `<div class="vp-page-head vp-run-v26-head"><div><span class="vp-plan-kicker">CORRIDA ESTRUTURADA</span><h2>Detalhar treino de corrida</h2><p>Especifique exatamente o que o aluno deve executar em cada etapa.</p></div><button class="vp-btn ghost" data-close-run-v26>×</button></div>
      <section class="vp-card compact"><div class="vp-form-grid">
        <div class="vp-field"><label>Tipo</label><select id="runV26Type">${Object.entries(typeLabels).map(([v,l])=>`<option value="${v}" ${rs.workoutType===v?'selected':''}>${l}</option>`).join('')}</select></div>
        <div class="vp-field"><label>RPE alvo (1-10)</label><input id="runV26Rpe" type="number" min="1" max="10" value="${Number(rs.targetRpe)||7}"></div>
        <div class="vp-field"><label>Distância total estimada (km)</label><input id="runV26Km" type="number" min="0" step="0.1" value="${Number(rs.estimatedTotalKm)||0}"></div>
      </div></section>
      ${phaseEditor('warmup','Aquecimento',rs.warmup)}
      <div id="runV26Blocks">${(rs.blocks||[]).map(blockEditor).join('')}</div>
      <div class="vp-actions"><button type="button" class="vp-btn ghost" id="addRunV26Block">+ Adicionar bloco</button></div>
      ${phaseEditor('cooldown','Volta à calma',rs.cooldown)}
      <div class="vp-field" style="margin-top:10px"><label>Observações gerais</label><textarea id="runV26Notes" rows="3">${esc(rs.notes||'')}</textarea></div>
      <div class="vp-run-v26-footer"><button class="vp-btn ghost" data-close-run-v26>Cancelar</button><button class="vp-btn primary" id="saveRunV26">Salvar estrutura da corrida</button></div>`;
  }
  function readEditor(){
    const root=modal?.querySelector('.vp-modal');if(!root||!working)return;
    working.workoutType=root.querySelector('#runV26Type')?.value||'intervals';
    working.targetRpe=Math.max(1,Math.min(10,Number(root.querySelector('#runV26Rpe')?.value)||7));
    working.estimatedTotalKm=Math.max(0,Number(root.querySelector('#runV26Km')?.value)||0);
    working.notes=root.querySelector('#runV26Notes')?.value||'';
    for(const phase of ['warmup','cooldown']){
      working[phase]=working[phase]||{};
      root.querySelectorAll(`[data-run-phase="${phase}"]`).forEach(el=>{
        const f=el.dataset.runField;
        working[phase][f]=['durationMin','distanceKm'].includes(f)?Math.max(0,Number(el.value)||0):el.value;
      });
    }
    working.blocks=[...root.querySelectorAll('[data-run-v26-block]')].map((row,i)=>{
      const get=n=>row.querySelector(`[data-run-block-field="${n}"]`)?.value;
      return {order:i+1,label:get('label')||`Bloco ${i+1}`,repeat:Math.max(1,Number(get('repeat'))||1),workDistanceM:Math.max(0,Number(get('workDistanceM'))||0),workDurationSec:Math.max(0,Number(get('workDurationSec'))||0),workPace:get('workPace')||'',recoveryDistanceM:Math.max(0,Number(get('recoveryDistanceM'))||0),recoveryDurationSec:Math.max(0,Number(get('recoveryDurationSec'))||0),recoveryPace:get('recoveryPace')||'',instructions:get('instructions')||''};
    });
  }
  function renderEditor(){const box=modal?.querySelector('.vp-modal');if(!box)return;box.innerHTML=editorHtml();box.classList.add('vp-run-v26-modal');bindEditor()}
  function bindEditor(){
    const root=modal?.querySelector('.vp-modal');if(!root)return;
    root.querySelectorAll('[data-close-run-v26]').forEach(b=>b.onclick=()=>{modal?.remove();modal=null;working=null;editingIndex=-1});
    root.querySelector('#addRunV26Block')?.addEventListener('click',()=>{readEditor();working.blocks.push({order:working.blocks.length+1,label:'Novo bloco',repeat:1,workDistanceM:400,workDurationSec:0,workPace:'',recoveryDistanceM:200,recoveryDurationSec:0,recoveryPace:'leve',instructions:''});renderEditor()});
    root.querySelectorAll('[data-remove-run-block]').forEach(b=>b.onclick=()=>{readEditor();working.blocks.splice(Number(b.dataset.removeRunBlock),1);working.blocks.forEach((x,i)=>x.order=i+1);renderEditor()});
    root.querySelector('#saveRunV26')?.addEventListener('click',()=>{readEditor();const draft=getDraft(),day=draft.plan?.[editingIndex];if(!day)return;day.runStructure=clone(working);const first=working.blocks?.find(b=>b.workPace);if(first?.workPace)day.pace=first.workPace;day.intensity=typeLabels[working.workoutType]||day.intensity||'Corrida';saveDraft(draft);modal.remove();modal=null;working=null;editingIndex=-1;render();toast('Estrutura da corrida salva no rascunho.')});
  }
  function openEditor(index){
    const draft=getDraft(),day=draft.plan?.[index];if(!day||day.type!=='run')return;
    editingIndex=index;working=clone(day.runStructure||blankStructure());modal=showModal(editorHtml());modal.querySelector('.vp-modal')?.classList.add('vp-run-v26-modal');bindEditor();
  }

  const previousBind=bindPersonal;
  bindPersonal=function(){
    previousBind();
    document.querySelectorAll('[data-edit-run-v26]').forEach(b=>b.onclick=e=>{e.stopPropagation();openEditor(Number(b.dataset.editRunV26))});
  };

  const style=document.createElement('style');
  style.textContent=`
    .vp-plan-preview-day .vp-run-v26-detail,.vp-plan-preview-day .vp-run-v26-empty{grid-column:1/-1}
    .vp-run-v26-detail{border-top:1px solid var(--line);padding-top:10px;margin-top:3px}.vp-run-v26-title{display:flex;justify-content:space-between;gap:10px;align-items:center}.vp-run-v26-title b,.vp-run-v26-title small{display:block}.vp-run-v26-title small{font-size:9px;color:var(--muted);margin-top:2px}
    .vp-run-v26-phase{display:grid;grid-template-columns:90px 80px 1fr;gap:8px;padding:7px 0;font-size:10px}.vp-run-v26-phase span{color:var(--muted);font-weight:800}.vp-run-v26-phase small{color:var(--muted)}
    .vp-run-v26-blocks{display:grid;gap:6px}.vp-run-v26-blocks>div{display:grid;grid-template-columns:24px 1fr;gap:7px;background:#fafafa;border-radius:12px;padding:8px}.vp-run-v26-blocks>div>span{width:22px;height:22px;border-radius:8px;background:var(--yellow);display:grid;place-items:center;font-size:9px;font-weight:900}.vp-run-v26-blocks p{margin:0}.vp-run-v26-blocks strong,.vp-run-v26-blocks small{display:block}.vp-run-v26-blocks small{font-size:9px;color:var(--muted);line-height:1.45;margin-top:2px}.vp-run-v26-note{font-size:9px;color:var(--muted);margin:8px 0 0}
    .vp-run-v26-empty{display:flex;justify-content:space-between;align-items:center;gap:8px;border-top:1px solid var(--line);padding-top:9px;color:var(--muted);font-size:10px}
    .vp-run-v26-modal{width:min(980px,calc(100vw - 18px));max-height:94dvh;overflow:auto}.vp-run-v26-head{position:sticky;top:0;background:#fff;z-index:4;padding-bottom:10px}.vp-run-v26-phase-edit,.vp-run-v26-block{margin-top:10px}.vp-run-v26-footer{position:sticky;bottom:0;background:#fff;border-top:1px solid var(--line);padding:12px 0 4px;margin-top:14px;display:flex;justify-content:flex-end;gap:8px;z-index:4}
    @media(max-width:680px){.vp-run-v26-phase{grid-template-columns:1fr 1fr}.vp-run-v26-phase small{grid-column:1/-1}.vp-run-v26-title{align-items:flex-start}.vp-run-v26-footer{flex-direction:column}.vp-run-v26-footer .vp-btn{width:100%}}
  `;
  document.head.appendChild(style);
})();