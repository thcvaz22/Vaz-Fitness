// Vaz Personal v10 — galeria pesquisável de exercícios no plano do aluno.
(()=>{
  const REPDB_BASE='https://exercise-dataset.com/';
  let customExercises=[];
  let mediaCache=null;
  let mediaPromise=null;
  let galleryTarget=null;

  const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const muscleLabel=e=>muscleNames?.[e?.muscle]||e?.muscle||'Outro';
  const sourceLabel=e=>e?.source==='personal'?'Meu exercício':'Biblioteca Vaz';
  const staticCatalog=()=>Array.isArray(window.VAZ_EXERCISE_CATALOG_V4)?window.VAZ_EXERCISE_CATALOG_V4:[];
  const catalog=()=>{
    const map=new Map();
    [...customExercises.map(x=>({...x,source:'personal'})),...staticCatalog().map(x=>({...x,source:'builtin'}))].forEach(x=>{if(x?.id&&!map.has(x.id))map.set(x.id,x)});
    return [...map.values()];
  };
  const findExercise=(id,name='')=>catalog().find(x=>x.id===id)||catalog().find(x=>norm(x.name)===norm(name))||null;

  async function loadCustomExercises(){
    try{const d=await req('/api/training-library',{params:{action:'library'}});customExercises=Array.isArray(d.exercises)?d.exercises:[]}catch{}
    return customExercises;
  }
  const priorLoadPersonal=loadPersonal;
  loadPersonal=async function(){await priorLoadPersonal();await loadCustomExercises()};
  loadCustomExercises().then(()=>{if(me?.role==='personal'&&selected&&clientTab==='plan')try{render()}catch{}});

  async function mediaLibrary(){
    if(mediaCache)return mediaCache;
    if(!mediaPromise)mediaPromise=fetch(`${REPDB_BASE}exercises.json`).then(r=>{if(!r.ok)throw new Error('Biblioteca visual indisponível.');return r.json()}).then(d=>mediaCache=d).finally(()=>mediaPromise=null);
    return mediaPromise;
  }
  function mediaFor(data,e){
    const list=Array.isArray(data?.exercises)?data.exercises:[],target=norm(e?.mediaQuery||e?.name);
    let hit=list.find(x=>norm(x.name_en)===target||norm(x.id)===target);if(hit)return hit;
    const words=target.split(' ').filter(x=>x.length>2);
    return list.find(x=>{const n=norm(x.name_en);return words.length&&words.every(w=>n.includes(w))})||null;
  }
  const mediaUrl=p=>{if(!p)return'';try{return new URL(p,REPDB_BASE).toString()}catch{return''}};
  const fallbackInstructions=e=>[
    `Ajuste a posição e o equipamento antes de iniciar o exercício para ${muscleLabel(e).toLowerCase()}.`,
    'Execute o movimento de forma controlada, mantendo postura estável e amplitude confortável.',
    'Evite compensações e movimentos bruscos. Interrompa a série se houver dor fora do esforço esperado.',
    'Use a carga e a progressão definidas pelo personal.'
  ];

  const priorRenderClientPlan=renderClientPlan;
  renderClientPlan=function(){
    let html=priorRenderClientPlan();
    if(!html.includes('id="openExerciseGallery"'))html=html.replace('<button class="vp-btn ghost" id="addDay">','<button class="vp-btn ghost" id="openExerciseGallery">▦ Galeria de exercícios</button><button class="vp-btn ghost" id="addDay">');
    return html;
  };

  renderExercise=function(e,di,ei){
    const base=findExercise(e?.id,e?.name)||e||{};
    const guide=!!(base.instructions||base.imageUrl||base.imageEndUrl||base.videoUrl||base.mediaQuery||base.source!=='personal');
    return `<div class="vp-card compact vp-plan-exercise" data-ex data-di="${di}" data-ei="${ei}" data-id="${safe(base.id||e?.id||'')}" style="margin-top:8px">
      <div class="vp-exercise-topline"><div><span class="vp-exercise-source ${base.source==='personal'?'personal':''}">${sourceLabel(base)}</span><strong>${safe(base.name||e?.name||'Novo exercício')}</strong></div><div class="vp-actions"><button type="button" class="vp-btn ghost" data-row-gallery="${di}:${ei}">Escolher na galeria</button>${guide?`<button type="button" class="vp-btn ghost" data-ex-details>Ver execução</button>`:''}</div></div>
      <div class="vp-form-grid">
        <div class="vp-field vp-ex-picker"><label>Exercício</label><input data-exf="name" data-ex-search autocomplete="off" value="${safe(base.name||e?.name||'')}" placeholder="Digite: supino, remada, agachamento…"><div class="vp-ex-suggestions" hidden></div></div>
        <div class="vp-field"><label>Músculo</label><select data-exf="muscle">${Object.entries(muscleNames).map(([v,l])=>`<option value="${v}" ${(base.muscle||e?.muscle)===v?'selected':''}>${l}</option>`).join('')}</select></div>
        <div class="vp-field"><label>Séries</label><input data-exf="sets" type="number" min="1" value="${Number(e?.sets||base.sets)||3}"></div>
        <div class="vp-field"><label>Repetições</label><input data-exf="reps" value="${safe(e?.reps||base.reps||'8-12')}"></div>
        <div class="vp-field"><label>Carga (kg)</label><input data-exf="load" type="number" step="0.5" value="${Number(e?.load)||0}"></div>
        <div class="vp-field"><label>Descanso (s)</label><input data-exf="rest" type="number" value="${Number(e?.rest||base.rest)||60}"></div>
      </div>
      <div class="vp-exercise-row-footer"><small>${base.equipment?`Equipamento: ${safe(base.equipment)} • `:''}${safe(muscleLabel(base))}${base.instructions?' • instruções do personal':''}</small><button class="vp-btn danger" data-remove-ex="${di}:${ei}">Remover</button></div>
    </div>`;
  };

  const priorCollectPlan=collectPlan;
  collectPlan=function(){
    const plan=priorCollectPlan();
    plan.forEach(day=>{if(day.type!=='strength')return;day.exercises=(day.exercises||[]).map(ex=>{const base=findExercise(ex.id,ex.name)||{};return {...base,...ex,id:base.id||ex.id,name:ex.name||base.name,secondary:Array.isArray(base.secondary)?base.secondary:(ex.secondary||[]),instructions:base.instructions||ex.instructions||'',imageUrl:base.imageUrl||ex.imageUrl||null,imageEndUrl:base.imageEndUrl||ex.imageEndUrl||null,videoUrl:base.videoUrl||ex.videoUrl||null,equipment:base.equipment||ex.equipment||'',mediaQuery:base.mediaQuery||ex.mediaQuery||null}})});
    return plan;
  };

  const rowKey=row=>`${row?.dataset.di}:${row?.dataset.ei}`;
  const rowByKey=key=>{const [di,ei]=String(key||'').split(':');return document.querySelector(`[data-ex][data-di="${di}"][data-ei="${ei}"]`)};
  function syncRow(row){
    if(!row||!selected?.plan?.plan)return;
    const di=Number(row.dataset.di),ei=Number(row.dataset.ei),day=selected.plan.plan?.[di];if(!day?.exercises?.[ei])return;
    const old=day.exercises[ei],base=findExercise(row.dataset.id,row.querySelector('[data-exf="name"]')?.value)||{};
    day.exercises[ei]={...base,...old,id:row.dataset.id||old.id,name:row.querySelector('[data-exf="name"]')?.value.trim()||base.name||'Exercício',muscle:row.querySelector('[data-exf="muscle"]')?.value||base.muscle||'core',sets:+row.querySelector('[data-exf="sets"]')?.value||base.sets||3,reps:row.querySelector('[data-exf="reps"]')?.value||base.reps||'8-12',load:+row.querySelector('[data-exf="load"]')?.value||0,rest:+row.querySelector('[data-exf="rest"]')?.value||base.rest||60,secondary:base.secondary||old.secondary||[],instructions:base.instructions||old.instructions||'',imageUrl:base.imageUrl||old.imageUrl||null,imageEndUrl:base.imageEndUrl||old.imageEndUrl||null,videoUrl:base.videoUrl||old.videoUrl||null,equipment:base.equipment||old.equipment||'',mediaQuery:base.mediaQuery||old.mediaQuery||null};
  }
  function applyToRow(row,e){
    if(!row||!e)return;
    row.dataset.id=e.id;
    const set=(s,v)=>{const el=row.querySelector(s);if(el&&v!=null)el.value=v};
    set('[data-exf="name"]',e.name);set('[data-exf="muscle"]',e.muscle||'core');set('[data-exf="sets"]',e.sets||3);set('[data-exf="reps"]',e.reps||'8-12');set('[data-exf="rest"]',e.rest||60);set('[data-exf="load"]',0);
    syncRow(row);render();toast(`${e.name} adicionado ao treino.`);
  }

  function searchExercises(q){
    const n=norm(q),items=catalog();if(!n)return items.slice(0,12);
    return items.map(e=>({e,score:norm(e.name).startsWith(n)?0:norm(e.name).includes(n)?1:norm(`${muscleLabel(e)} ${e.equipment||''}`).includes(n)?2:9})).filter(x=>x.score<9).sort((a,b)=>a.score-b.score||a.e.name.localeCompare(b.e.name,'pt-BR')).slice(0,12).map(x=>x.e);
  }
  function drawSuggestions(input){
    const box=input.closest('.vp-ex-picker')?.querySelector('.vp-ex-suggestions');if(!box)return;
    const list=searchExercises(input.value);
    box.innerHTML=`${list.map(e=>`<button type="button" data-suggest-ex="${safe(e.id)}"><span><strong>${safe(e.name)}</strong><small>${safe(muscleLabel(e))}${e.equipment?` • ${safe(e.equipment)}`:''}</small></span><em>${e.source==='personal'?'SEU':'BASE'}</em></button>`).join('')}<button type="button" class="vp-suggestion-new" data-new-from-search><span><strong>+ Cadastrar novo exercício</strong><small>${input.value.trim()?`Usar “${safe(input.value.trim())}” como nome`:'Adicionar exercício próprio com instruções e mídia'}</small></span></button>`;
    box.hidden=false;
    box.onclick=ev=>{
      const pick=ev.target.closest('[data-suggest-ex]');if(pick){applyToRow(input.closest('[data-ex]'),findExercise(pick.dataset.suggestEx));return}
      if(ev.target.closest('[data-new-from-search]'))openCustomExercise(input.value.trim(),rowKey(input.closest('[data-ex]')));
    };
  }

  function youtubeEmbed(url){try{const u=new URL(url);if(u.hostname.includes('youtu.be'))return `https://www.youtube.com/embed/${u.pathname.replace('/','').split('?')[0]}`;if(u.hostname.includes('youtube.com')){const id=u.searchParams.get('v');if(id)return `https://www.youtube.com/embed/${id}`;const m=u.pathname.match(/\/(?:shorts|embed)\/([^/?]+)/);if(m)return `https://www.youtube.com/embed/${m[1]}`}}catch{}return null}
  function vimeoEmbed(url){try{const u=new URL(url);if(!u.hostname.includes('vimeo.com'))return null;const id=u.pathname.split('/').filter(Boolean).at(-1);return /^\d+$/.test(id||'')?`https://player.vimeo.com/video/${id}`:null}catch{return null}}
  function videoHtml(url,name){if(!url)return'';const embed=youtubeEmbed(url)||vimeoEmbed(url);if(embed)return `<div class="vp-media-video"><iframe src="${safe(embed)}" title="Vídeo de ${safe(name)}" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe></div>`;if(/\.(mp4|webm|ogg)(\?|$)/i.test(url))return `<video class="vp-media-video-file" controls playsinline src="${safe(url)}"></video>`;return `<a class="vp-btn dark" href="${safe(url)}" target="_blank" rel="noopener">▶ Abrir vídeo demonstrativo</a>`}
  function mediaHtml(e,images,instructions,tips,video){return `<div class="vp-media-grid">${images.length?`<div class="vp-media-images">${images.slice(0,2).map((src,i)=>`<figure><img src="${safe(src)}" alt="${i?'Posição final':'Posição inicial'} de ${safe(e.name)}"><figcaption>${i?'Posição final':'Posição inicial'}</figcaption></figure>`).join('')}</div>`:'<div class="vp-media-noimage">Sem imagem cadastrada.</div>'}<div class="vp-media-copy">${videoHtml(video,e.name)}<h3>Como executar</h3><ol>${instructions.slice(0,7).map(x=>`<li>${safe(x)}</li>`).join('')}</ol>${tips?.length?`<h3>Pontos de atenção</h3><ul>${tips.slice(0,5).map(x=>`<li>${safe(x)}</li>`).join('')}</ul>`:''}</div></div>`}
  async function openMedia(e){
    if(!e)return toast('Selecione um exercício da galeria primeiro.');
    document.getElementById('vpExerciseMediaModal')?.remove();
    const modal=document.createElement('div');modal.id='vpExerciseMediaModal';modal.className='vp-modal-backdrop';modal.innerHTML=`<section class="vp-modal"><div class="vp-modal-head"><div><span class="vp-exercise-source ${e.source==='personal'?'personal':''}">${sourceLabel(e)}</span><h2>${safe(e.name)}</h2><p>${safe(muscleLabel(e))}${e.equipment?` • ${safe(e.equipment)}`:''}</p></div><button class="vp-modal-close" data-close>✕</button></div><div id="vpExerciseMediaBody" class="vp-media-loading">Carregando instruções e imagens de execução…</div></section>`;document.body.appendChild(modal);modal.onclick=ev=>{if(ev.target===modal)modal.remove()};modal.querySelector('[data-close]').onclick=()=>modal.remove();
    const body=modal.querySelector('#vpExerciseMediaBody');
    if(e.source==='personal'&&(e.instructions||e.imageUrl||e.imageEndUrl||e.videoUrl)){body.innerHTML=mediaHtml(e,[e.imageUrl,e.imageEndUrl].filter(Boolean),e.instructions?String(e.instructions).split(/\n+/).filter(Boolean):fallbackInstructions(e),[],e.videoUrl);return}
    try{const data=await mediaLibrary(),m=mediaFor(data,e);if(!m)throw new Error('Execução visual ainda não encontrada para este exercício.');const flat=m.images?.flat||{},images=[flat.start||flat.main,flat.peak].filter(Boolean).map(mediaUrl),instructions=m.instructions_es||m.instructions_en||fallbackInstructions(e),tips=m.tips_es||m.tips_en||[];body.innerHTML=mediaHtml(e,images,instructions.length?instructions:fallbackInstructions(e),tips,e.videoUrl)}catch(err){body.innerHTML=mediaHtml(e,[e.imageUrl,e.imageEndUrl].filter(Boolean),fallbackInstructions(e),[err.message],e.videoUrl)}
  }

  function openGallery(target=null){
    galleryTarget=target;document.getElementById('vpExerciseGalleryModal')?.remove();
    const modal=document.createElement('div');modal.id='vpExerciseGalleryModal';modal.className='vp-modal-backdrop';modal.innerHTML=`<section class="vp-modal vp-gallery-modal"><div class="vp-modal-head"><div><h2>Galeria de exercícios</h2><p>${catalog().length} exercícios disponíveis. Pesquise pelo nome, músculo ou equipamento.</p></div><button class="vp-modal-close" data-close>✕</button></div><div class="vp-gallery-toolbar"><input id="vpGallerySearch" placeholder="Buscar: supino, remada, agachamento…" autofocus><select id="vpGalleryMuscle"><option value="all">Todos os músculos</option>${Object.entries(muscleNames).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select><select id="vpGallerySource"><option value="all">Todos</option><option value="builtin">Biblioteca Vaz</option><option value="personal">Meus exercícios</option></select><button class="vp-btn primary" id="vpGalleryNew">+ Novo exercício</button></div><div id="vpGalleryGrid" class="vp-exercise-gallery-grid"></div></section>`;document.body.appendChild(modal);modal.onclick=ev=>{if(ev.target===modal)modal.remove()};modal.querySelector('[data-close]').onclick=()=>modal.remove();modal.querySelector('#vpGalleryNew').onclick=()=>openCustomExercise('',galleryTarget);['input','change'].forEach(evt=>modal.querySelector('#vpGallerySearch').addEventListener(evt,()=>renderGallery(modal)));modal.querySelector('#vpGalleryMuscle').onchange=()=>renderGallery(modal);modal.querySelector('#vpGallerySource').onchange=()=>renderGallery(modal);renderGallery(modal);
  }
  function renderGallery(modal){
    const q=norm(modal.querySelector('#vpGallerySearch')?.value),muscle=modal.querySelector('#vpGalleryMuscle')?.value||'all',source=modal.querySelector('#vpGallerySource')?.value||'all';
    const list=catalog().filter(e=>(!q||norm(`${e.name} ${muscleLabel(e)} ${e.equipment||''}`).includes(q))&&(muscle==='all'||e.muscle===muscle)&&(source==='all'||(source==='personal'?e.source==='personal':e.source!=='personal'))).slice(0,160);
    const grid=modal.querySelector('#vpGalleryGrid');grid.innerHTML=list.map(e=>`<article class="vp-gallery-card"><div class="vp-gallery-thumb" data-thumb="${safe(e.id)}">${e.imageUrl?`<img src="${safe(e.imageUrl)}" alt="${safe(e.name)}">`:'<span>🏋️</span>'}</div><div class="vp-gallery-card-body"><span class="vp-exercise-source ${e.source==='personal'?'personal':''}">${sourceLabel(e)}</span><h3>${safe(e.name)}</h3><p>${safe(muscleLabel(e))}${e.equipment?` • ${safe(e.equipment)}`:''}</p><div class="vp-gallery-meta"><span>${e.sets||3} séries</span><span>${safe(e.reps||'8-12')} reps</span><span>${e.rest||60}s</span>${e.imageUrl||e.imageEndUrl?`<span>▧ ${e.imageUrl&&e.imageEndUrl?'2 imagens':'imagem'}</span>`:''}${e.videoUrl?'<span>▶ vídeo</span>':''}${e.instructions?'<span>☰ instruções</span>':''}</div><div class="vp-actions"><button class="vp-btn ghost" data-details="${safe(e.id)}">Ver execução</button>${galleryTarget?`<button class="vp-btn primary" data-select="${safe(e.id)}">Selecionar</button>`:''}</div></div></article>`).join('')||'<div class="vp-empty">Nenhum exercício encontrado.</div>';
    grid.querySelectorAll('[data-details]').forEach(b=>b.onclick=()=>openMedia(findExercise(b.dataset.details)));
    grid.querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>{const row=rowByKey(galleryTarget),ex=findExercise(b.dataset.select);modal.remove();applyToRow(row,ex)});
    hydrateThumbs(grid,list.slice(0,40));
  }
  async function hydrateThumbs(root,list){
    try{const data=await mediaLibrary();for(const e of list){if(e.imageUrl)continue;const m=mediaFor(data,e),src=mediaUrl(m?.images?.flat?.start||m?.images?.flat?.main);if(!src)continue;const box=[...root.querySelectorAll('[data-thumb]')].find(x=>x.dataset.thumb===e.id);if(box)box.innerHTML=`<img src="${safe(src)}" alt="${safe(e.name)}">`}}catch{}
  }

  async function openCustomExercise(prefill='',target=null,existing=null){
    document.getElementById('vpExerciseCustomModal')?.remove();const ex=existing||{};
    const modal=document.createElement('div');modal.id='vpExerciseCustomModal';modal.className='vp-modal-backdrop';modal.innerHTML=`<section class="vp-modal small"><div class="vp-modal-head"><div><h2>${existing?'Editar exercício próprio':'Novo exercício próprio'}</h2><p>Cadastre instruções, imagens de início e fim e vídeo para reutilizar em qualquer aluno.</p></div><button class="vp-modal-close" data-close>✕</button></div><form id="vpCustomExerciseForm"><div class="vp-form-grid"><div class="vp-field"><label>Nome</label><input name="name" value="${safe(ex.name||prefill)}" required></div><div class="vp-field"><label>Grupo muscular</label><select name="muscle">${Object.entries(muscleNames).map(([v,l])=>`<option value="${v}" ${ex.muscle===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="vp-field"><label>Equipamento</label><input name="equipment" value="${safe(ex.equipment||'')}" placeholder="Halteres, polia, máquina…"></div><div class="vp-field"><label>Séries padrão</label><input name="sets" type="number" min="1" max="12" value="${Number(ex.sets)||3}"></div><div class="vp-field"><label>Repetições</label><input name="reps" value="${safe(ex.reps||'8-12')}"></div><div class="vp-field"><label>Descanso (s)</label><input name="rest" type="number" min="0" max="900" value="${Number(ex.rest)||60}"></div></div><div class="vp-field" style="margin-top:9px"><label>Instruções de execução</label><textarea name="instructions" rows="6" placeholder="Posição inicial, trajetória, respiração, amplitude e cuidados…">${safe(ex.instructions||'')}</textarea></div><div class="vp-form-grid" style="margin-top:9px"><div class="vp-field"><label>Imagem — posição inicial (URL HTTPS)</label><input name="imageUrl" type="url" value="${safe(ex.imageUrl||'')}" placeholder="https://..."><small>Foto ou ilustração do começo do movimento.</small></div><div class="vp-field"><label>Imagem — posição final (URL HTTPS)</label><input name="imageEndUrl" type="url" value="${safe(ex.imageEndUrl||'')}" placeholder="https://..."><small>Foto ou ilustração do fim do movimento.</small></div><div class="vp-field"><label>Vídeo demonstrativo (URL HTTPS)</label><input name="videoUrl" type="url" value="${safe(ex.videoUrl||'')}" placeholder="https://youtube.com/... ou https://..."><small>YouTube não listado, Vimeo ou arquivo HTTPS.</small></div></div><div class="vp-actions" style="margin-top:14px"><button type="button" class="vp-btn ghost" data-close>Cancelar</button><button type="submit" class="vp-btn primary">Salvar exercício</button></div></form></section>`;document.body.appendChild(modal);modal.onclick=ev=>{if(ev.target===modal)modal.remove()};modal.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>modal.remove());
    modal.querySelector('#vpCustomExerciseForm').onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target),btn=ev.target.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent='Salvando…';try{const d=await req('/api/training-library',{method:'POST',params:{action:'save_exercise'},body:{id:ex.id||null,name:f.get('name'),muscle:f.get('muscle'),equipment:f.get('equipment'),sets:+f.get('sets'),reps:f.get('reps'),rest:+f.get('rest'),instructions:f.get('instructions'),imageUrl:f.get('imageUrl'),imageEndUrl:f.get('imageEndUrl'),videoUrl:f.get('videoUrl')}});await loadCustomExercises();modal.remove();toast('Exercício salvo na sua galeria.');if(target)applyToRow(rowByKey(target),d.exercise||findExercise(d.exercise?.id));else render()}catch(err){btn.disabled=false;btn.textContent='Salvar exercício';toast(err.message)}};
  }

  const priorBindPersonal=bindPersonal;
  bindPersonal=function(){
    priorBindPersonal();
    document.getElementById('openExerciseGallery')?.addEventListener('click',()=>openGallery());
    document.querySelectorAll('[data-row-gallery]').forEach(b=>b.onclick=()=>openGallery(b.dataset.rowGallery));
    document.querySelectorAll('[data-ex-details]').forEach(b=>b.onclick=()=>{const row=b.closest('[data-ex]');openMedia(findExercise(row?.dataset.id,row?.querySelector('[data-exf="name"]')?.value))});
    document.querySelectorAll('[data-ex-search]').forEach(input=>{
      input.addEventListener('focus',()=>drawSuggestions(input));
      input.addEventListener('input',()=>{const row=input.closest('[data-ex]');if(row){row.dataset.id='';syncRow(row)}drawSuggestions(input)});
      input.addEventListener('blur',()=>setTimeout(()=>{const box=input.closest('.vp-ex-picker')?.querySelector('.vp-ex-suggestions');if(box)box.hidden=true},180));
    });
    document.querySelectorAll('[data-ex] [data-exf]').forEach(el=>el.addEventListener('change',()=>syncRow(el.closest('[data-ex]'))));
  };

  document.addEventListener('click',ev=>{
    const newBtn=ev.target.closest('#newExercise');if(newBtn){ev.preventDefault();ev.stopImmediatePropagation();openCustomExercise();return}
    const editBtn=ev.target.closest('[data-edit-exercise]');if(editBtn){const ex=customExercises.find(x=>x.id===editBtn.dataset.editExercise);if(ex){ev.preventDefault();ev.stopImmediatePropagation();openCustomExercise('',null,ex)}}
  },true);

  const style=document.createElement('style');style.textContent=`
    .vp-plan-exercise{border:1px solid #e8e5dc!important;background:#fff!important}.vp-exercise-topline{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px}.vp-exercise-topline>div:first-child{display:flex;flex-direction:column;gap:3px}.vp-exercise-topline strong{font-size:15px}.vp-exercise-source{display:inline-flex;width:max-content;padding:3px 7px;border-radius:999px;background:#f5f1df;color:#635318;font-size:9px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.vp-exercise-source.personal{background:#eaf7ef;color:#1d6c3b}.vp-ex-picker{position:relative}.vp-ex-suggestions{position:absolute;z-index:80;left:0;right:0;top:calc(100% + 5px);max-height:320px;overflow:auto;border:1px solid #ddd8c9;border-radius:14px;background:#fff;box-shadow:0 18px 45px rgba(0,0,0,.15);padding:5px}.vp-ex-suggestions button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;border:0;background:#fff;border-radius:10px;padding:10px;text-align:left;cursor:pointer}.vp-ex-suggestions button:hover{background:#faf7eb}.vp-ex-suggestions span{display:flex;flex-direction:column}.vp-ex-suggestions small{color:#777;margin-top:2px}.vp-ex-suggestions em{font-size:8px;font-style:normal;font-weight:900;background:#f3f3ef;padding:4px 6px;border-radius:999px}.vp-suggestion-new{border-top:1px solid #eee!important;border-radius:0!important;margin-top:3px}.vp-exercise-row-footer{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:8px}.vp-exercise-row-footer small{color:#777}.vp-gallery-modal{width:min(1120px,calc(100% - 18px));max-height:92vh;overflow:auto}.vp-gallery-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) 180px 180px auto;gap:8px;margin:12px 0}.vp-gallery-toolbar input,.vp-gallery-toolbar select{width:100%;border:1px solid #ddd8c9;border-radius:12px;padding:11px;font:inherit;background:#fff}.vp-exercise-gallery-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.vp-gallery-card{border:1px solid #e4e1d6;border-radius:18px;background:#fff;overflow:hidden}.vp-gallery-thumb{height:150px;background:#f6f5f0;display:grid;place-items:center;overflow:hidden}.vp-gallery-thumb img{width:100%;height:100%;object-fit:contain}.vp-gallery-thumb span{font-size:38px}.vp-gallery-card-body{padding:12px}.vp-gallery-card h3{margin:6px 0 3px;font-size:15px}.vp-gallery-card p{margin:0;color:#777;font-size:11px}.vp-gallery-meta{display:flex;gap:5px;flex-wrap:wrap;margin:9px 0}.vp-gallery-meta span{font-size:9px;background:#f5f3ec;border-radius:999px;padding:5px 7px}.vp-media-loading{padding:24px;color:#777}.vp-media-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:18px}.vp-media-images{display:grid;grid-template-columns:1fr 1fr;gap:8px}.vp-media-images figure{margin:0;border:1px solid #e4e1d6;border-radius:16px;overflow:hidden;background:#fafafa}.vp-media-images img{width:100%;aspect-ratio:4/5;object-fit:contain;display:block}.vp-media-images figcaption{padding:8px;text-align:center;font-size:10px;color:#777}.vp-media-copy h3{margin:14px 0 8px}.vp-media-copy ol,.vp-media-copy ul{padding-left:20px;line-height:1.55;font-size:12px}.vp-media-noimage{display:grid;place-items:center;min-height:260px;background:#f7f6f1;border-radius:16px;color:#888}.vp-media-video{position:relative;padding-top:56.25%;border-radius:16px;overflow:hidden;background:#111}.vp-media-video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.vp-media-video-file{display:block;width:100%;border-radius:16px;background:#111}@media(max-width:760px){.vp-exercise-topline{align-items:flex-start;flex-direction:column}.vp-gallery-toolbar{grid-template-columns:1fr 1fr}.vp-gallery-toolbar input{grid-column:1/-1}.vp-gallery-toolbar .vp-btn{grid-column:1/-1}.vp-exercise-gallery-grid{grid-template-columns:1fr 1fr}.vp-media-grid{grid-template-columns:1fr}.vp-gallery-thumb{height:130px}}@media(max-width:520px){.vp-exercise-gallery-grid{grid-template-columns:1fr}.vp-gallery-toolbar{grid-template-columns:1fr}.vp-gallery-toolbar input,.vp-gallery-toolbar .vp-btn{grid-column:auto}.vp-media-images{grid-template-columns:1fr 1fr}.vp-exercise-row-footer{align-items:flex-start;flex-direction:column}.vp-exercise-row-footer .vp-btn{align-self:flex-end}}
  `;document.head.appendChild(style);
})();
