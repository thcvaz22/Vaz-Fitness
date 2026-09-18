// Vaz Personal v4 — catálogo AION, filtros avançados de alunos e academia.
(()=>{
  const GYM_CACHE='vazPersonal.gymMeta.v4';
  const readGymCache=()=>{try{return JSON.parse(localStorage.getItem(GYM_CACHE)||'{}')||{}}catch{return {}}};
  const writeGymCache=()=>{try{localStorage.setItem(GYM_CACHE,JSON.stringify(athleteMeta))}catch{}};
  let athleteMeta=readGymCache();
  let exerciseCatalog=Array.isArray(window.VAZ_EXERCISE_CATALOG_V4)?window.VAZ_EXERCISE_CATALOG_V4.map(x=>({...x,source:x.source||'builtin'})):[];
  let catalogVersion=Number(window.VAZ_EXERCISE_CATALOG_VERSION)||4;
  let toolsLoading=false;

  const toolsApi=(action,o={})=>req('/api/personal-tools',{...o,params:{...(o.params||{}),action}});
  const norm=v=>String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const uniq=a=>[...new Set(a.filter(Boolean))];
  const gymOf=id=>athleteMeta[id]?.gymName||clients.find(x=>x.id===id)?.gymName||'';
  const sourceLabel=e=>e.source==='personal'?'Seu exercício':'Catálogo AION';
  const catalogExercise=id=>exerciseCatalog.find(x=>x.id===id)||null;
  const equipmentOptions=()=>uniq(exerciseCatalog.map(x=>x.equipment)).sort((a,b)=>a.localeCompare(b,'pt-BR'));

  function applyMeta(){
    clients=(clients||[]).map(c=>({...c,gymName:athleteMeta[c.id]?.gymName||c.gymName||''}));
  }
  async function loadMeta(){
    const local=readGymCache();athleteMeta={...local,...athleteMeta};applyMeta();
    try{
      const d=await toolsApi('meta_summary'),remote=d.meta||{};
      athleteMeta={...local,...remote};writeGymCache();applyMeta();
      const pending=Object.entries(local).filter(([id,m])=>m?.gymName&&!remote[id]);
      if(pending.length)Promise.allSettled(pending.map(([athleteId,m])=>toolsApi('set_gym',{method:'POST',body:{athleteId,gymName:m.gymName}}))).then(()=>{});
    }catch(e){console.warn('Meta de alunos em modo local',e)}
  }
  async function loadCatalog(){
    if(toolsLoading)return;toolsLoading=true;
    try{
      const d=await toolsApi('catalog');
      catalogVersion=Number(d.version)||0;
      const seen=new Set();
      exerciseCatalog=[...(d.custom||[]),...(d.builtin||[])].filter(x=>x?.id&&x?.name&&!seen.has(x.id)&&(seen.add(x.id),true));
    }catch(e){
      if(!exerciseCatalog.length&&Array.isArray(window.VAZ_EXERCISE_CATALOG_V4))exerciseCatalog=window.VAZ_EXERCISE_CATALOG_V4.map(x=>({...x,source:x.source||'builtin'}));
      console.warn('Catálogo AION usando base embarcada',e);
    }finally{toolsLoading=false}
  }
  async function saveGym(athleteId,gymName,{quiet=false}={}){
    const value=String(gymName||'').trim();let d={ok:true,gymName:value,localOnly:true};
    try{d=await toolsApi('set_gym',{method:'POST',body:{athleteId,gymName:value}})}catch(e){console.warn('Academia aguardando sincronização',e)}
    athleteMeta[athleteId]={...(athleteMeta[athleteId]||{}),gymName:d.gymName??value,pendingSync:!!d.localOnly};writeGymCache();applyMeta();
    if(selected?.athlete?.id===athleteId)selected.athlete.gymName=d.gymName??value;
    if(!quiet)toast(d.localOnly?'Academia salva • sincronização pendente.':(d.gymName?'Academia atualizada.':'Academia removida.'));
    return d;
  }

  const priorLoadPersonal=loadPersonal;
  loadPersonal=async function(){
    await priorLoadPersonal();
    await Promise.allSettled([loadMeta(),loadCatalog()]);
    applyMeta();
  };

  const priorClientRows=clientRows;
  clientRows=function(list){
    if(!Array.isArray(list)||!list.length)return '<div class="vp-empty">Nenhum aluno vinculado.</div>';
    return list.map(c=>{
      const mode=c.summary?.mode||'',gym=c.gymName||'',goal=goalNames[c.summary?.goal]||c.summary?.goal||'Objetivo não informado';
      const last=c.summary?.lastActivity?fmtDate(c.summary.lastActivity):'sem atividade recente';
      return `<div class="vp-row vp-student-row" data-client-row data-name="${safe(norm(`${c.name} ${c.publicCode}`))}" data-mode="${safe(mode)}" data-gym="${safe(norm(gym))}" data-status="${safe(c.status)}"><div class="vp-avatar">${initials(c.name)}</div><div class="vp-row-main"><strong>${safe(c.name)}</strong><small><span class="vp-code">${safe(c.publicCode)}</span> • ${safe(modeNames[mode]||'Perfil')} • ${safe(goal)}</small><div class="vp-student-meta"><span>⌂ ${safe(gym||'Academia não informada')}</span><span>◷ ${safe(last)}</span></div></div>${statusBadge(c.status)}<button class="vp-btn ghost" data-open="${c.id}">Abrir</button></div>`;
    }).join('');
  };

  renderStudents=function(){
    const gyms=uniq((clients||[]).map(c=>c.gymName)).sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const active=(clients||[]).filter(c=>c.status==='approved').length,pending=(clients||[]).filter(c=>c.status==='pending').length;
    const modes={strength:(clients||[]).filter(c=>c.summary?.mode==='strength').length,run:(clients||[]).filter(c=>c.summary?.mode==='run').length,hybrid:(clients||[]).filter(c=>c.summary?.mode==='hybrid').length};
    return `${pageHead('Meus alunos','Encontre qualquer aluno em segundos.',`<button class="vp-btn primary" id="claimBtn">+ Vincular aluno</button>`)}
      <section class="vp-grid four vp-student-stats"><div class="vp-card compact vp-stat"><span>Total</span><strong>${clients.length}</strong></div><div class="vp-card compact vp-stat"><span>Ativos</span><strong>${active}</strong></div><div class="vp-card compact vp-stat"><span>Aguardando</span><strong>${pending}</strong></div><div class="vp-card compact vp-stat"><span>Academias</span><strong>${gyms.length}</strong></div></section>
      <section class="vp-card vp-student-filter-card"><div class="vp-student-filters"><label class="vp-search-wide"><span>Pesquisar</span><input id="studentSearch" placeholder="Nome ou código ID" autocomplete="off"></label><label><span>Modalidade</span><select id="studentMode"><option value="all">Todas</option><option value="strength">Musculação (${modes.strength})</option><option value="run">Corrida (${modes.run})</option><option value="hybrid">Híbrido (${modes.hybrid})</option></select></label><label><span>Academia</span><select id="studentGym"><option value="all">Todas</option><option value="__none__">Não informada</option>${gyms.map(g=>`<option value="${safe(norm(g))}">${safe(g)}</option>`).join('')}</select></label><label><span>Status</span><select id="studentStatus"><option value="all">Todos</option><option value="approved">Ativos</option><option value="pending">Aguardando</option><option value="suspended">Suspensos</option></select></label><button class="vp-btn ghost vp-filter-clear" id="clearStudentFilters">Limpar</button></div><div class="vp-filter-result"><strong id="studentResultsCount">${clients.length}</strong><span> aluno(s) encontrados</span></div></section>
      <section class="vp-card vp-student-list-card" id="studentList">${clientRows(clients)}</section>`;
  };

  const priorAccess=renderClientAccess;
  renderClientAccess=function(){
    const id=selected?.athlete?.id,gym=gymOf(id);
    return `<section class="vp-card vp-academy-card"><div class="vp-page-head"><div><h2>Academia do aluno</h2><p>Usada para organizar sua carteira e filtrar alunos.</p></div>${gym?badge('Cadastrada','ok'):badge('Opcional','info')}</div><div class="vp-academy-edit"><div class="vp-field"><label>Academia</label><input id="studentGymEdit" value="${safe(gym)}" maxlength="120" placeholder="Ex.: Academia X — Unidade Centro"></div><button class="vp-btn primary" id="saveStudentGym">Salvar academia</button></div></section><div class="vp-section">${priorAccess()}</div>`;
  };

  const priorPlanDay=renderPlanDay;
  renderPlanDay=function(d,i){
    let html=priorPlanDay(d,i);
    if(d.type==='run')return html;
    const marker=`<button class="vp-btn ghost" data-add-ex="${i}" style="margin-top:6px">+ Exercício</button>`;
    const replacement=`<div class="vp-plan-add-actions"><button class="vp-btn primary" data-add-library="${i}">⌕ Pesquisar na biblioteca</button><button class="vp-btn ghost" data-add-ex="${i}">+ Adicionar manualmente</button></div>`;
    return html.includes(marker)?html.replace(marker,replacement):html;
  };
  const priorExercise=renderExercise;
  renderExercise=function(e,di,ei){
    let html=priorExercise(e,di,ei);
    const close='</button></div>';
    const pos=html.lastIndexOf(close);
    if(pos<0)return html;
    const extra=`<button class="vp-btn ghost" data-swap-library="${di}:${ei}" style="margin-top:6px">⌕ Pesquisar / trocar exercício</button>`;
    return html.slice(0,pos+9)+extra+html.slice(pos+9);
  };

  const priorPlan=renderClientPlan;
  renderClientPlan=function(){
    let html=priorPlan();
    const note=`<div class="vp-alert info vp-aion-catalog-note"><span>⌕</span><div><strong>Pesquisa inteligente de exercícios</strong><small>${exerciseCatalog.length||'100+'} opções na Biblioteca Vaz. Pesquise pelo nome ou filtre pela parte do corpo, origem e equipamento.</small></div></div>`;
    return html.replace('<div id="planDays">',`${note}<div id="planDays">`);
  };

  function bindStudentFilters(){
    const q=document.getElementById('studentSearch'),mode=document.getElementById('studentMode'),gym=document.getElementById('studentGym'),status=document.getElementById('studentStatus'),count=document.getElementById('studentResultsCount');
    if(!q)return;
    const apply=()=>{
      const nq=norm(q.value),mv=mode.value,gv=gym.value,sv=status.value;let visible=0;
      document.querySelectorAll('[data-client-row]').forEach(row=>{
        const gymMatch=gv==='all'||(gv==='__none__'?!row.dataset.gym:row.dataset.gym===gv);
        const show=(!nq||row.dataset.name.includes(nq))&&(mv==='all'||row.dataset.mode===mv)&&gymMatch&&(sv==='all'||row.dataset.status===sv);
        row.hidden=!show;if(show)visible++;
      });
      if(count)count.textContent=String(visible);
    };
    [q,mode,gym,status].forEach(el=>{el.addEventListener(el===q?'input':'change',apply)});
    document.getElementById('clearStudentFilters')?.addEventListener('click',()=>{q.value='';mode.value='all';gym.value='all';status.value='all';apply()});
  }

  function openClaimModal(){
    const m=showModal(`<div class="vp-page-head"><div><h2>Vincular aluno</h2><p>Use o código ID do aluno e, se quiser, já informe a academia.</p></div><button class="vp-btn ghost" id="closeClaimModal">×</button></div><form id="claimFormV4"><div class="vp-field"><label>Código do aluno</label><input name="code" placeholder="VF-XXXX-XXXX-XXXX" required autocomplete="off"></div><div class="vp-field" style="margin-top:9px"><label>Academia <small>opcional</small></label><input name="gym" maxlength="120" placeholder="Ex.: Smart Fit — Centro"></div><div class="vp-alert info" style="margin-top:10px"><span>⌂</span><div><strong>Organização automática</strong><small>A academia aparecerá nos filtros da sua carteira. Você poderá alterar depois.</small></div></div><button class="vp-btn primary" style="margin-top:12px">Vincular aluno</button></form>`);
    m.querySelector('#closeClaimModal').onclick=()=>m.remove();
    m.querySelector('#claimFormV4').onsubmit=async e=>{
      e.preventDefault();const fd=new FormData(e.target);const code=String(fd.get('code')||'').toUpperCase().trim(),gym=String(fd.get('gym')||'').trim();
      try{
        const d=await vfApi('personal_claim',{method:'POST',body:{code}});
        await loadPersonal();
        const athleteId=d.athlete?.id||(clients||[]).find(c=>String(c.publicCode||'').toUpperCase()===code)?.id;
        if(gym&&athleteId)await saveGym(athleteId,gym,{quiet:true});
        m.remove();toast(gym?'Aluno vinculado e academia cadastrada.':'Aluno vinculado.');render();
      }catch(err){toast(err.message)}
    };
  }

  function pickerExercise(e){return {id:e.id,name:e.name,muscle:e.muscle,secondary:Array.isArray(e.secondary)?e.secondary:[],sets:Number(e.sets)||3,reps:e.reps||'8-12',load:0,rest:Number(e.rest)||60,icon:'🏋️',priority:false,equipment:e.equipment||'',instructions:e.instructions||'',videoUrl:e.videoUrl||null,imageUrl:e.imageUrl||null,imageEndUrl:e.imageEndUrl||null,mediaQuery:e.mediaQuery||e.name}}
  function openCatalogPicker(di,ei=null){
    if(!exerciseCatalog.length){toast('Carregando biblioteca AION…');loadCatalog().then(()=>openCatalogPicker(di,ei));return}
    const muscles=Object.entries(muscleNames),equip=equipmentOptions();
    const m=showModal(`<div class="vp-page-head"><div><h2>${ei==null?'Adicionar exercício':'Trocar exercício'}</h2><p>Pesquise pelo nome ou filtre pela parte do corpo que será trabalhada.</p></div><button class="vp-btn ghost" id="closeCatalogPicker">×</button></div><div class="vp-catalog-picker-filters"><input id="catalogPickerSearch" placeholder="Pesquisar pelo nome do exercício" autocomplete="off"><select id="catalogPickerMuscle" aria-label="Filtrar por parte do corpo"><option value="all">Todas as partes do corpo</option>${muscles.map(([v,l])=>`<option value="${v}">${safe(l)}</option>`).join('')}</select><select id="catalogPickerSource" aria-label="Filtrar por origem"><option value="all">Biblioteca completa</option><option value="personal">Meus exercícios</option><option value="builtin">Biblioteca Vaz</option></select><select id="catalogPickerEquipment" aria-label="Filtrar por equipamento"><option value="all">Todos os equipamentos</option>${equip.map(x=>`<option value="${safe(x)}">${safe(x)}</option>`).join('')}</select></div><div class="vp-picker-count"><strong id="catalogPickerCount">${exerciseCatalog.length}</strong> exercício(s) encontrado(s)</div><div id="catalogPickerList" class="vp-catalog-picker-list"></div>`);
    m.querySelector('#closeCatalogPicker').onclick=()=>m.remove();
    const search=m.querySelector('#catalogPickerSearch'),muscle=m.querySelector('#catalogPickerMuscle'),source=m.querySelector('#catalogPickerSource'),equipment=m.querySelector('#catalogPickerEquipment'),list=m.querySelector('#catalogPickerList'),count=m.querySelector('#catalogPickerCount');
    const draw=()=>{
      const q=norm(search.value),mv=muscle.value,sv=source.value,ev=equipment.value;
      const filtered=exerciseCatalog.filter(e=>(!q||norm(`${e.name} ${muscleNames[e.muscle]||e.muscle} ${(e.secondary||[]).map(x=>muscleNames[x]||x).join(' ')} ${e.equipment}`).includes(q))&&(mv==='all'||e.muscle===mv)&&(sv==='all'||e.source===sv)&&(ev==='all'||e.equipment===ev));
      count.textContent=String(filtered.length);
      list.innerHTML=filtered.slice(0,150).map(e=>`<button class="vp-picker-ex" data-pick-ex="${safe(e.id)}"><div><strong>${safe(e.name)}</strong><small>${safe(muscleNames[e.muscle]||e.muscle)} • ${safe(e.equipment||'Sem equipamento')} • ${safe(sourceLabel(e))}</small></div><div class="vp-picker-prescription"><span>${safe(e.reps||'8-12')}</span><b>${e.sets||3}x</b></div></button>`).join('')||'<div class="vp-empty">Nenhum exercício encontrado com esses filtros.</div>';
      list.querySelectorAll('[data-pick-ex]').forEach(b=>b.onclick=()=>{const ex=catalogExercise(b.dataset.pickEx);if(!ex)return;m.remove();mutatePlan(p=>{const day=p[di];day.exercises=day.exercises||[];if(ei==null)day.exercises.push(pickerExercise(ex));else day.exercises[ei]=pickerExercise(ex)});toast(ei==null?'Exercício adicionado.':'Exercício substituído.');});
    };
    [search,muscle,source,equipment].forEach(el=>el.addEventListener(el===search?'input':'change',draw));draw();setTimeout(()=>search.focus(),30);
  }

  function augmentExerciseLibraryDom(){
    const grid=document.getElementById('exerciseGrid');if(!grid||!exerciseCatalog.length)return;
    const existing=new Set([...grid.querySelectorAll('[data-exercise-card] h3')].map(h=>norm(h.textContent)));
    const frag=document.createDocumentFragment();
    exerciseCatalog.filter(e=>e.source!=='personal'&&!existing.has(norm(e.name))).forEach(e=>{
      const el=document.createElement('article');el.className='vp-exercise-card vp-aion-exercise';el.dataset.exerciseCard='';el.dataset.source='builtin';el.dataset.search=norm(`${e.name} ${muscleNames[e.muscle]||e.muscle} ${e.equipment}`);el.dataset.muscle=e.muscle;el.dataset.equipment=e.equipment||'';
      el.innerHTML=`<div class="vp-page-head"><div><h3>${safe(e.name)}</h3><p>${safe(muscleNames[e.muscle]||e.muscle)} • ${safe(e.equipment||'—')}</p></div>${badge('AION','info')}</div><div class="vp-template-meta">${badge(`${e.sets||3} séries`,'info')}${badge(`${safe(e.reps||'8-12')} reps`,'info')}${badge(`${e.rest||60}s`,'info')}</div>`;frag.appendChild(el);
    });
    grid.appendChild(frag);
    grid.querySelectorAll('[data-exercise-card]').forEach(card=>{
      const name=norm(card.querySelector('h3')?.textContent),match=exerciseCatalog.find(e=>norm(e.name)===name);if(match){card.dataset.muscle=match.muscle;card.dataset.equipment=match.equipment||''}
    });
    const tab=[...document.querySelectorAll('.vp-library-tab')].find(x=>x.textContent.includes('Exercícios'));const span=tab?.querySelector('span');if(span)span.textContent=String(grid.querySelectorAll('[data-exercise-card]').length);
    const filters=document.querySelector('.vp-library-search');if(filters&&!document.getElementById('exerciseMuscleV4')){
      filters.insertAdjacentHTML('beforeend',`<select id="exerciseMuscleV4"><option value="all">Todos os músculos</option>${Object.entries(muscleNames).map(([v,l])=>`<option value="${v}">${safe(l)}</option>`).join('')}</select><select id="exerciseEquipmentV4"><option value="all">Todos equipamentos</option>${equipmentOptions().map(x=>`<option value="${safe(x)}">${safe(x)}</option>`).join('')}</select><span class="vp-library-visible"><b id="exerciseVisibleV4">${grid.querySelectorAll('[data-exercise-card]').length}</b> exercícios</span>`);
      const search=document.getElementById('exerciseSearch'),source=document.getElementById('exerciseSource'),muscle=document.getElementById('exerciseMuscleV4'),equipment=document.getElementById('exerciseEquipmentV4'),visible=document.getElementById('exerciseVisibleV4');
      const apply=()=>{const q=norm(search?.value),sv=source?.value||'all',mv=muscle?.value||'all',ev=equipment?.value||'all';let n=0;grid.querySelectorAll('[data-exercise-card]').forEach(c=>{const show=(!q||String(c.dataset.search||'').includes(q))&&(sv==='all'||c.dataset.source===sv)&&(mv==='all'||c.dataset.muscle===mv)&&(ev==='all'||c.dataset.equipment===ev);c.hidden=!show;if(show)n++});if(visible)visible.textContent=String(n)};
      search?.addEventListener('input',apply);source?.addEventListener('change',apply);muscle?.addEventListener('change',apply);equipment?.addEventListener('change',apply);apply();
    }
  }

  const priorBind=bindPersonal;
  bindPersonal=function(){
    priorBind();
    bindStudentFilters();
    const claim=document.getElementById('claimBtn');if(claim)claim.onclick=openClaimModal;
    document.getElementById('saveStudentGym')?.addEventListener('click',async()=>{try{await saveGym(selected.athlete.id,document.getElementById('studentGymEdit')?.value||'');render()}catch(e){toast(e.message)}});
    document.querySelectorAll('[data-add-library]').forEach(b=>b.onclick=()=>openCatalogPicker(+b.dataset.addLibrary));
    document.querySelectorAll('[data-swap-library]').forEach(b=>b.onclick=()=>{const [di,ei]=b.dataset.swapLibrary.split(':').map(Number);openCatalogPicker(di,ei)});
    augmentExerciseLibraryDom();
  };

  const priorSetAccess=setStudentAccess;
  setStudentAccess=async function(mode){
    if(mode==='approve'){
      const input=document.getElementById('studentGymEdit');if(input)try{await saveGym(selected.athlete.id,input.value,{quiet:true})}catch(e){toast(e.message);return}
    }
    return priorSetAccess(mode);
  };

  suggestPlan=async function(){
    try{
      toast('AION está montando o próximo ciclo com a biblioteca completa…');
      let d;
      try{d=await toolsApi('suggest_plan',{method:'POST',body:{athleteId:selected.athlete.id}})}
      catch{d=await opsApi('suggest_plan',{method:'POST',body:{athleteId:selected.athlete.id}})}
      selected.plan={...(selected.plan||{}),plan:d.plan};aiDraft=true;clientTab='plan';render();toast(d.catalogVersion?`Rascunho AION pronto • catálogo v${d.catalogVersion}.`:'Rascunho AION pronto.');
    }catch(e){toast(e.message)}
  };

  async function bootstrap(){
    try{
      if(typeof me==='undefined'||me?.role!=='personal')return;
      await Promise.allSettled([loadMeta(),loadCatalog()]);applyMeta();render();
    }catch(e){console.warn('Vaz Personal v4 bootstrap',e)}
  }
  if(document.readyState==='loading')window.addEventListener('load',bootstrap,{once:true});else setTimeout(bootstrap,0);
})();
