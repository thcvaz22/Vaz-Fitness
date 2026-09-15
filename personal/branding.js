// Vaz Personal — white-label por personal.
(function installBrandingStudio(){
  const defaults={systemName:'Vaz Fitness',primaryColor:'#f5c400',accentColor:'#151515',backgroundColor:'#ffffff',surfaceColor:'#ffffff',textColor:'#1c1c1c',logoUrl:''};
  let branding={...defaults},brandingLoaded=false,brandingLoading=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function brandingApi(method='GET',body=null){
    const headers={'Content-Type':'application/json'};if(token)headers.Authorization=`Bearer ${token}`;
    const r=await fetch(`${API_BASE}/api/branding`,{method,headers,body:body?JSON.stringify(body):undefined});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.message||'Não foi possível carregar a identidade.');
    return data;
  }
  function applyAccent(){
    const root=document.documentElement;
    root.style.setProperty('--yellow',branding.primaryColor||defaults.primaryColor);
    root.style.setProperty('--black',branding.accentColor||defaults.accentColor);
    root.style.setProperty('--text',branding.textColor||defaults.textColor);
    root.style.setProperty('--bg',mixWithWhite(branding.backgroundColor||defaults.backgroundColor,.04));
    const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=branding.primaryColor||defaults.primaryColor;
  }
  function mixWithWhite(hex,amount){
    const m=String(hex).match(/^#([0-9a-f]{6})$/i);if(!m)return hex;
    const n=parseInt(m[1],16),r=n>>16,g=(n>>8)&255,b=n&255;
    const f=x=>Math.round(x+(255-x)*amount).toString(16).padStart(2,'0');return `#${f(r)}${f(g)}${f(b)}`;
  }
  async function loadBranding(force=false){
    if(brandingLoading||brandingLoaded&&!force||!token||!me)return;
    brandingLoading=true;
    try{const data=await brandingApi();branding={...defaults,...(data.branding||{})};brandingLoaded=true;applyAccent();if(view==='branding')render();}
    catch(e){toast(e.message)}finally{brandingLoading=false}
  }
  function previewLogo(){
    if(branding.logoUrl)return `<img src="${esc(branding.logoUrl)}" alt="Logo" style="width:54px;height:54px;border-radius:16px;object-fit:cover">`;
    return `<div class="brand-preview-mark">${esc((branding.systemName||'VF').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase())}</div>`;
  }
  function renderBrandingPage(){
    if(!brandingLoaded&&!brandingLoading)setTimeout(()=>loadBranding(),0);
    return `<section class="hero"><span class="eyebrow">PERSONALIZAÇÃO WHITE-LABEL</span><h1>Seu sistema, com a sua marca.</h1><p>Defina o nome e a identidade visual que seus alunos verão no Vaz Fitness após a liberação do treino. Alterações futuras são sincronizadas automaticamente.</p></section>
    <section class="grid two" style="margin-top:16px">
      <div class="card"><div class="card-head"><div><h2>Identidade do app</h2><p>Personalize o sistema entregue aos seus alunos.</p></div></div>
        <form id="brandingForm" class="branding-form">
          <label>Nome do sistema<input name="systemName" maxlength="50" value="${esc(branding.systemName)}" placeholder="Ex.: Thiago Performance"></label>
          <div class="branding-colors">
            ${colorField('primaryColor','Cor principal',branding.primaryColor)}
            ${colorField('accentColor','Cor de contraste',branding.accentColor)}
            ${colorField('backgroundColor','Fundo',branding.backgroundColor)}
            ${colorField('surfaceColor','Cards',branding.surfaceColor)}
            ${colorField('textColor','Texto',branding.textColor)}
          </div>
          <label>Logo por URL <span class="subtle">(opcional, HTTPS)</span><input name="logoUrl" type="url" value="${esc(branding.logoUrl||'')}" placeholder="https://.../logo.png"></label>
          <div class="branding-actions"><button type="button" class="btn ghost" id="resetBranding">Restaurar padrão</button><button class="btn primary">Salvar identidade</button></div>
        </form>
      </div>
      <div class="card"><div class="card-head"><div><h2>Prévia do aluno</h2><p>É assim que o app ficará após a liberação.</p></div></div>${renderBrandPreview()}</div>
    </section>
    <section class="card" style="margin-top:16px"><div class="card-head"><div><h2>Como funciona</h2><p>Uma identidade para todos os alunos vinculados a você.</p></div></div><div class="branding-flow"><div><strong>1. Você personaliza</strong><span>Nome, cores e logo opcional.</span></div><div><strong>2. Você libera o treino</strong><span>O vínculo aluno–personal define qual marca será usada.</span></div><div><strong>3. O aluno recebe</strong><span>Ao sincronizar, o app troca Vaz Fitness pela sua identidade automaticamente.</span></div></div></section>`;
  }
  function colorField(name,label,value){return `<label class="color-field"><span>${label}</span><div><input type="color" name="${name}" value="${esc(value)}"><code>${esc(value)}</code></div></label>`;}
  function renderBrandPreview(){
    return `<div class="brand-preview" style="--bp:${esc(branding.primaryColor)};--ba:${esc(branding.accentColor)};--bb:${esc(branding.backgroundColor)};--bs:${esc(branding.surfaceColor)};--bt:${esc(branding.textColor)}"><div class="brand-preview-phone"><div class="brand-preview-top">${previewLogo()}<div><strong>${esc(branding.systemName)}</strong><small>powered by AION IA</small></div></div><div class="brand-preview-hero"><span>TREINO DE HOJE</span><h3>Seu plano está pronto.</h3><p>Treinos, evolução e inteligência com a identidade do seu personal.</p><button>Iniciar treino</button></div><div class="brand-preview-card"><strong>Evolução</strong><span>Consistência, carga, corrida e metas.</span></div><div class="brand-preview-nav"><b>⌂</b><b>⚡</b><b>↗</b><b>AI</b><b>◎</b></div></div></div>`;
  }
  async function saveBranding(form){
    const fd=new FormData(form);const payload={};['systemName','primaryColor','accentColor','backgroundColor','surfaceColor','textColor','logoUrl'].forEach(k=>payload[k]=String(fd.get(k)||''));
    const button=form.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Salvando…';
    try{const data=await brandingApi('POST',payload);branding={...defaults,...data.branding};brandingLoaded=true;applyAccent();toast('Identidade salva. Seus alunos receberão a atualização automaticamente.');render();}
    catch(e){toast(e.message);button.disabled=false;button.textContent='Salvar identidade';}
  }
  function bindBranding(){
    if(view!=='branding')return;
    const form=document.getElementById('brandingForm');if(!form)return;
    form.onsubmit=e=>{e.preventDefault();saveBranding(form)};
    form.querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>{
      const fd=new FormData(form);branding={...branding};['systemName','primaryColor','accentColor','backgroundColor','surfaceColor','textColor','logoUrl'].forEach(k=>branding[k]=String(fd.get(k)||''));
      form.querySelectorAll('.color-field').forEach(f=>{const i=f.querySelector('input[type="color"]');const c=f.querySelector('code');if(i&&c)c.textContent=i.value;});
      const card=form.closest('.grid')?.children?.[1];if(card){const head=card.querySelector('.card-head');card.innerHTML='';if(head)card.appendChild(head);card.insertAdjacentHTML('beforeend',renderBrandPreview());}
    }));
    document.getElementById('resetBranding').onclick=()=>{branding={...defaults};render();};
  }

  const baseDashboard=renderDashboard;
  renderDashboard=function(){return view==='branding'?renderBrandingPage():baseDashboard();};
  const baseShell=renderShell;
  renderShell=function(){
    let html=baseShell();
    const button=`<button class="nav-btn ${view==='branding'?'active':''}" data-view="branding">✦ Personalização</button>`;
    html=html.replace('<div class="side-note">',`${button}<div class="side-note">`);
    const mobile=`<button class="${view==='branding'?'active':''}" data-view="branding">Marca</button>`;
    html=html.replace('<button id="mobileLogout">Sair</button>',`${mobile}<button id="mobileLogout">Sair</button>`);
    return html;
  };
  const baseBind=bind;
  bind=function(){baseBind();bindBranding();};

  const css=document.createElement('style');css.textContent=`
    .branding-form{display:flex;flex-direction:column;gap:14px}.branding-form label{display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:800}.branding-colors{display:grid;grid-template-columns:1fr 1fr;gap:10px}.color-field{border:1px solid var(--line);border-radius:16px;padding:11px;background:#fafafa}.color-field>div{display:flex;align-items:center;gap:9px}.color-field input[type=color]{width:42px;height:34px;border:0;padding:0;background:transparent}.color-field code{font-size:10px;color:var(--muted)}.branding-actions{display:flex;justify-content:flex-end;gap:8px}.brand-preview{background:var(--bb);border-radius:24px;padding:18px}.brand-preview-phone{background:var(--bb);color:var(--bt);border:1px solid #ddd;border-radius:28px;padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.12)}.brand-preview-top{display:flex;align-items:center;gap:10px;margin-bottom:16px}.brand-preview-top strong,.brand-preview-top small{display:block}.brand-preview-top small{font-size:9px;opacity:.58}.brand-preview-mark{width:54px;height:54px;border-radius:16px;background:var(--bp);color:var(--ba);display:grid;place-items:center;font-weight:950}.brand-preview-hero{background:var(--ba);color:#fff;border-radius:22px;padding:18px;position:relative;overflow:hidden}.brand-preview-hero:after{content:"";position:absolute;width:120px;height:120px;border-radius:50%;background:var(--bp);right:-45px;top:-40px}.brand-preview-hero>*{position:relative;z-index:1}.brand-preview-hero span{font-size:9px;letter-spacing:.15em;color:var(--bp);font-weight:900}.brand-preview-hero h3{font-size:25px;margin:8px 0}.brand-preview-hero p{font-size:11px;color:#ccc;max-width:75%}.brand-preview-hero button{border:0;border-radius:12px;padding:10px 13px;background:var(--bp);color:var(--ba);font-weight:900}.brand-preview-card{margin-top:11px;padding:14px;border-radius:16px;background:var(--bs);border:1px solid #e7e7e7}.brand-preview-card strong,.brand-preview-card span{display:block}.brand-preview-card span{font-size:10px;opacity:.6;margin-top:3px}.brand-preview-nav{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;background:var(--ba);color:#aaa;border-radius:16px;margin-top:11px;padding:10px;text-align:center}.brand-preview-nav b:nth-child(4){color:var(--bp)}.branding-flow{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.branding-flow>div{padding:14px;border:1px solid var(--line);border-radius:16px}.branding-flow strong,.branding-flow span{display:block}.branding-flow span{color:var(--muted);font-size:11px;margin-top:5px;line-height:1.5}@media(max-width:700px){.branding-colors,.branding-flow{grid-template-columns:1fr}.branding-actions{flex-direction:column-reverse}.branding-actions .btn{width:100%}}`;
  document.head.appendChild(css);
  setTimeout(()=>loadBranding(),250);
})();
