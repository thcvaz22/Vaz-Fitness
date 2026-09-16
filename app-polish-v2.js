// Vaz Fitness — polimento V2: filtros do calendário e consistência sem dados.
(function installPolishV2(){
  let calendarFilter='all';

  function consistencyHasData(){
    window.VazCalendar?.reconcile?.();
    const d=new Date(),prefix=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-`;
    return (state.calendarEvents||[]).some(e=>e.date?.startsWith(prefix)&&e.kind==='planned'&&['done','missed','skipped','abandoned'].includes(e.status));
  }
  function fixEmptyConsistency(root=document){
    if(consistencyHasData())return;
    root.querySelectorAll('.monthly-summary>div,.coach-home-mini>div,.coach-consistency').forEach(box=>{
      const label=(box.querySelector('span')?.textContent||'').trim().toLowerCase();
      if(label.includes('consistência')){
        const strong=box.querySelector('strong');if(strong)strong.textContent='—';
      }
    });
  }

  function filterBar(){return `<div class="calendar-filter-bar" role="group" aria-label="Filtrar calendário">
    ${[['all','Todos'],['strength','Musculação'],['run','Corrida'],['done','Concluídos'],['missed','Falhas']].map(([v,l])=>`<button type="button" data-calendar-filter="${v}" class="${calendarFilter===v?'active':''}">${l}</button>`).join('')}
  </div>`;}
  function injectFilter(html){
    if(!html.includes('monthly-calendar-card')||html.includes('data-calendar-filter='))return html;
    return html.replace('<div class="calendar-weekdays">',`${filterBar()}<div class="calendar-weekdays">`);
  }
  function chipVisible(chip){
    if(calendarFilter==='all')return true;
    const text=(chip.textContent||'').toLowerCase();
    if(calendarFilter==='strength')return text.includes('musculação');
    if(calendarFilter==='run')return text.includes('corrida')||text.includes('extra');
    if(calendarFilter==='done')return chip.classList.contains('done')||chip.classList.contains('additional');
    if(calendarFilter==='missed')return chip.classList.contains('missed');
    return true;
  }
  function applyCalendarFilter(){
    document.querySelectorAll('[data-calendar-filter]').forEach(b=>b.classList.toggle('active',b.dataset.calendarFilter===calendarFilter));
    document.querySelectorAll('.monthly-calendar-card .calendar-day:not(.empty)').forEach(day=>{
      const chips=[...day.querySelectorAll('.calendar-chip')];
      let visible=0;
      chips.forEach(chip=>{const show=chipVisible(chip);chip.hidden=!show;if(show)visible++;});
      const more=day.querySelector('.calendar-more');if(more)more.hidden=calendarFilter!=='all';
      day.classList.toggle('calendar-filter-muted',chips.length>0&&visible===0);
    });
  }

  const priorRenderProgress=renderProgress;
  renderProgress=function(){return injectFilter(priorRenderProgress());};

  const priorRender=render;
  render=function(){priorRender();queueMicrotask(()=>{fixEmptyConsistency();applyCalendarFilter();});};

  const priorBind=bindDynamic;
  bindDynamic=function(){
    priorBind();
    document.querySelectorAll('[data-calendar-filter]').forEach(b=>b.addEventListener('click',()=>{calendarFilter=b.dataset.calendarFilter;applyCalendarFilter();}));
    queueMicrotask(()=>{fixEmptyConsistency();applyCalendarFilter();});
  };

  const priorContext=buildAionContext;
  buildAionContext=function(){
    const ctx=priorContext();
    if(!consistencyHasData()){
      ctx.monthlyConsistency=null;
      if(ctx.goalMetrics)ctx.goalMetrics.consistency=null;
      if(ctx.calendarSummary)ctx.calendarSummary.monthlyConsistency=null;
    }
    return ctx;
  };

  const style=document.createElement('style');
  style.textContent=`
    .calendar-filter-bar{display:flex;gap:7px;overflow-x:auto;padding:2px 0 12px;scrollbar-width:none}.calendar-filter-bar::-webkit-scrollbar{display:none}.calendar-filter-bar button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:8px 12px;font:inherit;font-size:10px;font-weight:800;white-space:nowrap;cursor:pointer}.calendar-filter-bar button.active{background:#191919;color:#fff;border-color:#191919}.calendar-day.calendar-filter-muted{opacity:.42}.calendar-chip[hidden]{display:none!important}@media(max-width:560px){.calendar-filter-bar{margin-right:-2px}.calendar-filter-bar button{padding:8px 11px}}
  `;
  document.head.appendChild(style);
  queueMicrotask(()=>{fixEmptyConsistency();applyCalendarFilter();});
})();

(function loadMembershipBrandingAndPersonalMedia(){
  function load(src,done){
    if(document.querySelector(`script[data-vaz-extra="${src}"]`)){done?.();return;}
    const s=document.createElement('script');s.src=src;s.dataset.vazExtra=src;s.onload=()=>done?.();document.body.appendChild(s);
  }
  load('app-membership.js',()=>load('app-branding.js',()=>load('app-custom-exercise-media.js',()=>load('app-scale-v1.js',()=>load('app-experience-v6.js',()=>load('app-calendar-cycle-v7.js',()=>{try{render()}catch{}}))))));
})();
