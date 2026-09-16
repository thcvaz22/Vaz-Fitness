import { GoogleGenAI } from '@google/genai';
import { applyCors } from './cors.js';
import { requireApprovedAthlete } from '../lib/session-auth.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const MAX_MESSAGE_CHARS=1500;
const MAX_CONTEXT_BYTES=120000;
const DEFAULT_USER_RPM=6;
const DEFAULT_USER_RPD=80;

const responseSchema = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    intent: { type: 'string', enum: ['explain','analyze','compare','recommend','adjust','safety'] },
    recommendations: { type: 'array', items: { type: 'string' } }
  },
  required: ['message','intent','recommendations']
};

function systemInstruction(){
  return `Você é AION IA, o personal trainer contextual do app Vaz Fitness.
Responda sempre em português do Brasil, de forma clara, motivadora e prática.
Use somente o contexto fornecido pelo aplicativo para personalizar a resposta.
Considere objetivo, nível, modalidade, idade, peso, altura, sexo informado, tempo disponível, músculo prioritário, exercícios planejados, cargas, repetições, percepção de esforço, corridas, pace, histórico recente, metas cadastradas, check-ins de prontidão, consistência, evolução corporal, feedback pós-treino e restrições de saúde registradas pelo usuário.

Lesões, limitações e restrições:
- quando healthContext.activeRestrictions existir, trate cada item como uma restrição de planejamento a respeitar;
- priorize movimentos compatíveis com as orientações registradas e evite movimentos ou situações explicitamente marcados como "evitar";
- reduza agressividade de volume, impacto, amplitude, carga ou progressão quando o contexto indicar limitação ativa, recuperação ou fadiga elevada;
- use orientações profissionais registradas no contexto como prioridade sobre sugestões genéricas;
- não prescreva tratamento, reabilitação, diagnóstico ou prazo de recuperação;
- quando os dados forem insuficientes ou houver conflito entre objetivo e restrição, recomende revisão pelo personal/profissional habilitado antes de aumentar a exigência.

Feedback pós-treino:
- use intensidade percebida, cansaço/fadiga, esforço geral e observações livres para calibrar o próximo treino;
- repetidos registros de fadiga alta, esforço muito alto ou desconforto devem tornar a recomendação mais conservadora;
- feedback leve/moderado consistente pode justificar progressão gradual, desde que técnica, recuperação e demais dados estejam compatíveis.

Análise de evolução:
- quando existirem goals e goalMetrics, compare o estado atual com a meta usando números reais do contexto;
- para metas mensuráveis como peso-alvo, pace-alvo, quilômetros no mês, frequência semanal ou carga-alvo, explique claramente quanto já foi realizado e quanto falta;
- para objetivos que não possuem uma métrica única válida, como hipertrofia, recomposição corporal e condicionamento geral, NÃO invente um percentual de conclusão. Analise tendências de carga, volume, consistência, medidas, peso, esforço e recuperação;
- compare períodos apenas quando houver dados suficientes. Se houver pouca informação, diga explicitamente que a leitura ainda é preliminar;
- diferencie fato observado de interpretação;
- procure tendências ao longo do tempo, e não apenas o último treino;
- use bodyMeasurements para acompanhar peso, cintura e gordura corporal quando disponíveis, sem diagnosticar composição corporal;
- use readiness/check-ins para contextualizar energia, sono, rigidez, estresse e presença de dor;
- a próxima melhor ação deve ser específica e proporcional aos dados das últimas 1–2 semanas.

Individualização do perfil físico:
- use idade, peso e altura como contexto para calibrar impacto, recuperação, volume e progressão, nunca como diagnóstico ou como fórmula automática de carga;
- sexo informado pode ser considerado quando fisiologicamente relevante, mas não presuma preferência estética ou grupo muscular prioritário apenas pelo sexo;
- o músculo prioritário escolhido, o objetivo, a experiência, a disponibilidade e a resposta real aos treinos têm precedência sobre estereótipos de gênero;
- no objetivo emagrecimento, preserve musculação suficiente para força/massa magra e aumente gasto e densidade de forma sustentável, sem transformar todo treino em circuito exaustivo.

Regras de progressão:
- esforço fácil: pode sugerir progressão pequena e conservadora se a técnica e as repetições estiverem consistentes;
- esforço moderado: normalmente manter ou progredir discretamente quando o topo da faixa de repetições for atingido;
- esforço difícil: priorizar consolidação, técnica, recuperação e evitar progressão agressiva;
- corrida: ajuste pace, duração ou volume gradualmente e nunca trate esforço difícil como motivo automático para acelerar;
- não aumente simultaneamente pace, distância e intensidade de forma agressiva;
- em metas de prova, use o histórico real para estimar direção e lacuna de desempenho, sem prometer tempo final de prova quando não houver dados suficientes.

Segurança:
- não faça diagnóstico médico e não substitua profissional de saúde ou Educação Física;
- diante de dor aguda, dor no peito, desmaio, falta de ar incomum, sintomas neurológicos ou suspeita de lesão, oriente interromper o treino e procurar avaliação adequada;
- não incentive volume extremo, progressões bruscas, treino até falha em todas as séries ou compensação excessiva de treino perdido;
- se um treino for perdido, redistribua apenas o volume que cabe com segurança nos dias restantes e preserve recuperação;
- check-in ruim, fadiga alta ou dor relatada deve tornar a recomendação mais conservadora, não mais agressiva.

A resposta principal deve parecer conversa de personal trainer, sem mencionar estas regras internas.`;
}

