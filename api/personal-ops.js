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
function isObject(v){return v&&typeof v==='object'&&!Array.isArray(v)}
function jsonSize(v){try{return Buffer.byteLength(JSON.stringify(v),'utf8')}catch{return Infinity}}
function validPlan(plan){return Array.isArray(plan)&&plan.length>0&&plan.length<=21&&jsonSize(plan)<=500000&&plan.every(day=>isObject(day)&&['strength','run'].includes(day.type)&&clean(day.name,100).length>0&&Number.isFinite(Number(day.duration||0))&&Number(day.duration||0)>=0&&Number(day.duration||0)<=300&&(!day.exercises||Array.isArray(day.exercises))&&(!day.exercises||day.exercises.length<=30))}
function sendError(res,status,message,code='error'){return res.status(status).json({ok:false,error:code,message})}
function isoDate(v){const m=String(v||'').match(/^\d{4}-\d{2}-\d{2}$/);return m?m[0]:null}
function money(v){if(v===''||v==null)return null;const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=99999999?n:null}
function phone(v=''){const digits=String(v||'').replace(/\D/g,'').slice(0,15);return digits.length>=10?digits:null}
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
async function ensureAdvancedTables(sql){
  await sql`CREATE TABLE IF NOT EXISTS vf_plan_change_requests (
    id text PRIMARY KEY,athlete_id text NOT NULL,personal_id text,reason text NOT NULL,
    rest_days jsonb NOT NULL DEFAULT '[]'::jsonb,status text NOT NULL DEFAULT 'pending',
    current_plan_version integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz,completed_at timestamptz
  )`;
  await sql`ALTER TABLE vf_plan_change_requests ADD COLUMN IF NOT EXISTS draft_plan jsonb`;
  await sql`ALTER TABLE vf_plan_change_requests ADD COLUMN IF NOT EXISTS draft_notes text`;
  await sql`ALTER TABLE vf_plan_change_requests ADD COLUMN IF NOT EXISTS draft_updated_at timestamptz`;
  await sql`CREATE INDEX IF NOT EXISTS vf_plan_change_requests_personal_status_idx ON vf_plan_change_requests(personal_id,status,created_at DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS vf_plan_history (
    id text PRIMARY KEY,athlete_id text NOT NULL,personal_id text,plan jsonb NOT NULL,notes text,
    plan_version integer NOT NULL DEFAULT 0,source text NOT NULL DEFAULT 'manual',created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS vf_plan_history_athlete_idx ON vf_plan_history(athlete_id,created_at DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS vf_billing_accounts (
    athlete_id text PRIMARY KEY,personal_id text NOT NULL,monthly_amount numeric(12,2),billing_day integer,
    next_due_date date,force_pending boolean NOT NULL DEFAULT false,notes text,contact_phone text,
    created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`ALTER TABLE vf_billing_accounts ADD COLUMN IF NOT EXISTS contact_phone text`;
  await sql`CREATE INDEX IF NOT EXISTS vf_billing_accounts_personal_idx ON vf_billing_accounts(personal_id,next_due_date)`;
  await sql`CREATE TABLE IF NOT EXISTS vf_payment_history (
    id text PRIMARY KEY,athlete_id text NOT NULL,personal_id text NOT NULL,due_date date NOT NULL,
    amount numeric(12,2),status text NOT NULL DEFAULT 'pending',paid_at timestamptz,notes text,
    created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(athlete_id,due_date)
  )`;
  await sql`ALTER TABLE vf_payment_history ADD COLUMN IF NOT EXISTS notes text`;
  await sql`CREATE INDEX IF NOT EXISTS vf_payment_history_personal_due_idx ON vf_payment_history(personal_id,due_date DESC)`;
}
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
  const daysLeft=due?Math.ceil((new Date(`${due}T12:00:00Z`).getTime()-new Date(`${todayISO()}T12:00:00Z`).getTime())/86400000):null;
  return {configured:!!due,amount:row.monthly_amount==null?null:Number(row.monthly_amount),billingDay:row.billing_day||null,nextDueDate:due,daysLeft,forcePending:!!row.force_pending,status:!due?'not_configured':pending?'pending':'current',contactPhone:row.contact_phone||null,notes:row.notes||''};
}
function applyRestDays(plan,restDays=[]){
  const blocked=[...new Set((restDays||[]).map(Number).filter(d=>Number.isInteger(d)&&d>=0&&d<=6))].slice(0,5);
  const available=[1,2,3,4,5,6,0].filter(d=>!blocked.includes(d));if(!available.length)return plan;
  return plan.map((day,index)=>blocked.includes(Number(day.day))?{...day,day:available[index%available.length]}:day);
}
function planRestDays(plan=[]){
  const training=new Set((Array.isArray(plan)?plan:[]).map(day=>Number(day?.day)).filter(day=>Number.isInteger(day)&&day>=0&&day<=6));
  return [0,1,2,3,4,5,6].filter(day=>!training.has(day));
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
      await ensureAdvancedTables(sql);
      const rows=await sql`SELECT u.id,u.name,u.public_code,a.status,p.plan_version,p.cycle_days,p.cycle_started_at,p.cycle_ends_at,b.monthly_amount,b.billing_day,b.next_due_date,b.force_pending,b.contact_phone,b.notes,cs.state AS cloud_state
        FROM vf_athlete_access a JOIN vf_users u ON u.id=a.athlete_id
        LEFT JOIN vf_training_plans p ON p.athlete_id=u.id LEFT JOIN vf_billing_accounts b ON b.athlete_id=u.id
        LEFT JOIN vf_cloud_state cs ON cs.user_id=u.id
        WHERE a.personal_id=${user.id} AND a.athlete_id<>a.personal_id ORDER BY u.name`;
      const clients=rows.map(r=>{const snapshot=r.cloud_state&&typeof r.cloud_state==='object'?r.cloud_state:{},health=Array.isArray(snapshot.healthRecords)?snapshot.healthRecords.filter(x=>x&&x.status!=='resolved').slice(-8):[],sessions=[...(Array.isArray(snapshot.sessions)?snapshot.sessions:[]),...(Array.isArray(snapshot.runSessions)?snapshot.runSessions:[])].slice(-12),feedbacks=sessions.map(s=>s?.sessionFeedback).filter(Boolean),lastFeedback=feedbacks.at(-1)||null,notes=String(lastFeedback?.notes||''),feedbackRisk=!!lastFeedback&&(Number(lastFeedback.fatigue)>=8||Number(lastFeedback.effort)>=9||/dor|doeu|desconfort|inc[oô]modo|les[aã]o|pontada|incha/i.test(notes)),readiness=(Array.isArray(snapshot.readinessCheckins)?snapshot.readinessCheckins:[]).at(-1)||null,lowReadiness=readiness&&(!!readiness.pain||(Number(readiness.score)>0&&Number(readiness.score)<50)),restriction=health.slice().sort((a,b)=>(Number(b.severity)||0)-(Number(a.severity)||0))[0]||null;return {id:r.id,name:r.name,publicCode:r.public_code,accessStatus:r.status,planVersion:Number(r.plan_version)||0,cycle:cycleInfo(r),billing:billingInfo(r),attention:{restriction:restriction?{type:restriction.type||'',area:restriction.area||'',severity:Number(restriction.severity)||1,status:restriction.status||'active',avoid:restriction.avoid||'',guidance:restriction.guidance||''}:null,feedback:feedbackRisk?{fatigue:Number(lastFeedback.fatigue)||0,effort:Number(lastFeedback.effort)||0,notes:clean(notes,180)}:null,readiness:lowReadiness?{score:Number(readiness.score)||0,date:readiness.date||null,pain:!!readiness.pain,energy:Number(readiness.energy)||0,sleep:Number(readiness.sleep)||0,soreness:Number(readiness.soreness)||0,stress:Number(readiness.stress)||0}:null}}});
      const requests=await sql`SELECT r.id,r.athlete_id,r.reason,r.rest_days,r.status,r.current_plan_version,r.created_at,u.name,u.public_code FROM vf_plan_change_requests r JOIN vf_users u ON u.id=r.athlete_id WHERE r.personal_id=${user.id} AND r.status IN ('pending','reviewing') ORDER BY r.created_at ASC`;
      const alerts=[];for(const c of clients){
        if(c.accessStatus==='pending')alerts.push({kind:'approval',severity:'warning',priority:90,athleteId:c.id,name:c.name,message:'Cadastro aguardando revisão e liberação.',actionTab:'access'});
        if(c.attention?.restriction){const h=c.attention.restriction,severe=Number(h.severity)>=4;alerts.push({kind:'health',severity:severe?'danger':'warning',priority:severe?99:84,athleteId:c.id,name:c.name,message:`Limitação ativa${h.area?` em ${h.area}`:''} • atenção ${h.severity}/5.`,health:h,actionTab:'summary'});}
        if(c.attention?.feedback){const f=c.attention.feedback,pain=/dor|doeu|desconfort|inc[oô]modo|les[aã]o|pontada|incha/i.test(String(f.notes||''));alerts.push({kind:'feedback',severity:pain?'danger':'warning',priority:pain?96:82,athleteId:c.id,name:c.name,message:pain?`Feedback recente relata dor/desconforto: ${clean(f.notes,110)}`:`Recuperação exigente no último treino • fadiga ${f.fatigue}/10.`,feedback:f,actionTab:'summary'});}
        if(c.attention?.readiness)alerts.push({kind:'recovery',severity:c.attention.readiness.pain?'danger':'warning',priority:c.attention.readiness.pain?97:78,athleteId:c.id,name:c.name,message:c.attention.readiness.pain?`Check-in recente registrou dor diferente do desconforto muscular habitual.`:`Prontidão recente baixa: ${c.attention.readiness.score}%.`,readiness:c.attention.readiness,actionTab:'summary'});
        if(c.cycle.status==='expired')alerts.push({kind:'cycle',severity:'danger',priority:100,athleteId:c.id,name:c.name,message:'Treino vencido — precisa de novo ciclo.',dueAt:c.cycle.endsAt,actionTab:'management'});
        else if(c.cycle.status==='due_soon')alerts.push({kind:'cycle',severity:'warning',priority:60,athleteId:c.id,name:c.name,message:`Treino vence em ${Math.max(0,c.cycle.daysLeft)} dia(s).`,dueAt:c.cycle.endsAt,actionTab:'management'});
        if(c.billing.status==='pending')alerts.push({kind:'billing',severity:'danger',priority:80,athleteId:c.id,name:c.name,message:`Mensalidade pendente${c.billing.nextDueDate?` desde ${c.billing.nextDueDate}`:''}.`,dueAt:c.billing.nextDueDate,amount:c.billing.amount,actionTab:'management'});
        else if(c.billing.status==='current'&&c.billing.daysLeft!=null&&c.billing.daysLeft<=7)alerts.push({kind:'billing',severity:'warning',priority:50,athleteId:c.id,name:c.name,message:c.billing.daysLeft===0?'Mensalidade vence hoje.':`Mensalidade vence em ${c.billing.daysLeft} dia(s).`,dueAt:c.billing.nextDueDate,amount:c.billing.amount,actionTab:'management'});
      }
      requests.forEach(r=>alerts.push({kind:'request',severity:'warning',priority:r.status==='pending'?95:85,athleteId:r.athlete_id,name:r.name,message:`${r.status==='reviewing'?'Treino em preparação':'Solicitou um novo treino'}: ${clean(r.reason,120)}`,requestId:r.id,requestStatus:r.status,createdAt:r.created_at,actionTab:'management'}));
      alerts.sort((a,b)=>(Number(b.priority)||0)-(Number(a.priority)||0)||String(a.dueAt||a.createdAt||'').localeCompare(String(b.dueAt||b.createdAt||'')));
      const currentRevenue=clients.filter(c=>c.billing.configured&&c.billing.status==='current').reduce((sum,c)=>sum+(Number(c.billing.amount)||0),0);
      const pendingRevenue=clients.filter(c=>c.billing.status==='pending').reduce((sum,c)=>sum+(Number(c.billing.amount)||0),0);
      return res.status(200).json({ok:true,clients,alerts,requests,finance:{currentRevenue,pendingRevenue,configured:clients.filter(c=>c.billing.configured).length,overdue:clients.filter(c=>c.billing.status==='pending').length},counts:{cycleReview:clients.filter(c=>['expired','due_soon'].includes(c.cycle.status)).length,billingPending:clients.filter(c=>c.billing.status==='pending').length,billingUpcoming:clients.filter(c=>c.billing.status==='current'&&c.billing.daysLeft!=null&&c.billing.daysLeft<=7).length,planRequests:requests.length,accessPending:clients.filter(c=>c.accessStatus==='pending').length,healthReview:clients.filter(c=>c.attention?.restriction||c.attention?.feedback||c.attention?.readiness).length,urgent:alerts.filter(a=>a.severity==='danger').length,totalActions:alerts.length}});
    }
    if(req.method==='GET'&&action==='finance'){
      await ensureAdvancedTables(sql);
      const [accounts,payments]=await Promise.all([
        sql`SELECT u.id,u.name,u.public_code,b.monthly_amount,b.billing_day,b.next_due_date,b.force_pending,b.notes,b.contact_phone
          FROM vf_athlete_access a JOIN vf_users u ON u.id=a.athlete_id
          LEFT JOIN vf_billing_accounts b ON b.athlete_id=u.id AND b.personal_id=${user.id}
          WHERE a.personal_id=${user.id} AND a.athlete_id<>a.personal_id ORDER BY u.name`,
        sql`SELECT id,athlete_id,due_date,amount,status,paid_at,notes,updated_at FROM vf_payment_history
          WHERE personal_id=${user.id} AND due_date>=current_date-interval '36 months' ORDER BY due_date DESC`
      ]);
      return res.status(200).json({ok:true,accounts:accounts.map(r=>({id:r.id,name:r.name,publicCode:r.public_code,billing:billingInfo(r)})),payments:payments.map(r=>({id:r.id,athleteId:r.athlete_id,dueDate:String(r.due_date).slice(0,10),amount:r.amount==null?null:Number(r.amount),status:r.status,paidAt:r.paid_at||null,notes:r.notes||'',updatedAt:r.updated_at||null}))});
    }
    if(req.method==='GET'&&action==='client'){
      await ensureAdvancedTables(sql);
      const athleteId=clean(req.query?.athleteId,120);const client=await linked(sql,user.id,athleteId);if(!client)return sendError(res,404,'Aluno não encontrado.','not_found');
      const plans=await sql`SELECT plan_version,cycle_days,cycle_started_at,cycle_ends_at FROM vf_training_plans WHERE athlete_id=${athleteId} LIMIT 1`;
      const bills=await sql`SELECT monthly_amount,billing_day,next_due_date,force_pending,notes,contact_phone FROM vf_billing_accounts WHERE athlete_id=${athleteId} LIMIT 1`;
      const history=await sql`SELECT id,due_date,amount,status,paid_at,notes FROM vf_payment_history WHERE athlete_id=${athleteId} ORDER BY due_date DESC LIMIT 12`;
      const requests=await sql`SELECT id,reason,rest_days,status,current_plan_version,draft_plan,draft_notes,draft_updated_at,created_at,reviewed_at,completed_at FROM vf_plan_change_requests WHERE athlete_id=${athleteId} AND personal_id=${user.id} ORDER BY created_at DESC LIMIT 5`;
      return res.status(200).json({ok:true,cycle:cycleInfo(plans[0]||{}),billing:billingInfo(bills[0]||{}),billingNotes:bills[0]?.notes||'',payments:history,requests});
    }
    if(req.method==='GET'&&action==='plan_history'){
      await ensureAdvancedTables(sql);const athleteId=clean(req.query?.athleteId,120);const client=await linked(sql,user.id,athleteId);if(!client)return sendError(res,404,'Aluno não encontrado.','not_found');
      const [rows,currentRows]=await Promise.all([
        sql`SELECT id,plan,notes,plan_version,source,created_at FROM vf_plan_history WHERE athlete_id=${athleteId} AND personal_id=${user.id} ORDER BY created_at DESC LIMIT 20`,
        sql`SELECT plan,notes,plan_version,updated_at FROM vf_training_plans WHERE athlete_id=${athleteId} LIMIT 1`
      ]);
      const current=currentRows[0]||null;
      return res.status(200).json({ok:true,current:current?{...current,days:Array.isArray(current.plan)?current.plan.length:0,restDays:planRestDays(current.plan)}:null,history:rows.map(r=>({...r,days:Array.isArray(r.plan)?r.plan.length:0,restDays:planRestDays(r.plan)}))});
    }
    if(req.method==='POST'&&action==='restore_plan'){
      await ensureAdvancedTables(sql);const athleteId=clean(req.body?.athleteId,120),historyId=clean(req.body?.historyId,160),expectedVersion=Number(req.body?.expectedVersion);const client=await linked(sql,user.id,athleteId);if(!client)return sendError(res,404,'Aluno não encontrado.','not_found');
      if(!Number.isInteger(expectedVersion)||expectedVersion<1)return sendError(res,400,'Atualize o histórico antes de restaurar.','expected_version_required');
      const target=await sql`SELECT plan,notes,plan_version FROM vf_plan_history WHERE id=${historyId} AND athlete_id=${athleteId} AND personal_id=${user.id} LIMIT 1`;if(!target.length)return sendError(res,404,'Versão do plano não encontrada.','history_not_found');
      if(!validPlan(target[0].plan))return sendError(res,409,'Esta versão antiga não possui um plano válido para restauração.','invalid_history_plan');
      const restDays=planRestDays(target[0].plan),snapshotId=`history_${crypto.randomUUID()}`;
      const rows=await sql`WITH current AS MATERIALIZED (
          SELECT plan,notes,plan_version FROM vf_training_plans WHERE athlete_id=${athleteId} AND plan_version=${expectedVersion}
        ), updated AS (
          UPDATE vf_training_plans AS p SET plan=CAST(${JSON.stringify(target[0].plan)} AS jsonb),notes=${target[0].notes||null},plan_version=p.plan_version+1,updated_at=now()
          WHERE p.athlete_id=${athleteId} AND p.plan_version=${expectedVersion} AND EXISTS (SELECT 1 FROM current)
          RETURNING p.plan_version,p.updated_at
        ), snapshot AS (
          INSERT INTO vf_plan_history (id,athlete_id,personal_id,plan,notes,plan_version,source)
          SELECT ${snapshotId},${athleteId},${user.id},current.plan,current.notes,current.plan_version,'before_restore' FROM current WHERE EXISTS (SELECT 1 FROM updated)
          RETURNING id
        ) SELECT updated.plan_version,updated.updated_at FROM updated WHERE EXISTS (SELECT 1 FROM snapshot)`;
      if(!rows.length)return sendError(res,409,'O plano foi alterado em outro acesso. Atualize o histórico antes de restaurar.','plan_version_changed');
      await sql`UPDATE vf_cloud_state SET state=COALESCE(state,'{}'::jsonb)||jsonb_build_object('profile',COALESCE(state->'profile','{}'::jsonb)||jsonb_build_object('restDays',CAST(${JSON.stringify(restDays)} AS jsonb))),state_version=state_version+1,updated_at=now() WHERE user_id=${athleteId}`;
      await audit(sql,user.id,athleteId,'plan_restored',{historyId,restoredFromVersion:Number(target[0].plan_version)||0,replacedVersion:expectedVersion,newVersion:Number(rows[0]?.plan_version)||0,restDays});
      return res.status(200).json({ok:true,plan:target[0].plan,notes:target[0].notes||'',restDays,restoredFromVersion:Number(target[0].plan_version)||0,...rows[0]});
    }
    if(req.method==='POST'&&action==='save_request_draft'){
      await ensureAdvancedTables(sql);
      const requestId=clean(req.body?.requestId,160),plan=req.body?.plan,notes=clean(req.body?.notes,1000);
      if(!validPlan(plan))return sendError(res,400,'Rascunho de treino inválido.','invalid_plan');
      const rows=await sql`UPDATE vf_plan_change_requests SET status='reviewing',draft_plan=CAST(${JSON.stringify(plan)} AS jsonb),draft_notes=${notes||null},draft_updated_at=now(),reviewed_at=COALESCE(reviewed_at,now()) WHERE id=${requestId} AND personal_id=${user.id} AND status IN ('pending','reviewing') RETURNING athlete_id,status,draft_updated_at`;
      if(!rows.length)return sendError(res,404,'Solicitação ativa não encontrada.','request_not_found');
      await sql`UPDATE vf_cloud_state SET state=CASE WHEN state ? 'planChangeRequest' THEN jsonb_set(state,'{planChangeRequest,status}','"reviewing"'::jsonb,true) ELSE state END,state_version=state_version+1,updated_at=now() WHERE user_id=${rows[0].athlete_id}`;
      await audit(sql,user.id,rows[0].athlete_id,'plan_request_draft_saved',{requestId,days:plan.length});
      return res.status(200).json({ok:true,request:{id:requestId,status:'reviewing',draftPlan:plan,draftNotes:notes,draftUpdatedAt:rows[0].draft_updated_at}});
    }
    if(req.method==='POST'&&action==='review_request'){
      await ensureAdvancedTables(sql);const requestId=clean(req.body?.requestId,160),status=String(req.body?.status||'reviewing');if(!['reviewing','rejected'].includes(status))return sendError(res,400,'Status inválido.','invalid_status');
      const rows=await sql`UPDATE vf_plan_change_requests SET status=${status},reviewed_at=COALESCE(reviewed_at,now()),completed_at=CASE WHEN ${status}='completed' THEN now() ELSE completed_at END WHERE id=${requestId} AND personal_id=${user.id} RETURNING athlete_id,reason,rest_days`;
      if(!rows.length)return sendError(res,404,'Solicitação não encontrada.','request_not_found');
      await sql`UPDATE vf_cloud_state SET state=CASE WHEN state ? 'planChangeRequest' THEN jsonb_set(state,'{planChangeRequest,status}',CAST(${JSON.stringify(status)} AS jsonb),true) ELSE state END,state_version=state_version+1,updated_at=now() WHERE user_id=${rows[0].athlete_id}`;
      await audit(sql,user.id,rows[0].athlete_id,`plan_request_${status}`,{requestId});return res.status(200).json({ok:true,request:rows[0]});
    }
    if(req.method==='GET'&&action==='backup'){
      await ensureAdvancedTables(sql);
      const athletes=await sql`SELECT u.id,u.public_code,u.name,u.email,a.status,a.updated_at,c.state,c.state_version,p.plan,p.plan_version,p.notes,p.cycle_days,p.cycle_started_at,p.cycle_ends_at,b.monthly_amount,b.billing_day,b.next_due_date,b.force_pending FROM vf_athlete_access a JOIN vf_users u ON u.id=a.athlete_id LEFT JOIN vf_cloud_state c ON c.user_id=u.id LEFT JOIN vf_training_plans p ON p.athlete_id=u.id LEFT JOIN vf_billing_accounts b ON b.athlete_id=u.id WHERE a.personal_id=${user.id} ORDER BY u.name`;
      const payments=await sql`SELECT athlete_id,due_date,amount,status,paid_at,notes FROM vf_payment_history WHERE personal_id=${user.id} ORDER BY due_date DESC`;
      const requests=await sql`SELECT id,athlete_id,reason,rest_days,status,current_plan_version,draft_plan,draft_notes,draft_updated_at,created_at,reviewed_at,completed_at FROM vf_plan_change_requests WHERE personal_id=${user.id} ORDER BY created_at DESC`;
      const history=await sql`SELECT id,athlete_id,plan,notes,plan_version,source,created_at FROM vf_plan_history WHERE personal_id=${user.id} ORDER BY created_at DESC`;
      await audit(sql,user.id,null,'personal_backup_exported',{athletes:athletes.length});return res.status(200).json({ok:true,exportedAt:new Date().toISOString(),personal:{id:user.id,name:user.name,publicCode:user.public_code},athletes,payments,requests,planHistory:history});
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
      await ensureAdvancedTables(sql);
      const athleteId=clean(req.body?.athleteId,120);const client=await linked(sql,user.id,athleteId);if(!client)return sendError(res,404,'Aluno não encontrado.','not_found');
      const due=isoDate(req.body?.dueDate);if(!due)return sendError(res,400,'Informe uma data de vencimento válida.','invalid_due_date');const amount=money(req.body?.amount);if(amount==null)return sendError(res,400,'Informe um valor mensal válido.','invalid_amount');const notes=clean(req.body?.notes,500);const contactPhone=phone(req.body?.contactPhone);const day=Number(due.slice(8,10));
      await sql`INSERT INTO vf_billing_accounts (athlete_id,personal_id,monthly_amount,billing_day,next_due_date,force_pending,notes,contact_phone,updated_at) VALUES (${athleteId},${user.id},${amount},${day},${due},false,${notes||null},${contactPhone},now())
        ON CONFLICT (athlete_id) DO UPDATE SET personal_id=EXCLUDED.personal_id,monthly_amount=EXCLUDED.monthly_amount,billing_day=EXCLUDED.billing_day,next_due_date=EXCLUDED.next_due_date,force_pending=false,notes=EXCLUDED.notes,contact_phone=EXCLUDED.contact_phone,updated_at=now()`;
      const id=`pay_${crypto.randomUUID()}`;await sql`INSERT INTO vf_payment_history (id,athlete_id,personal_id,due_date,amount,status) VALUES (${id},${athleteId},${user.id},${due},${amount},'pending') ON CONFLICT (athlete_id,due_date) DO UPDATE SET amount=EXCLUDED.amount,personal_id=EXCLUDED.personal_id,updated_at=now()`;
      await audit(sql,user.id,athleteId,'billing_configured',{dueDate:due,amount,hasContactPhone:!!contactPhone});return res.status(200).json({ok:true,billing:billingInfo({monthly_amount:amount,billing_day:day,next_due_date:due,force_pending:false,notes,contact_phone:contactPhone})});
    }
    if(req.method==='POST'&&action==='payment_update'){
      await ensureAdvancedTables(sql);
      const athleteId=clean(req.body?.athleteId,120),due=isoDate(req.body?.dueDate),status=String(req.body?.status||''),notes=clean(req.body?.notes,500);const client=await linked(sql,user.id,athleteId);if(!client)return sendError(res,404,'Aluno não encontrado.','not_found');
      if(!due||!['paid','pending'].includes(status))return sendError(res,400,'Pagamento ou competência inválida.','invalid_payment');
      const rows=await sql`SELECT monthly_amount,billing_day,next_due_date FROM vf_billing_accounts WHERE athlete_id=${athleteId} AND personal_id=${user.id} LIMIT 1`;const b=rows[0];if(!b?.next_due_date)return sendError(res,409,'Configure primeiro a mensalidade.','billing_not_configured');
      const amount=b.monthly_amount==null?null:Number(b.monthly_amount),id=`pay_${crypto.randomUUID()}`,currentDue=String(b.next_due_date).slice(0,10);
      if(status==='paid')await sql`INSERT INTO vf_payment_history (id,athlete_id,personal_id,due_date,amount,status,paid_at,notes,updated_at) VALUES (${id},${athleteId},${user.id},${due},${amount},'paid',now(),${notes||null},now()) ON CONFLICT (athlete_id,due_date) DO UPDATE SET status='paid',paid_at=now(),amount=EXCLUDED.amount,notes=COALESCE(EXCLUDED.notes,vf_payment_history.notes),updated_at=now()`;
      else await sql`INSERT INTO vf_payment_history (id,athlete_id,personal_id,due_date,amount,status,paid_at,notes,updated_at) VALUES (${id},${athleteId},${user.id},${due},${amount},'pending',NULL,${notes||null},now()) ON CONFLICT (athlete_id,due_date) DO UPDATE SET status='pending',paid_at=NULL,amount=EXCLUDED.amount,notes=COALESCE(EXCLUDED.notes,vf_payment_history.notes),updated_at=now()`;
      let nextDueDate=currentDue;
      if(due===currentDue&&status==='paid'){
        nextDueDate=addMonths(currentDue,1,Number(b.billing_day)||Number(currentDue.slice(8,10)));
        await sql`UPDATE vf_billing_accounts SET next_due_date=${nextDueDate},force_pending=false,updated_at=now() WHERE athlete_id=${athleteId} AND personal_id=${user.id}`;
        const nextId=`pay_${crypto.randomUUID()}`;await sql`INSERT INTO vf_payment_history (id,athlete_id,personal_id,due_date,amount,status) VALUES (${nextId},${athleteId},${user.id},${nextDueDate},${amount},'pending') ON CONFLICT (athlete_id,due_date) DO NOTHING`;
      }else if(due===currentDue&&status==='pending')await sql`UPDATE vf_billing_accounts SET force_pending=true,updated_at=now() WHERE athlete_id=${athleteId} AND personal_id=${user.id}`;
      await audit(sql,user.id,athleteId,status==='paid'?'payment_marked_paid':'payment_marked_pending',{dueDate:due,nextDueDate,amount,source:'finance_dashboard'});
      return res.status(200).json({ok:true,payment:{athleteId,dueDate:due,amount,status,notes,paidAt:status==='paid'?new Date().toISOString():null},nextDueDate});
    }
    if(req.method==='POST'&&action==='billing_mark'){
      await ensureAdvancedTables(sql);
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
      const requestRows=await sql`SELECT reason,rest_days,created_at FROM vf_plan_change_requests WHERE athlete_id=${athleteId} AND personal_id=${user.id} AND status IN ('pending','reviewing') ORDER BY created_at DESC LIMIT 1`;
      const activeRequest=requestRows[0]||null;
      const rawPlanning=isObject(req.body?.planning)?req.body.planning:{};
      const cycleDays=CYCLE_DAYS.has(Number(rawPlanning.cycleDays))?Number(rawPlanning.cycleDays):(Number(planRows[0]?.cycle_days)||30);
      const split=['AB','ABC','ABCD','ABCDE'].includes(clean(rawPlanning.split,10))?clean(rawPlanning.split,10):'';
      const exerciseCount=Math.max(1,Math.min(12,Number(rawPlanning.exerciseCount)||0));
      const schedule=isObject(rawPlanning.schedule)?Object.fromEntries(Object.entries(rawPlanning.schedule).filter(([k,v])=>/^[0-6]$/.test(String(k))&&['REST','A','B','C','D','E'].includes(String(v)))):{};
      const letters=isObject(rawPlanning.letters)?Object.fromEntries(Object.entries(rawPlanning.letters).slice(0,5).map(([k,v])=>[clean(k,2),{name:clean(v?.name,80),focus:Array.isArray(v?.focus)?v.focus.map(x=>clean(x,30)).filter(Boolean).slice(0,10):[]}])):{};
      const planning={cycleDays,split,exerciseCount,schedule,letters};
      const context={profile:state.profile||{},goals:state.goals||{},healthContext:state.profile?.healthContext||{},healthRecords:(state.healthRecords||[]).slice(-20),recentWorkoutFeedback,bodyMeasurements:(state.bodyMeasurements||[]).slice(-12),readiness:(state.readinessCheckins||[]).slice(-10),recentStrength,recentRuns,calendar:(state.calendarEvents||[]).slice(-60),currentPlan,cycleDays,planChangeRequest:activeRequest,planning};
      const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});const response=await ai.models.generateContent({model:MODEL,contents:`DADOS DO ALUNO, HISTÓRICO E PLANEJAMENTO DEFINIDO PELO PERSONAL:\
${JSON.stringify(context,null,2)}\
\
Estruture o próximo ciclo respeitando primeiro o planejamento informado pelo personal em planning. Considere obrigatoriamente os dados do aluno, objetivo, disponibilidade, lesões e limitações, movimentos a evitar, prontidão, feedbacks registrados após os treinos e o histórico recente de musculação/corrida. Se houver split, nomes/focos das letras, quantidade de exercícios e schedule, use essas escolhas como estrutura principal. Nunca agende treino nos dias marcados como REST, em profile.restDays ou em planChangeRequest.rest_days. Ajuste seleção de exercícios, volume, séries, repetições e descanso ao contexto real do aluno e aos sinais de fadiga/dor. Para corrida, inclua duração, pace/intensidade apenas quando houver base suficiente. O resultado é um rascunho para revisão do personal e não deve ser tratado como já liberado ao aluno.`,config:{systemInstruction:planInstruction(),responseMimeType:'application/json',responseSchema:planSchema,maxOutputTokens:2600,temperature:0.3}});
      let data;try{data=JSON.parse(response.text)}catch{return sendError(res,502,'AION retornou uma sugestão inválida. Tente novamente.','invalid_ai_output')}
      if(!Array.isArray(data.plan)||!data.plan.length)return sendError(res,502,'AION não conseguiu montar o plano agora.','empty_ai_plan');
      const requestedRest=activeRequest?.rest_days||state.profile?.restDays||[];data.plan=applyRestDays(data.plan,requestedRest);
      await audit(sql,user.id,athleteId,'aion_plan_suggested',{days:data.plan.length,model:MODEL,healthRestrictions:Number(context.healthContext?.activeRestrictions?.length)||0,feedbacks:recentWorkoutFeedback.length});return res.status(200).json({ok:true,...data});
    }
    return sendError(res,404,'Rota não encontrada.','not_found');
  }catch(error){
    const status=Number(error?.status||error?.statusCode||0),code=String(error?.code||error?.name||'provider_error').slice(0,80),msg=String(error?.message||'');
    console.error('Vaz Personal ops error',{action,status:status||null,code});
    if(status===429||/RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(msg)){res.setHeader('Retry-After','60');return sendError(res,429,'A AION está temporariamente no limite. Tente novamente em instantes.','aion_provider_rate_limited')}
    if(msg.includes('relation')||msg.includes('column'))return sendError(res,503,'A estrutura de ciclos e mensalidades ainda precisa ser ativada no banco.','migration_required');return sendError(res,500,'Não foi possível concluir esta operação agora.','server_error')}
}
