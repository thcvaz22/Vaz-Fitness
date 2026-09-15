const exerciseGuidesPt = {
  bench: {
    instructions: [
      'Deite no banco com os olhos aproximadamente alinhados abaixo da barra.',
      'Apoie os pés firmemente no chão e mantenha as escápulas levemente retraídas.',
      'Segure a barra um pouco além da largura dos ombros e retire-a do suporte com controle.',
      'Desça a barra em direção à região média do peito, mantendo os antebraços firmes.',
      'Empurre a barra até estender os braços sem perder a estabilidade dos ombros.'
    ],
    tips: ['Mantenha os punhos alinhados com os antebraços.', 'Evite deixar os cotovelos excessivamente abertos.', 'Controle a descida e não deixe a barra quicar no peito.']
  },
  'incline-db': {
    instructions: [
      'Ajuste o banco em uma inclinação moderada e sente-se com um halter em cada mão.',
      'Posicione os halteres ao lado do peito, com os pés firmes no chão.',
      'Empurre os halteres para cima aproximando-os sem bater um no outro.',
      'Desça lentamente até sentir alongamento confortável no peitoral.',
      'Repita mantendo tronco e escápulas estáveis.'
    ],
    tips: ['Evite inclinar demais o banco.', 'Não deixe os ombros avançarem no final da descida.', 'Use amplitude confortável e controlada.']
  },
  fly: {
    instructions: [
      'Posicione as polias na altura adequada e segure uma alça em cada mão.',
      'Dê um pequeno passo à frente e mantenha o tronco firme.',
      'Com os cotovelos levemente flexionados, aproxime as mãos à frente do peito.',
      'Contraia o peitoral por um instante no final do movimento.',
      'Retorne devagar até sentir um alongamento confortável.'
    ],
    tips: ['Não transforme o movimento em um supino.', 'Mantenha a mesma flexão de cotovelo durante toda a repetição.', 'Evite amplitude que cause desconforto no ombro.']
  },
  ohp: {
    instructions: [
      'Sente-se ou fique em pé com um halter em cada mão na altura dos ombros.',
      'Mantenha o abdômen firme e a coluna em posição neutra.',
      'Empurre os halteres para cima até os braços ficarem próximos da extensão.',
      'Faça uma breve pausa no topo sem elevar excessivamente os ombros.',
      'Desça com controle até a posição inicial.'
    ],
    tips: ['Evite arquear exageradamente a lombar.', 'Mantenha punhos sobre os cotovelos.', 'Não force amplitude dolorosa no ombro.']
  },
  lateral: {
    instructions: [
      'Fique em pé com um halter em cada mão ao lado do corpo.',
      'Mantenha os cotovelos levemente flexionados.',
      'Eleve os braços lateralmente até aproximadamente a altura dos ombros.',
      'Faça o movimento com os ombros, sem impulsionar o tronco.',
      'Desça os halteres lentamente até a posição inicial.'
    ],
    tips: ['Use carga que permita controle total.', 'Evite encolher os ombros durante a subida.', 'Não balance o corpo para ganhar impulso.']
  },
  'rear-delt': {
    instructions: [
      'Incline o tronco ou ajuste o aparelho conforme a variação utilizada.',
      'Inicie com os braços à frente e os cotovelos levemente flexionados.',
      'Abra os braços para os lados, levando-os para trás com controle.',
      'Contraia a região posterior dos ombros no final do movimento.',
      'Retorne lentamente à posição inicial.'
    ],
    tips: ['Evite puxar principalmente com os trapézios.', 'Mantenha o pescoço relaxado.', 'Não use balanço do tronco.']
  },
  pulldown: {
    instructions: [
      'Sente-se e ajuste o apoio das pernas para manter o corpo estável.',
      'Segure a barra com uma pegada confortável, um pouco além da largura dos ombros.',
      'Mantenha o peito elevado e puxe a barra em direção à parte superior do peito.',
      'Conduza os cotovelos para baixo e para trás enquanto aproxima as escápulas.',
      'Retorne com controle até alongar as costas sem perder a postura.'
    ],
    tips: ['Não puxe a barra atrás da cabeça.', 'Evite usar impulso excessivo do tronco.', 'Não deixe os ombros subirem descontroladamente no retorno.']
  },
  row: {
    instructions: [
      'Sente-se com os pés apoiados e segure a alça com os braços estendidos.',
      'Mantenha o tronco firme, peito aberto e coluna neutra.',
      'Puxe a alça em direção ao abdômen conduzindo os cotovelos para trás.',
      'Aproxime as escápulas ao final sem projetar os ombros para cima.',
      'Estenda os braços novamente de forma controlada.'
    ],
    tips: ['Evite balançar o tronco para gerar força.', 'Não arredonde excessivamente a coluna.', 'Mantenha os cotovelos seguindo uma trajetória confortável.']
  },
  'db-row': {
    instructions: [
      'Apoie uma mão e, se desejar, o joelho do mesmo lado em um banco.',
      'Segure o halter com o braço oposto estendido em direção ao chão.',
      'Mantenha a coluna neutra e o abdômen firme.',
      'Puxe o halter em direção ao quadril conduzindo o cotovelo para trás.',
      'Desça lentamente até estender o braço sem girar excessivamente o tronco.'
    ],
    tips: ['Evite rodar o tronco para levantar a carga.', 'Não eleve o ombro em direção à orelha.', 'Mantenha o movimento controlado dos dois lados.']
  },
  squat: {
    instructions: [
      'Posicione a barra de forma confortável sobre a parte superior das costas.',
      'Afaste os pés aproximadamente na largura dos ombros, ajustando as pontas conforme sua mobilidade.',
      'Inicie a descida flexionando quadris e joelhos enquanto mantém o tronco estável.',
      'Desça até uma amplitude confortável e segura, mantendo os pés apoiados por inteiro.',
      'Empurre o chão e retorne à posição em pé mantendo joelhos e quadris alinhados.'
    ],
    tips: ['Mantenha os joelhos acompanhando a direção dos pés.', 'Evite perder a estabilidade do tronco.', 'Priorize amplitude segura e técnica antes de aumentar a carga.']
  },
  legpress: {
    instructions: [
      'Sente-se no aparelho com costas e quadril bem apoiados.',
      'Posicione os pés na plataforma em uma base confortável.',
      'Libere a trava e flexione os joelhos controladamente.',
      'Desça até a amplitude em que a lombar permaneça apoiada.',
      'Empurre a plataforma até próximo da extensão dos joelhos, sem travá-los com força.'
    ],
    tips: ['Não deixe o quadril descolar do encosto.', 'Mantenha os joelhos alinhados aos pés.', 'Evite estender os joelhos de forma brusca no topo.']
  },
  extension: {
    instructions: [
      'Ajuste o banco para alinhar o joelho aproximadamente ao eixo da máquina.',
      'Apoie a parte frontal das pernas atrás do rolo acolchoado.',
      'Segure as alças e mantenha o tronco apoiado.',
      'Estenda os joelhos de forma controlada até próximo da extensão completa.',
      'Desça lentamente até retornar à posição inicial.'
    ],
    tips: ['Evite chutar a carga com impulso.', 'Mantenha o quadril apoiado no banco.', 'Use carga que permita controle na subida e na descida.']
  },
  rdl: {
    instructions: [
      'Segure a barra ou os halteres à frente das coxas e mantenha os pés firmes.',
      'Flexione levemente os joelhos e mantenha a coluna neutra.',
      'Leve o quadril para trás enquanto a carga desce próxima às pernas.',
      'Desça até sentir alongamento confortável nos posteriores de coxa.',
      'Contraia glúteos e posteriores para retornar à posição em pé.'
    ],
    tips: ['O movimento principal acontece no quadril.', 'Não arredonde a lombar para ganhar amplitude.', 'Mantenha a carga próxima ao corpo.']
  },
  'curl-leg': {
    instructions: [
      'Deite-se no aparelho e ajuste o rolo próximo à região inferior das pernas.',
      'Mantenha o quadril apoiado e segure as alças.',
      'Flexione os joelhos trazendo o rolo em direção aos glúteos.',
      'Contraia os posteriores no final da subida.',
      'Retorne lentamente até próximo da extensão dos joelhos.'
    ],
    tips: ['Evite levantar o quadril do banco.', 'Não deixe a carga despencar na descida.', 'Use amplitude confortável para os joelhos.']
  },
  hip: {
    instructions: [
      'Apoie a parte superior das costas em um banco e posicione a barra sobre o quadril com proteção adequada.',
      'Mantenha os pés firmes no chão e os joelhos flexionados.',
      'Eleve o quadril contraindo os glúteos.',
      'No topo, mantenha o tronco e as coxas aproximadamente alinhados.',
      'Desça o quadril de maneira controlada e repita.'
    ],
    tips: ['Evite hiperestender a lombar no topo.', 'Mantenha o queixo levemente recolhido.', 'Ajuste a posição dos pés para sentir principalmente os glúteos.']
  },
  curl: {
    instructions: [
      'Fique em pé segurando a barra com as palmas voltadas para frente.',
      'Mantenha os cotovelos próximos ao tronco.',
      'Flexione os cotovelos elevando a barra em direção ao peito.',
      'Contraia o bíceps no topo sem levar os cotovelos muito para frente.',
      'Desça a barra lentamente até a posição inicial.'
    ],
    tips: ['Evite balançar o tronco.', 'Não deixe os cotovelos abrirem para os lados.', 'Controle principalmente a fase de descida.']
  },
  hammer: {
    instructions: [
      'Fique em pé com um halter em cada mão e as palmas voltadas uma para a outra.',
      'Mantenha os cotovelos próximos ao corpo.',
      'Flexione os cotovelos elevando os halteres sem girar os punhos.',
      'Faça uma breve contração no topo.',
      'Desça os halteres lentamente até estender os braços.'
    ],
    tips: ['Mantenha os punhos neutros.', 'Evite usar impulso do corpo.', 'Não projete os cotovelos excessivamente para frente.']
  },
  pushdown: {
    instructions: [
      'Segure a corda ou barra da polia alta e mantenha os cotovelos próximos ao tronco.',
      'Incline-se apenas o necessário para ficar estável.',
      'Estenda os cotovelos levando as mãos em direção às coxas.',
      'Contraia o tríceps no final da extensão.',
      'Retorne lentamente até os antebraços subirem sem mover muito os braços.'
    ],
    tips: ['Mantenha os cotovelos praticamente fixos.', 'Evite usar o peso do corpo para empurrar.', 'Não deixe os ombros avançarem durante o movimento.']
  },
  overtri: {
    instructions: [
      'Segure o halter, barra ou corda acima da cabeça com os braços elevados.',
      'Mantenha os cotovelos apontados para frente e próximos da cabeça.',
      'Flexione os cotovelos levando a carga para trás da cabeça com controle.',
      'Estenda os cotovelos até retornar à posição inicial.',
      'Repita mantendo tronco e ombros estáveis.'
    ],
    tips: ['Evite abrir demais os cotovelos.', 'Não compense arqueando a lombar.', 'Use amplitude que não cause desconforto nos ombros.']
  },
  plank: {
    instructions: [
      'Apoie os antebraços e as pontas dos pés no chão.',
      'Posicione os cotovelos aproximadamente abaixo dos ombros.',
      'Contraia abdômen e glúteos para manter o corpo alinhado.',
      'Mantenha a cabeça em posição neutra e respire normalmente.',
      'Sustente a posição pelo tempo planejado sem perder o alinhamento.'
    ],
    tips: ['Evite deixar o quadril cair ou subir demais.', 'Não prenda a respiração.', 'Interrompa se houver dor lombar ou nos ombros.']
  },
  calf: {
    instructions: [
      'Fique em pé com a parte anterior dos pés apoiada de forma segura.',
      'Mantenha joelhos e quadris estáveis durante o movimento.',
      'Eleve os calcanhares o máximo que conseguir com controle.',
      'Faça uma breve contração das panturrilhas no topo.',
      'Desça lentamente até sentir alongamento confortável.'
    ],
    tips: ['Evite quicar no final do movimento.', 'Distribua a pressão de forma equilibrada no antepé.', 'Use amplitude completa sem perder estabilidade.']
  }
};

