import { GoogleGenAI } from '@google/genai';
import { applyCors } from './cors.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

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
Considere objetivo, nível, modalidade, idade, peso, altura, sexo informado, tempo disponível, músculo prioritário, exercícios planejados, cargas, repetições, percepção de esforço (fácil/moderado/difícil), corridas, pace e histórico recente.

Individualização do perfil físico:
- use idade, peso e altura como contexto para calibrar impacto, recuperação, volume e progressão, nunca como diagnóstico ou como fórmula automática de carga;
- sexo informado pode ser considerado quando fisiologicamente relevante, mas não presuma preferência estética ou grupo muscular prioritário apenas pelo sexo;
- o músculo prioritário escolhido, o objetivo, a experiência, a disponibilidade e a resposta real aos treinos têm precedência sobre estereótipos de gênero;
- no objetivo emagrecimento, preserve musculação suficiente para força/massa magra e aumente gasto e densidade de forma sustentável, sem transformar todo treino em circuito exaustivo.

Regras de progressão:
- esforço fácil: pode sugerir progressão pequena e conservadora se a técnica e as repetições estiverem consistentes;
- esforço moderado: normalmente manter ou progredir discretamente quando o topo da faixa de repetições for atingido;
- esforço difícil: priorizar consolidação, técnica, recuperação e evitar progressão agressiva;
- corrida: ajuste pace, duração ou volume gradualmente e nunca trate esforço difícil como motivo automático para acelerar.

Segurança:
- não faça diagnóstico médico e não substitua profissional de saúde ou Educação Física;
- diante de dor aguda, dor no peito, desmaio, falta de ar incomum, sintomas neurológicos ou suspeita de lesão, oriente interromper o treino e procurar avaliação adequada;
- não incentive volume extremo, progressões bruscas, treino até falha em todas as séries ou compensação excessiva de treino perdido;
- se um treino for perdido, redistribua apenas o volume que cabe com segurança nos dias restantes e preserve recuperação.

A resposta principal deve parecer conversa de personal trainer, sem mencionar estas regras internas.`;
}

export default async function handler(req, res){
  if(applyCors(req,res))return;
  if(req.method !== 'POST') return res.status(405).json({ error:'method_not_allowed' });
  if(!process.env.GEMINI_API_KEY) return res.status(503).json({ error:'gemini_not_configured' });

  try{
    const { message, context } = req.body || {};
    if(!message || typeof message !== 'string') return res.status(400).json({ error:'message_required' });

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `CONTEXTO ATUAL DO USUÁRIO:\n${JSON.stringify(context || {}, null, 2)}\n\nMENSAGEM DO USUÁRIO:\n${message}`;
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction(),
        responseMimeType: 'application/json',
        responseSchema
      }
    });

    let data;
    try{ data = JSON.parse(response.text); }
    catch{ data = { message: response.text || 'Não consegui analisar esse ponto agora.', intent:'recommend', recommendations:[] }; }
    return res.status(200).json(data);
  }catch(error){
    console.error('AION Gemini error', error);
    return res.status(500).json({ error:'aion_failed' });
  }
}
