# Vaz Fitness — MVP 0.2

PWA mobile-first de treino adaptativo com musculação, corrida, progressão por percepção de esforço e AION IA.

## O que já funciona
- Onboarding por modalidade: Híbrido, Musculação ou Corrida
- Objetivo, nível, dias/semana, tempo por treino e músculo prioritário
- Plano semanal automático
- Treino ao vivo com cronômetro, séries, carga e repetições
- Feedback por exercício: Fácil / Moderado / Difícil
- Sugestão de próxima carga conforme esforço
- Resumo pós-treino com volume e músculos estimulados
- Falta no treino com redistribuição conservadora de volume
- Corrida com pace sugerido e adaptação por esforço
- Evolução de volume, cargas e percepção de esforço
- **AION IA com Gemini através de rota server-side `/api/aion`**
- Fallback local da AION se a API estiver indisponível
- **Demonstração visual de exercícios com RepDB** (posição inicial/final com transição animada)
- Link complementar de busca no YouTube
- Persistência local via `localStorage`
- PWA instalável

## Gemini / AION IA
Nunca coloque a chave nos arquivos do frontend.

No Vercel, configure:
- `GEMINI_API_KEY`
- `GEMINI_MODEL=gemini-3.8-flash`

O frontend chama `/api/aion`; somente a função server-side acessa a chave.

## Biblioteca visual de exercícios
O app consulta o dataset público da RepDB em tempo de execução e mostra duas poses do exercício com animação por transição. O dataset gratuito permite uso pessoal e comercial dentro de aplicações com atribuição.

Crédito obrigatório usado no app:
`Exercise data by RepDB (repdb.co)`

Não copie/redistribua o dataset como um novo dataset/API e não use as imagens da RepDB como entrada/referência para modelos generativos.

## Deploy no Vercel
1. Importe o repositório `thcvaz22/Vaz-Fitness` no Vercel.
2. Use o framework preset `Other`.
3. Adicione as variáveis de ambiente acima.
4. Faça o deploy.
5. Teste `/api/health` — `aion: true` indica que a chave está configurada.

## Desenvolvimento local
A interface pode ser testada como site estático, mas `/api/aion` precisa de ambiente Node/Vercel para funcionar.

```bash
npm install
npx vercel dev
```

## Organização do frontend
- `app-core.js`: perfil, biblioteca de exercícios, mídia e geração do plano
- `app-ui.js`: telas e treino ao vivo
- `app-training.js`: séries, esforço, progressão, resumo e faltas
- `app-ai.js`: evolução, AION, perfil e bootstrap

## Próximos passos
- autenticação e banco multiusuário
- histórico sincronizado entre dispositivos
- ações estruturadas da AION para alterar o treino com confirmação
- check-in de recuperação/sono/dor
- GPS e integrações de corrida
- notificações push
- curadoria de vídeos YouTube incorporáveis por exercício
