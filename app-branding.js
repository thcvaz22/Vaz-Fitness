// Vaz Fitness — aplica a identidade white-label do personal após a liberação.
(function installStudentBranding(){
  const defaults={systemName:'Vaz Fitness',primaryColor:'#f5c400',accentColor:'#171717',backgroundColor:'#ffffff',surfaceColor:'#ffffff',textColor:'#232323',logoUrl:null};
  let current={...defaults},lastToken='';
  const API_BASE=window.VAZ_API_BASE||'';
  function token(){return localStorage.getItem('vazFitness.authToken')||'';}
  function rgba(hex,a){const m=String(hex).match(/^#([0-9a-f]{6})$/i);if(!m)return `rgba(245,196,0,${a})`;const n=parseInt(m[1],16);return `rgba(${n>>16},${(n>>8)&255},${n&255},${a})`;}
  function initials(name='VF'){return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'VF';}
  function applyBranding(){
    const b=current||defaults,root=document.documentElement;
    root.style.setProperty('--yellow',b.primaryColor||defaults.primaryColor);
    root.style.setProperty('--yellow-2',b.primaryColor||defaults.primaryColor);
    root.style.setProperty('--yellow-soft',rgba(b.primaryColor||defaults.primaryColor,.14));
    root.style.setProperty('--black',b.accentColor||defaults.accentColor);
    root.style.setProperty('--ink',b.textColor||defaults.textColor);
    root.style.setProperty('--white',b.surfaceColor||defaults.surfaceColor);
    root.style.background=b.backgroundColor||defaults.backgroundColor;
    document.body.style.background=`linear-gradient(180deg,${b.backgroundColor||'#fff'} 0%,${b.backgroundColor||'#fff'} 55%,${rgba(b.accentColor||'#171717',.035)} 100%)`;
    document.body.style.color=b.textColor||defaults.textColor;
    document.title=b.systemName||defaults.systemName;
    const theme=document.querySelector('meta[name="theme-color"]');if(theme)theme.content=b.primaryColor||defaults.primaryColor;
    document.querySelectorAll('.brand strong').forEach(el=>el.textContent=b.systemName||defaults.systemName);
    document.querySelectorAll('.brand-mark').forEach(el=>{
      if(b.logoUrl){el.textContent='';el.style.backgroundImage=`url("${String(b.logoUrl).replace(/"/g,'')}")`;el.style.backgroundSize='cover';el.style.backgroundPosition='center';}
      else{el.style.backgroundImage='none';el.textContent=initials(b.systemName);}
    });
    document.querySelectorAll('.eyebrow').forEach(el=>{if(el.textContent.trim()==='VAZ FITNESS')el.textContent=(b.systemName||defaults.systemName).toUpperCase();});
    document.querySelectorAll('[data-vf-brand-name]').forEach(el=>el.textContent=b.systemName||defaults.systemName);
  }
  async function fetchBranding(force=false){
    const t=token();if(!t){if(force){current={...defaults};applyBranding();}return;}
    if(!force&&t===lastToken&&current.updatedAt)return;
    try{
      const r=await fetch(`${API_BASE}/api/branding`,{headers:{Authorization:`Bearer ${t}`}});
      if(r.status===403||r.status===423)return;
      if(!r.ok)return;
      const data=await r.json();current={...defaults,...(data.branding||{})};lastToken=t;applyBranding();
    }catch{}
  }
  const baseRender=render;
  render=function(){baseRender();requestAnimationFrame(()=>{applyBranding();fetchBranding(false);});};
  window.addEventListener('focus',()=>fetchBranding(true));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)fetchBranding(true)});
  setInterval(()=>fetchBranding(true),60000);
  setTimeout(()=>fetchBranding(true),500);
})();
