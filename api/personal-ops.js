import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { GoogleGenAI } from '@google/genai';
import { applyCors } from './cors.js';

const MODEL=process.env.GEMINI_MODEL||'gemini-3.8-flash';
const CYCLE_DAYS=new Set([30,45,60,90]);
const DEFAULT_PERSONAL_RPM=3;
const DEFAULT_PERSONAL_RPD=40;

function db(){if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL não configurada.');return neon(process.env.DATABASE_URL)}
function tokenHash(token){return crypto.createHash('sha256').update(String(token)).digest('hex')}
function clean(v='',max=160){return String(v??'').trim().slice(0,max)}
function sendError(res,status,message,code='error'){return res.status(status).json({ok:false,error:code,message})}
function isoDate(v){const m=String(v||'').match(/^\d{4}-\d{2}-\d{2}$/);return m?m[0]:null}
function money(v){if(v===''||v==null)return null;const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=99999999?n:null}
function todayISO(){return new Date().toISOString().slice(0,10)}
function envInt(name,fallback,min,max){const n=Number(process.env[name]);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.floor(n))):fallback}
function addMonths(dateStr,months=1,preferredDay=null){
  const [y,m,d]=String(dateStr).split('-').map(Number);const day=preferredDay||d;
  const first=new Date(Date.UTC(y,m-1+months,1));
  const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  return `${first.getUTCFullYear()}-${String(first.getUTCMonth()+1).padStart(2,'0')}-${String(Math.min(day,last)).padStart(2,'0')}`;
}
async function authenticate(req){
  const header=String(req.headers?.authorization||'');const token=header.startsWith('Bearer ')?header.slice(7).trim():'';
  if(!token)return null;const sql=db();
  const rows=await sql`SELECT u.id,u.role,u.name,u.public_code,u.account_status FROM vf_sessions s JOIN vf_users u ON u.id=s.user_id WHERE s.token_hash=${tokenHash(token)} AND s.expires_at>now() LIMIT 1`;
  const user=rows[0]||null;if(!user||user.role!=='personal'||user.account_status!=='approved')return null;return {sql,user};
}
async function linked(sql,personalId,athleteId){
  const rows=await sql`SELECT a.athlete_id,a.status,a.profile_submitted_at,u.name,u.public_code FROM vf_athlete_access a JOIN vf_users u ON u.id=a.athlete_id WHERE a.athlete_id=${athleteId} AND a.personal_id=${personalId} LIMIT 1`;
  return rows[0]||null;
}
async function audit(sql,actorId,athleteId,action,payload={}){try{await sql`INSERT INTO vf_audit_log (actor_id,athlete_id,action,payload) VALUES (${actorId},${athleteId},${action},CAST(${JSON.stringify(payload)} AS jsonb))`}catch{}}
async function personalAionQuota(sql,personalId){
  const rpm=envInt('AION_PERSONAL_RPM',DEFAULT_PERSONAL_RPM,1,30),rpd=envInt('AION_PERSONAL_RPD',DEFAULT_PERSONAL_RPD,5,500);
  const rows=await sql`SELECT
    count(*) FILTER (WHERE created_at>now()-interval '1 minute')::int AS minute_count,
    count(*)::int AS day_count
    FROM vf_audit_log
    WHERE actor_id=${personalId} AND action='aion_plan_suggested' AND created_at>now()-interval '1 day'`;
  const usage=rows[0]||{};return {ok:Number(usage.minute_count||0)<rpm&&Number(usage.day_count||0)<rpd,rpm,rpd};
}
function cycleInfo(row={}){
  const end=row.cycle_ends_at?new Date(row.cycle_ends_at):null;const now=new Date();
  const daysLeft=end?Math.ceil((end.getTime()-now.getTime())/86400000):null;
  return {days:Number(row.cycle_days)||30,startedAt:row.cycle_started_at||null,endsAt:row.cycle_ends_at||null,daysLeft,status:!end?'not_started':daysLeft<0?'expired':daysLeft<=7?'due_soon':'active'};
}
function billingInfo(row={}){
  const due=row.next_due_date?String(row.next_due_date).slice(0,10):null;const pending=!!row.force_pending||(due&&due<=todayISO());
  return {configured:!!due,amount:row.monthly_amount==null?null:Number(row.monthly_amount),billingDay:row.billing_day||null,nextDueDate:due,forcePending:!!row.force_pending,status:!due?'not_configured':pending?'pending':'current'};
}
const planSchema={
  type:'object',properties:{
    summary:{type:'string'},reasons:{type:'array',items:{type:'string'}},
    plan:{type:'array',items:{type:'object',properties:{
      id:{type:'string'},type:{type:'string',enum:['strength','run']},name:{type:'string'},day:{type:'integer'},duration:{type:'integer'},status:{type:'string'},pace:{type:'string'},intensity:{type:'string'},
      exercises:{type:'array',items:{type:'object',properties:{id:{type:'string'},name:{type:'string'},muscle:{type:'string'},secondary:{type:'array',items:{type:'string'}},sets:{type:'integer'},reps:{type:'string'},load:{type:'number'},rest:{type:'integer'},icon:{type:'string'},priority:{type:'boolean'}},required:['id','name','muscle','sets','reps','rest']}}
    },required:['id','type','name','day','duration']}}
  },required:['summary','reasons','plan']
};
function planInstruction(){return `Você é AION IA apoiando um profissional de Educação Física na revisão de um plano de treino. Gere somente um RASCUNHO estruturado para revisão humana. Use exclusivamente os dados recebidos. Responda em português do Brasil.
Regras gerais: respeite modalidade, objetivo, níveis separados, disponibilidade semanal e tempo por sessão; considere histórico recente, progressão de cargas, esforço, consistência, prontidão, peso/medidas, corrida e feedback pós-treino; evite aumentos bruscos de volume/intensidade; para corrida não aumente simultaneamente distância, pace e intensidade de forma agressiva; para emagrecimento preserve musculação e progressão sustentável; para hipertrofia use volume recuperável e progressão; mantenha exercícios adequados e comuns; se faltarem dados, seja conservador.
Lesões e limitações: leia healthContext e healthRecords antes de escolher exercícios. Restrições ativas, movimentos marcados como evitar/limitar e orientações profissionais registradas devem ser respeitados no rascunho. Ajuste seleção de exercícios, impacto, amplitude, volume, carga e progressão de forma conservadora. Não faça diagnóstico, não prescreva tratamento ou reabilitação e não estime prazo de cura. Se a restrição for relevante, ambígua ou incompatível com o objetivo, sinalize isso em reasons para o personal revisar antes de liberar.
Feedback: considere intensidade percebida, fadiga/cansaço, esforço geral e observações dos treinos recentes. Fadiga alta repetida, esforço muito alto ou desconforto relatado deve reduzir a agressividade da progressão.
O personal fará a decisão final e poderá alterar cada exercício antes de liberar.`}

