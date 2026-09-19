// Vaz Personal v24 — edição transacional do treino do dia em modal.
(()=>{
  if(window.__VAZ_DAY_EDITOR_V24__)return;
  window.__VAZ_DAY_EDITOR_V24__=true;

  const clone=v=>JSON.parse(JSON.stringify(v));
  const esc=v=>safe(v==null?'':String(v));
  let editorModal=null;
  let editorIndex=-1;
  let dayDraft=null;
  let catalogCache=[];

  function currentPlan(){return Array.isArray(selected?.plan?.plan)?selected.plan.plan:[]}
  function exerciseFromCatalog(e){
    return {
      id:e.id||('custom-'+Date.now()),
      name:e.name||'Exercício',
      muscle:e.muscle||'core',
      secondary:Array.isArray(e.secondary)?e.secondary:[],
      sets:Number(e.sets)||3,
      reps:e.reps||'8-12',
      load:Number(e.load)||0,
      rest:Number(e.rest)||60,
      icon:e.icon||'🏋️',
      priority:!!e.priority,
      equipment:e.equipment||'',
      instructions:e.instructions||'',
      videoUrl:e.videoUrl||null,
      imageUrl:e.imageUrl||null,
      imageEndUrl:e.imageEndUrl||null,
      mediaQuery:e.mediaQuery||e.name||''
    };
  }
  async function getCatalog(){
    try{
      const d=await req('/api/personal-tools',{params:{action:'catalog'}});
      const seen=new Set();
      catalogCache=[...(d.custom||[]),...(d.builtin||[])].filter(x=>x?.id&&x?.name&&!seen.has(x.id)&&(seen.add(x.id),true));
    }catch(e){
      if(!catalogCache.length&&Array.isArray(window.VAZ_EXERCISE_CATALOG_V4))catalogCache=window.VAZ_EXERCISE_CATALOG_V4.map(x=>({...x,source:x.source||'builtin'}));
    }
    return catalogCache;
  }
  function dayMeta(d){
    if(d.type==='run')return esc(d.pace||'pace livre')+' • '+esc(d.intensity||'Corrida')+' • ~'+(Number(d.duration)||60)+' min';
    return (Array.isArray(d.exercises)?d.exercises.length:0)+' exercícios • ~'+(Number(d.duration)||60)+' min';
  }

  renderPlanDay=function(d,i){
    const letter=d.splitLetter?'<span class="vp-split-letter">'+esc(d.splitLetter)+'</span>':'';
    return '<article class="vp-day-accordion vp-day-summary" data-plan-day data-index="'+i+'" data-id="'+esc(d.id||'')+'" data-split-letter="'+esc(d.splitLetter||'')+'" data-focus="'+esc((d.focusMuscles||[]).join(','))+'">'+
      '<div class="vp-day-summary-row">'+
        '<div class="vp-day-dot">'+esc(dayNames[Number(d.day)]||'Dia')+'</div>'+letter+
        '<div class="vp-day-copy"><strong>'+esc(d.name||'Treino')+'</strong><small>'+dayMeta(d)+'</small></div>'+
        '<button type="button" class="vp-btn ghost vp-edit-day" data-edit-plan-day="'+i+'">Editar</button>'+
      '</div>'+
      '<div class="vp-day-summary-actions"><button type="button" class="vp-btn danger" data-remove-day="'+i+'">Excluir dia</button></div>'+
    '</article>';
  };

  collectPlan=function(){return clone(currentPlan())};

  function editorHtml(){
    const d=dayDraft||{},run=d.type==='run',exercises=Array.isArray(d.exercises)?d.exercises:[];
    let html='<div class="vp-day-editor-head"><div><span class="vp-plan-kicker">EDITAR TREINO DO DIA</span><h2>'+esc(d.name||'Treino')+'</h2><p>Faça todas as alterações e salve somente quando terminar.</p></div><button type="button" class="vp-btn ghost" data-day-editor-close>×</button></div>';
    html+='<div class="vp-card compact vp-day-editor-info"><div class="vp-form-grid">'+
      '<div class="vp-field"><label>Dia</label><select data-edf="day">'+dayNames.map((x,idx)=>'<option value="'+idx+'" '+(Number(d.day)===idx?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></div>'+
      '<div class="vp-field"><label>Tipo</label><select data-edf="type"><option value="strength" '+(!run?'selected':'')+'>Musculação</option><option value="run" '+(run?'selected':'')+'>Corrida</option></select></div>'+
      '<div class="vp-field"><label>Nome do treino</label><input data-edf="name" value="'+esc(d.name||'Treino')+'" maxlength="80"></div>'+
      '<div class="vp-field"><label>Duração (min)</label><input data-edf="duration" type="number" min="0" max="300" value="'+(Number(d.duration)||60)+'"></div>'+
    '</div>';
    if(run){
      html+='<div class="vp-form-grid" style="margin-top:9px">'+
        '<div class="vp-field"><label>Pace</label><input data-edf="pace" value="'+esc(d.pace||'')+'"></div>'+
        '<div class="vp-field"><label>Intensidade</label><input data-edf="intensity" value="'+esc(d.intensity||'Leve')+'"></div>'+
      '</div>';
    }
    html+='</div>';
    if(!run){
      html+='<section class="vp-day-editor-exercises"><div class="vp-page-head"><div><h3>Exercícios</h3><p>Adicione, troque e ajuste a prescrição sem perder o nome ou os dados do treino.</p></div><span class="vp-day-ex-count">'+exercises.length+' exercício(s)</span></div>';
      html+=exercises.length?exercises.map(exerciseHtml).join(''):'<div class="vp-empty">Nenhum exercício cadastrado neste treino.</div>';
      html+='<div class="vp-plan-add-actions vp-day-add-actions"><button type="button" class="vp-btn primary" data-day-add-library>⌕ Pesquisar na biblioteca</button><button type="button" class="vp-btn ghost" data-day-add-manual>+ Adicionar manualmente</button></div></section>';
    }
    html+='<div class="vp-day-editor-footer"><button type="button" class="vp-btn ghost" data-day-editor-close>Cancelar</button><button type="button" class="vp-btn primary" data-day-editor-save>Salvar treino</button></div>';
    return html;
  }
  function exerciseHtml(e,ei){
    return '<article class="vp-card compact vp-day-edit-ex" data-day-edit-ex="'+ei+'">'+
      '<div class="vp-form-grid">'+
        '<div class="vp-field"><label>Exercício</label><input data-exdraft="name" value="'+esc(e.name||'Exercício')+'"></div>'+
        '<div class="vp-field"><label>Músculo</label><select data-exdraft="muscle">'+Object.entries(muscleNames).map(([v,l])=>'<option value="'+esc(v)+'" '+(e.muscle===v?'selected':'')+'>'+esc(l)+'</option>').join('')+'</select></div>'+
        '<div class="vp-field"><label>Séries</label><input data-exdraft="sets" type="number" min="1" max="20" value="'+(Number(e.sets)||3)+'"></div>'+
        '<div class="vp-field"><label>Repetições</label><input data-exdraft="reps" value="'+esc(e.reps||'8-12')+'"></div>'+
        '<div class="vp-field"><label>Carga (kg)</label><input data-exdraft="load" type="number" step="0.5" min="0" value="'+(Number(e.load)||0)+'"></div>'+
        '<div class="vp-field"><label>Descanso (s)</label><input data-exdraft="rest" type="number" min="0" max="900" value="'+(Number(e.rest)||60)+'"></div>'+
      '</div>'+
      '<div class="vp-day-ex-actions"><button type="button" class="vp-btn ghost" data-day-swap-library="'+ei+'">⌕ Pesquisar / trocar</button><button type="button" class="vp-btn danger" data-day-remove-ex="'+ei+'">Remover</button></div>'+
    '</article>';
  }

  function readEditor(){
    if(!editorModal||!dayDraft)return;
    const root=editorModal.querySelector('.vp-modal');
    if(!root)return;
    const val=n=>root.querySelector('[data-edf="'+n+'"]')?.value;
    dayDraft.day=Number(val('day')??dayDraft.day);
    dayDraft.type=val('type')||dayDraft.type||'strength';
    dayDraft.name=String(val('name')||dayDraft.name||'Treino').trim()||'Treino';
    dayDraft.duration=Number(val('duration'))||60;
    if(dayDraft.type==='run'){
      dayDraft.pace=val('pace')||'';
      dayDraft.intensity=val('intensity')||'Leve';
    }else{
      const prior=Array.isArray(dayDraft.exercises)?dayDraft.exercises:[];
      const rows=[...root.querySelectorAll('[data-day-edit-ex]')];
      if(rows.length||!prior.length)dayDraft.exercises=rows.map((row,ei)=>{
        const old=prior[ei]||{};
        const get=n=>row.querySelector('[data-exdraft="'+n+'"]')?.value;
        return {...old,
          id:old.id||('custom-'+Date.now()+'-'+ei),
          name:String(get('name')||old.name||'Exercício').trim()||'Exercício',
          muscle:get('muscle')||old.muscle||'core',
          secondary:Array.isArray(old.secondary)?old.secondary:[],
          sets:Number(get('sets'))||3,
          reps:get('reps')||old.reps||'8-12',
          load:Number(get('load'))||0,
          rest:Number(get('rest'))||60,
          icon:old.icon||'🏋️',
          priority:!!old.priority
        };
      });
    }
  }

  function renderEditor(){
    if(!editorModal)return;
    const box=editorModal.querySelector('.vp-modal');
    box.innerHTML=editorHtml();
    bindEditor();
  }
  function bindEditor(){
    const root=editorModal?.querySelector('.vp-modal');if(!root)return;
    root.querySelectorAll('[data-day-editor-close]').forEach(b=>b.onclick=()=>{editorModal?.remove();editorModal=null;dayDraft=null;editorIndex=-1});
    root.querySelector('[data-edf="type"]')?.addEventListener('change',()=>{readEditor();renderEditor()});
    root.querySelector('[data-day-add-manual]')?.addEventListener('click',()=>{readEditor();dayDraft.exercises=dayDraft.exercises||[];dayDraft.exercises.push({id:'custom-'+Date.now(),name:'Novo exercício',muscle:'core',secondary:[],sets:3,reps:'8-12',load:0,rest:60,icon:'🏋️',priority:false});renderEditor()});
    root.querySelector('[data-day-add-library]')?.addEventListener('click',()=>openPicker(null));
    root.querySelectorAll('[data-day-swap-library]').forEach(b=>b.onclick=()=>openPicker(Number(b.dataset.daySwapLibrary)));
    root.querySelectorAll('[data-day-remove-ex]').forEach(b=>b.onclick=()=>{readEditor();dayDraft.exercises.splice(Number(b.dataset.dayRemoveEx),1);renderEditor()});
    root.querySelector('[data-day-editor-save]')?.addEventListener('click',async e=>{
      readEditor();
      const btn=e.currentTarget;btn.disabled=true;btn.textContent='Salvando…';
      const plan=clone(currentPlan());
      plan[editorIndex]=clone(dayDraft);
      selected.plan={...(selected.plan||{}),plan};
      editorModal?.remove();editorModal=null;
      await savePlan();
      dayDraft=null;editorIndex=-1;
    });
  }

  async function openPicker(ei){
    readEditor();
    const list=await getCatalog();
    if(!editorModal||!dayDraft)return;
    if(!list.length){toast('A biblioteca de exercícios ainda não está disponível.');return}
    const root=editorModal.querySelector('.vp-modal');
    const eq=[...new Set(list.map(x=>x.equipment).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));
    root.innerHTML='<div class="vp-day-editor-head"><div><span class="vp-plan-kicker">BIBLIOTECA</span><h2>'+(ei==null?'Adicionar exercício':'Trocar exercício')+'</h2><p>O que você já digitou no treino foi preservado.</p></div><button type="button" class="vp-btn ghost" data-picker-back>← Voltar</button></div>'+
      '<div class="vp-catalog-picker-filters"><input id="dayPickerSearch" placeholder="Pesquisar exercício" autocomplete="off"><select id="dayPickerMuscle"><option value="all">Todos os músculos</option>'+Object.entries(muscleNames).map(([v,l])=>'<option value="'+esc(v)+'">'+esc(l)+'</option>').join('')+'</select><select id="dayPickerSource"><option value="all">Biblioteca completa</option><option value="personal">Meus exercícios</option><option value="builtin">Biblioteca Vaz</option></select><select id="dayPickerEquipment"><option value="all">Todos os equipamentos</option>'+eq.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('')+'</select></div>'+
      '<div class="vp-picker-count"><strong id="dayPickerCount">'+list.length+'</strong> exercício(s) encontrado(s)</div><div class="vp-catalog-picker-list" id="dayPickerList"></div>';
    root.querySelector('[data-picker-back]').onclick=renderEditor;
    const search=root.querySelector('#dayPickerSearch'),muscle=root.querySelector('#dayPickerMuscle'),source=root.querySelector('#dayPickerSource'),equipment=root.querySelector('#dayPickerEquipment'),box=root.querySelector('#dayPickerList'),count=root.querySelector('#dayPickerCount');
    const norm=v=>String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
    const draw=()=>{
      const q=norm(search.value),mv=muscle.value,sv=source.value,ev=equipment.value;
      const filtered=list.filter(x=>(!q||norm((x.name||'')+' '+(muscleNames[x.muscle]||x.muscle||'')+' '+(x.equipment||'')).includes(q))&&(mv==='all'||x.muscle===mv)&&(sv==='all'||(x.source||'builtin')===sv)&&(ev==='all'||x.equipment===ev));
      count.textContent=String(filtered.length);
      box.innerHTML=filtered.slice(0,160).map(x=>'<button type="button" class="vp-picker-ex" data-day-pick="'+esc(x.id)+'"><div><strong>'+esc(x.name)+'</strong><small>'+esc(muscleNames[x.muscle]||x.muscle||'Outro')+' • '+esc(x.equipment||'Sem equipamento')+'</small></div><div class="vp-picker-prescription"><span>'+esc(x.reps||'8-12')+'</span><b>'+(Number(x.sets)||3)+'x</b></div></button>').join('')||'<div class="vp-empty">Nenhum exercício encontrado.</div>';
      box.querySelectorAll('[data-day-pick]').forEach(b=>b.onclick=()=>{
        const found=list.find(x=>String(x.id)===String(b.dataset.dayPick));if(!found)return;
        dayDraft.exercises=dayDraft.exercises||[];
        if(ei==null)dayDraft.exercises.push(exerciseFromCatalog(found));else dayDraft.exercises[ei]=exerciseFromCatalog(found);
        renderEditor();
        toast(ei==null?'Exercício adicionado ao treino.':'Exercício substituído.');
      });
    };
    [search,muscle,source,equipment].forEach(el=>el.addEventListener(el===search?'input':'change',draw));
    draw();setTimeout(()=>search.focus(),30);
  }

  function openDayEditor(index){
    const d=currentPlan()[index];if(!d)return;
    editorIndex=index;dayDraft=clone(d);
    editorModal=showModal(editorHtml());
    editorModal.querySelector('.vp-modal')?.classList.add('vp-day-editor-modal');
    bindEditor();
  }

  const priorBind=bindPersonal;
  bindPersonal=function(){
    priorBind();
    document.querySelectorAll('[data-edit-plan-day]').forEach(b=>b.onclick=()=>openDayEditor(Number(b.dataset.editPlanDay)));
  };

  const style=document.createElement('style');
  style.textContent='.vp-day-summary{padding:0!important}.vp-day-summary-row{display:flex;align-items:center;gap:10px;padding:13px}.vp-day-summary-actions{display:flex;justify-content:flex-end;padding:0 13px 12px}.vp-edit-day{flex:0 0 auto}.vp-day-editor-modal{width:min(960px,calc(100vw - 20px));max-height:92dvh;overflow:auto;padding:20px}.vp-day-editor-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;position:sticky;top:-20px;background:#fff;z-index:3;padding:6px 0 12px;border-bottom:1px solid var(--line)}.vp-day-editor-head h2{margin:4px 0}.vp-day-editor-head p{margin:0;color:var(--muted);font-size:11px}.vp-day-editor-info{margin-top:14px}.vp-day-editor-exercises{margin-top:14px}.vp-day-edit-ex{margin-top:9px;background:#fafaf8}.vp-day-ex-actions{display:flex;gap:7px;justify-content:flex-end;margin-top:8px}.vp-day-add-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.vp-day-ex-count{font-size:9px;font-weight:900;background:#fff5bd;padding:6px 8px;border-radius:999px}.vp-day-editor-footer{position:sticky;bottom:-20px;background:#fff;border-top:1px solid var(--line);padding:12px 0 5px;margin-top:16px;display:flex;justify-content:flex-end;gap:8px;z-index:3}@media(max-width:680px){.vp-day-summary-row{align-items:flex-start;flex-wrap:wrap}.vp-day-copy{min-width:160px}.vp-edit-day{margin-left:auto}.vp-day-summary-actions{justify-content:stretch}.vp-day-summary-actions .vp-btn{width:100%}.vp-day-editor-modal{padding:16px;max-height:94dvh}.vp-day-editor-head{top:-16px}.vp-day-editor-footer{bottom:-16px}.vp-day-ex-actions,.vp-day-editor-footer{flex-direction:column}.vp-day-ex-actions .vp-btn,.vp-day-editor-footer .vp-btn,.vp-day-add-actions .vp-btn{width:100%}}';
  document.head.appendChild(style);
})();