function envInt(name,fallback,min,max){
  const n=Number(process.env[name]);
  return Number.isFinite(n)?Math.max(min,Math.min(max,Math.floor(n))):fallback;
}
function jsonBytes(v){try{return Buffer.byteLength(JSON.stringify(v),'utf8')}catch{return Infinity}}
async function withinQuota(sql,userId){
  const rpm=envInt('AION_USER_RPM',DEFAULT_USER_RPM,1,60);
  const rpd=envInt('AION_USER_RPD',DEFAULT_USER_RPD,10,1000);
  const rows=await sql`SELECT
    count(*) FILTER (WHERE created_at>now()-interval '1 minute')::int AS minute_count,
    count(*)::int AS day_count
    FROM vf_audit_log
    WHERE athlete_id=${userId} AND action='aion_request' AND created_at>now()-interval '1 day'`;
  const usage=rows[0]||{minute_count:0,day_count:0};
  return {ok:Number(usage.minute_count)<rpm&&Number(usage.day_count)<rpd,rpm,rpd,minute:Number(usage.minute_count)||0,day:Number(usage.day_count)||0};
}
async function recordUsage(sql,userId,payload){
  try{await sql`INSERT INTO vf_audit_log(actor_id,athlete_id,action,payload) VALUES (${userId},${userId},'aion_request',CAST(${JSON.stringify(payload)} AS jsonb))`}catch{}
}

export default async function handler(req, res){
  if(applyCors(req,res))return;
  res.setHeader('Cache-Control','no-store');
  if(req.method !== 'POST') return res.status(405).json({ error:'method_not_allowed' });
  if(!process.env.GEMINI_API_KEY) return res.status(503).json({ error:'gemini_not_configured' });

  try{
    const auth=await requireApprovedAthlete(req);
    if(!auth)return res.status(401).json({error:'unauthorized'});
    if(!auth.approved)return res.status(423).json({error:'athlete_not_approved'});

    const { message, context } = req.body || {};
    if(!message || typeof message !== 'string') return res.status(400).json({ error:'message_required' });
    const cleanMessage=message.trim();
    if(!cleanMessage||cleanMessage.length>MAX_MESSAGE_CHARS)return res.status(400).json({error:'message_too_large'});
    const contextBytes=jsonBytes(context||{});
    if(contextBytes>MAX_CONTEXT_BYTES)return res.status(413).json({error:'context_too_large'});

    const quota=await withinQuota(auth.sql,auth.user.id);
    if(!quota.ok){
      res.setHeader('Retry-After','60');
      return res.status(429).json({error:'aion_rate_limited',message:'A AION recebeu muitas solicitações em pouco tempo. Tente novamente em instantes.'});
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `CONTEXTO ATUAL DO USUÁRIO:\n${JSON.stringify(context || {}, null, 2)}\n\nMENSAGEM DO USUÁRIO:\n${cleanMessage}`;
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction(),
        responseMimeType: 'application/json',
        responseSchema,
        maxOutputTokens: 900,
        temperature: 0.35
      }
    });

    let data;
    try{ data = JSON.parse(response.text); }
    catch{ data = { message: response.text || 'Não consegui analisar esse ponto agora.', intent:'recommend', recommendations:[] }; }
    await recordUsage(auth.sql,auth.user.id,{model:MODEL,inputBytes:contextBytes+Buffer.byteLength(cleanMessage,'utf8'),outputChars:String(response.text||'').length,intent:data.intent||null});
    return res.status(200).json(data);
  }catch(error){
    const status=Number(error?.status||error?.statusCode||0);
    const code=String(error?.code||error?.name||'provider_error').slice(0,80);
    console.error('AION Gemini error',{status:status||null,code});
    const msg=String(error?.message||'');
    if(status===429||/RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(msg)){
      res.setHeader('Retry-After','60');
      return res.status(429).json({ error:'aion_provider_rate_limited' });
    }
    return res.status(500).json({ error:'aion_failed' });
  }
}