export default async function handler(req,res){
  if(applyCors(req,res))return;
  res.setHeader('Cache-Control','no-store');
  const auth=await authenticate(req);if(!auth)return sendError(res,401,'Sessão inválida ou conta indisponível.','unauthorized');
  const {sql,user}=auth;const action=String(req.query?.action||req.body?.action||'').trim();
  try{
    if(req.method==='GET'&&action==='summary'){
      const rows=await sql`SELECT u.id,u.name,u.public_code,a.status,p.plan_version,p.cycle_days,p.cycle_started_at,p.cycle_ends_at,b.monthly_amount,b.billing_day,b.next_due_date,b.force_pending
        FROM vf_athlete_access a JOIN vf_users u ON u.id=a.athlete_id
        LEFT JOIN vf_training_plans p ON p.athlete_id=u.id LEFT JOIN vf_billing_accounts b ON b.athlete_id=u.id
        WHERE a.personal_id=${user.id} ORDER BY u.name`;
      const clients=rows.map(r=>({id:r.id,name:r.name,publicCode:r.public_code,accessStatus:r.status,planVersion:Number(r.plan_version)||0,cycle:cycleInfo(r),billing:billingInfo(r)}));
      const alerts=[];for(const c of clients){if(c.cycle.status==='expired')alerts.push({kind:'cycle',severity:'danger',athleteId:c.id,name:c.name,message:'Treino vencido — precisa de novo ciclo.'});else if(c.cycle.status==='due_soon')alerts.push({kind:'cycle',severity:'warning',athleteId:c.id,name:c.name,message:`Treino vence em ${Math.max(0,c.cycle.daysLeft)} dia(s).`});if(c.billing.status==='pending')alerts.push({kind:'billing',severity:'danger',athleteId:c.id,name:c.name,message:`Mensalidade pendente${c.billing.nextDueDate?` desde ${c.billing.nextDueDate}`:''}.`})}
      return res.status(200).json({ok:true,clients,alerts,counts:{cycleReview:clients.filter(c=>['expired','due_soon'].includes(c.cycle.status)).length,billingPending:clients.filter(c=>c.billing.status==='pending').length}});
    }
    if(req.method==='GET'&&action==='client'){
      const athleteId=clean(req.query?.athleteId,120);const client=await linked(sql,user.id,athleteId);if(!client)return sendError(res,404,'Aluno não encontrado.','not_found');
      const plans=await sql`SELECT plan_version,cycle_days,cycle_started_at,cycle_ends_at FROM vf_training_plans WHERE athlete_id=${athleteId} LIMIT 1`;
      const bills=await sql`SELECT monthly_amount,billing_day,next_due_date,force_pending,notes FROM vf_billing_accounts WHERE athlete_id=${athleteId} LIMIT 1`;
      const history=await sql`SELECT id,due_date,amount,status,paid_at,notes FROM vf_payment_history WHERE athlete_id=${athleteId} ORDER BY due_date DESC LIMIT 12`;
      return res.status(200).json({ok:true,cycle:cycleInfo(plans[0]||{}),billing:billingInfo(bills[0]||{}),billingNotes:bills[0]?.notes||'',payments:history});
    }
    if(req.method==='POST'&&action==='cycle'){
      const athleteId=clean(req.body?.athleteId,120);const client=await linked(sql,user.id,athleteId);if(!client)return sendError(res,404,'Aluno não encontrado.','not_found');
      const days=Number(req.body?.cycleDays);if(!CYCLE_DAYS.has(days))return sendError(res,400,'Escolha 30, 45, 60 ou 90 dias.','invalid_cycle');
      const mode=String(req.body?.mode||'configure');const exists=await sql`SELECT athlete_id FROM vf_training_plans WHERE athlete_id=${athleteId} LIMIT 1`;if(!exists.length)return sendError(res,409,'Salve um plano antes de configurar o ciclo.','plan_required');
      if(mode==='start'||mode==='renew'){
        const end=new Date(Date.now()+days*86400000).toISOString();await sql`UPDATE vf_training_plans SET cycle_days=${days},cycle_started_at=now(),cycle_ends_at=${end},updated_at=now() WHERE athlete_id=${athleteId}`;
        await audit(sql,user.id,athleteId,mode==='renew'?'cycle_renewed':'cycle_started',{days});
      }else{await sql`UPDATE vf_training_plans SET cycle_days=${days},updated_at=now() WHERE athlete_id=${athleteId}`;await audit(sql,user.id,athleteId,'cycle_configured',{days})}
      const rows=await sql`SELECT cycle_days,cycle_started_at,cycle_ends_at FROM vf_training_plans WHERE athlete_id=${athleteId} LIMIT 1`;return res.status(200).json({ok:true,cycle:cycleInfo(rows[0]||{})});
    }
    if(req.method==='POST'&&action==='billing_config'){
      const athleteId=clean(req.body?.athleteId,120);const client=await linked(sql,user.id,athleteId);if(!client)return sendError(res,404,'Aluno não encontrado.','not_found');
      const due=isoDate(req.body?.dueDate);if(!due)return sendError(res,400,'Informe uma data de vencimento válida.','invalid_due_date');const amount=money(req.body?.amount);const notes=clean(req.body?.notes,500);const day=Number(due.slice(8,10));
      await sql`INSERT INTO vf_billing_accounts (athlete_id,personal_id,monthly_amount,billing_day,next_due_date,force_pending,notes,updated_at) VALUES (${athleteId},${user.id},${amount},${day},${due},false,${notes||null},now())
        ON CONFLICT (athlete_id) DO UPDATE SET personal_id=EXCLUDED.personal_id,monthly_amount=EXCLUDED.monthly_amount,billing_day=EXCLUDED.billing_day,next_due_date=EXCLUDED.next_due_date,force_pending=false,notes=EXCLUDED.notes,updated_at=now()`;
      const id=`pay_${crypto.randomUUID()}`;await sql`INSERT INTO vf_payment_history (id,athlete_id,personal_id,due_date,amount,status) VALUES (${id},${athleteId},${user.id},${due},${amount},'pending') ON CONFLICT (athlete_id,due_date) DO UPDATE SET amount=EXCLUDED.amount,personal_id=EXCLUDED.personal_id,updated_at=now()`;
      await audit(sql,user.id,athleteId,'billing_configured',{dueDate:due,amount});return res.status(200).json({ok:true,billing:billingInfo({monthly_amount:amount,billing_day:day,next_due_date:due,force_pending:false})});
    }
    if(req.method==='POST'&&action==='billing_mark'){
      const athleteId=clean(req.body?.athleteId,120);const client=await linked(sql,user.id,athleteId);if(!client)return sendError(res,404,'Aluno não encontrado.','not_found');
      const rows=await sql`SELECT monthly_amount,billing_day,next_due_date,force_pending FROM vf_billing_accounts WHERE athlete_id=${athleteId} AND personal_id=${user.id} LIMIT 1`;const b=rows[0];if(!b?.next_due_date)return sendError(res,409,'Configure primeiro a data da mensalidade.','billing_not_configured');
      const status=String(req.body?.status||'');const due=String(b.next_due_date).slice(0,10);const amount=b.monthly_amount==null?null:Number(b.monthly_amount);const id=`pay_${crypto.randomUUID()}`;
      if(status==='paid'){
        await sql`INSERT INTO vf_payment_history (id,athlete_id,personal_id,due_date,amount,status,paid_at,updated_at) VALUES (${id},${athleteId},${user.id},${due},${amount},'paid',now(),now()) ON CONFLICT (athlete_id,due_date) DO UPDATE SET status='paid',paid_at=now(),amount=EXCLUDED.amount,updated_at=now()`;
        const next=addMonths(due,1,Number(b.billing_day)||Number(due.slice(8,10)));await sql`UPDATE vf_billing_accounts SET next_due_date=${next},force_pending=false,updated_at=now() WHERE athlete_id=${athleteId}`;
        const nextId=`pay_${crypto.randomUUID()}`;await sql`INSERT INTO vf_payment_history (id,athlete_id,personal_id,due_date,amount,status) VALUES (${nextId},${athleteId},${user.id},${next},${amount},'pending') ON CONFLICT (athlete_id,due_date) DO NOTHING`;
        await audit(sql,user.id,athleteId,'payment_marked_paid',{dueDate:due,nextDueDate:next,amount});return res.status(200).json({ok:true,nextDueDate:next,status:'current'});
      }
      if(status==='pending'){
        await sql`UPDATE vf_billing_accounts SET force_pending=true,updated_at=now() WHERE athlete_id=${athleteId}`;await sql`INSERT INTO vf_payment_history (id,athlete_id,personal_id,due_date,amount,status,updated_at) VALUES (${id},${athleteId},${user.id},${due},${amount},'pending',now()) ON CONFLICT (athlete_id,due_date) DO UPDATE SET status='pending',paid_at=NULL,updated_at=now()`;await audit(sql,user.id,athleteId,'payment_marked_pending',{dueDate:due});return res.status(200).json({ok:true,status:'pending'});
      }
      return sendError(res,400,'Status de pagamento inválido.','invalid_status');
    }
    if(req.method==='POST'&&action==='suggest_plan'){
      if(!process.env.GEMINI_API_KEY)return sendError(res,503,'AION não configurada.','aion_not_configured');
      const athleteId=clean(req.body?.athleteId,120);const client=await linked(sql,user.id,athleteId);if(!client)return sendError(res,404,'Aluno não encontrado.','not_found');
      const quota=await personalAionQuota(sql,user.id);if(!quota.ok){res.setHeader('Retry-After','60');return sendError(res,429,'A AION recebeu muitas gerações de treino em pouco tempo. Tente novamente em instantes.','aion_rate_limited')}
      const stateRows=await sql`SELECT state FROM vf_cloud_state WHERE user_id=${athleteId} LIMIT 1`;const planRows=await sql`SELECT plan,plan_version,cycle_days FROM vf_training_plans WHERE athlete_id=${athleteId} LIMIT 1`;const state=stateRows[0]?.state||{},currentPlan=planRows[0]?.plan||[];
      const recentStrength=(state.sessions||[]).slice(-12),recentRuns=(state.runSessions||[]).slice(-12);
      const recentWorkoutFeedback=[...recentStrength,...recentRuns].map(s=>({date:s.date,name:s.name,feedback:s.sessionFeedback||null})).filter(x=>x.feedback).slice(-12);
      const context={profile:state.profile||{},goals:state.goals||{},healthContext:state.profile?.healthContext||{},healthRecords:(state.healthRecords||[]).slice(-20),recentWorkoutFeedback,bodyMeasurements:(state.bodyMeasurements||[]).slice(-12),readiness:(state.readinessCheckins||[]).slice(-10),recentStrength,recentRuns,calendar:(state.calendarEvents||[]).slice(-60),currentPlan,cycleDays:Number(planRows[0]?.cycle_days)||30};
      const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});const response=await ai.models.generateContent({model:MODEL,contents:`DADOS DO ALUNO E PLANO ATUAL:\
${JSON.stringify(context,null,2)}\
\
Crie uma sugestão de próximo ciclo. Antes de escolher exercícios, verifique lesões, limitações, movimentos a evitar e feedbacks recentes. Preserve a quantidade de dias compatível com a disponibilidade do aluno. Para dias de musculação, inclua exercícios, séries, faixa de repetições e descanso. Para corrida, inclua duração, pace/intensidade quando houver base suficiente.`,config:{systemInstruction:planInstruction(),responseMimeType:'application/json',responseSchema:planSchema,maxOutputTokens:2600,temperature:0.3}});
      let data;try{data=JSON.parse(response.text)}catch{return sendError(res,502,'AION retornou uma sugestão inválida. Tente novamente.','invalid_ai_output')}
      if(!Array.isArray(data.plan)||!data.plan.length)return sendError(res,502,'AION não conseguiu montar o plano agora.','empty_ai_plan');
      await audit(sql,user.id,athleteId,'aion_plan_suggested',{days:data.plan.length,model:MODEL,healthRestrictions:Number(context.healthContext?.activeRestrictions?.length)||0,feedbacks:recentWorkoutFeedback.length});return res.status(200).json({ok:true,...data});
    }
    return sendError(res,404,'Rota não encontrada.','not_found');
  }catch(error){
    const status=Number(error?.status||error?.statusCode||0),code=String(error?.code||error?.name||'provider_error').slice(0,80),msg=String(error?.message||'');
    console.error('Vaz Personal ops error',{action,status:status||null,code});
    if(status===429||/RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(msg)){res.setHeader('Retry-After','60');return sendError(res,429,'A AION está temporariamente no limite. Tente novamente em instantes.','aion_provider_rate_limited')}
    if(msg.includes('relation')||msg.includes('column'))return sendError(res,503,'A estrutura de ciclos e mensalidades ainda precisa ser ativada no banco.','migration_required');return sendError(res,500,'Não foi possível concluir esta operação agora.','server_error')}
}
