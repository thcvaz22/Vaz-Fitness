# Vaz Fitness — arquitetura de produção sugerida

## Camadas
1. App web/PWA (Next.js ou equivalente)
2. API autenticada
3. Postgres
4. Motor de prescrição determinístico
5. AION IA com tools estruturadas
6. Biblioteca de mídia de exercícios
7. Integrações de saúde/corrida
8. Observabilidade e auditoria de decisões da IA

## Entidades principais
- users
- athlete_profiles
- goals
- training_cycles
- weekly_plans
- workout_sessions
- workout_exercises
- workout_sets
- exercise_effort_feedback
- exercise_library
- muscle_activation_map
- running_sessions
- running_intervals
- readiness_checkins
- progress_metrics
- body_measurements
- aion_conversations
- aion_actions
- notifications

## Regras importantes
- O LLM nunca altera diretamente o banco sem uma ação estruturada validada.
- O motor de prescrição calcula limites de volume/intensidade e a AION atua dentro deles.
- Toda alteração automática relevante deve guardar: motivo, dados usados e plano anterior/novo.
- Reorganização por falta deve respeitar tempo disponível, recuperação e teto de volume por sessão.
- Histórico de carga e esforço precisa ser separado por exercício/variação/equipamento.

## Fases
### Fase 1
Onboarding, musculação, treino ao vivo, carga/reps/esforço, resumo, evolução, ausência, AION.

### Fase 2
Corrida completa, calendário híbrido, GPS/Health Connect/Apple Health, zonas e métricas avançadas.

### Fase 3
Integração Garmin/Strava, painel de treinador, desafios, assinatura e personalização avançada.

## Camada de mídia dos exercícios
Para o MVP, usar RepDB free-tier remotamente, sem republicar o dataset. A interface busca `exercises.json` na origem oficial e usa as imagens `start/peak` para uma transição visual. Manter atribuição visível no modal/créditos.

Vídeos podem ser adicionados depois como metadado curado (`youtubeId`) e exibidos pelo player incorporado oficial. Não baixar, recortar ou re-hospedar vídeos de terceiros sem licença.

## Segredos
Nunca expor `GEMINI_API_KEY` no frontend, Service Worker, manifest ou repositório. Em produção, configurar a variável no Vercel para Preview e Production e validar em `/api/health`.
