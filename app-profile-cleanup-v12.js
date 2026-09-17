// Vaz Fitness v12 — remove controles legados do Perfil.
(()=>{
  const baseRenderProfile=renderProfile;
  renderProfile=function(){
    let html=baseRenderProfile();
    html=html.replace(/<button[^>]*(?:data-regenerate|data-request-plan|data-reset)[^>]*>[\s\S]*?<\/button>/gi,'');
    return html;
  };

  // Fallback visual para qualquer versão antiga ainda presente no cache do navegador.
  const style=document.createElement('style');
  style.textContent='[data-regenerate],[data-request-plan],[data-reset]{display:none!important}';
  document.head.appendChild(style);
})();