showExerciseMedia = async function(ex){
  const dialog=document.getElementById('mediaDialog');
  const content=document.getElementById('mediaContent');
  content.innerHTML=`<div class="media-loading"><span class="media-spinner"></span><strong>Carregando demonstração…</strong></div>`;
  dialog.showModal();
  try{
    const m=await findExerciseMedia(ex);
    if(!m)throw new Error('Demonstração ainda não encontrada para este exercício.');
    const images=m.images?.flat||{};
    const start=images.start||images.main;
    const peak=images.peak||images.main;
    const guide=exerciseGuidesPt[ex.id]||{
      instructions:[
        'Ajuste o equipamento e a posição inicial de forma confortável e estável.',
        'Execute o movimento de forma lenta e controlada, respeitando sua amplitude.',
        'Mantenha o tronco estável e evite usar impulso desnecessário.',
        'Faça a contração do músculo-alvo durante a fase principal do movimento.',
        'Retorne à posição inicial com controle antes de iniciar a próxima repetição.'
      ],
      tips:['Priorize técnica antes de aumentar a carga.','Interrompa o exercício se sentir dor aguda ou desconforto incomum.','Mantenha a respiração regular durante a execução.']
    };
    const instructions=guide.instructions;
    const tips=guide.tips;
    content.innerHTML=`<div class="media-sheet"><div class="media-head"><div><span class="eyebrow">EXECUÇÃO DO EXERCÍCIO</span><h2>${escapeHtml(ex.name)}</h2><p>Demonstração visual alternando posição inicial e final.</p></div><button class="media-close" data-close-media>✕</button></div><div class="motion-demo">${start?`<img class="motion-frame frame-a" src="${REPDB_BASE+start}" alt="Posição inicial de ${escapeHtml(ex.name)}">`:''}${peak?`<img class="motion-frame frame-b" src="${REPDB_BASE+peak}" alt="Posição final de ${escapeHtml(ex.name)}">`:''}<span class="motion-badge">DEMONSTRAÇÃO VISUAL</span></div><div class="media-info-grid"><div><h3>Como executar</h3><ol>${instructions.map(i=>`<li>${escapeHtml(i)}</li>`).join('')}</ol></div><div><h3>Pontos de atenção</h3><ul>${tips.map(i=>`<li>${escapeHtml(i)}</li>`).join('')}</ul><p class="media-credit">Imagens de exercício por <a href="https://repdb.co" target="_blank" rel="noopener noreferrer">RepDB</a>.</p></div></div><div class="media-actions"><a class="btn ghost" href="https://www.youtube.com/results?search_query=${encodeURIComponent(ex.mediaQuery+' execução exercício')}" target="_blank" rel="noopener noreferrer">Ver vídeos no YouTube</a><button class="btn primary" data-close-media>Voltar ao treino</button></div></div>`;
    content.querySelectorAll('[data-close-media]').forEach(b=>b.onclick=()=>dialog.close());
  }catch(err){
    content.innerHTML=`<div class="media-sheet"><div class="media-head"><div><span class="eyebrow">DEMONSTRAÇÃO</span><h2>${escapeHtml(ex.name)}</h2></div><button class="media-close" data-close-media>✕</button></div><div class="media-error"><strong>Conteúdo visual indisponível agora.</strong><p>${escapeHtml(err.message)}</p><a class="btn primary" href="https://www.youtube.com/results?search_query=${encodeURIComponent(ex.mediaQuery+' execução exercício')}" target="_blank" rel="noopener noreferrer">Buscar vídeo demonstrativo</a></div></div>`;
    content.querySelectorAll('[data-close-media]').forEach(b=>b.onclick=()=>dialog.close());
  }
};
