import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { GoogleGenAI } from '@google/genai';
import { applyCors } from './cors.js';
import { EXERCISE_CATALOG, EXERCISE_CATALOG_VERSION } from './exercise-catalog-v5.js';

const MODEL=process.env.GEMINI_MODEL||'gemini-3.8-flash';
const MUSCLES=new Set(['chest','back','shoulders','quads','hamstrings','glutes','arms','core','biceps','triceps','calves']);

function db(){if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL não configurada.');return neon(process.env.DATABASE_URL)}
function clean(v='',max=180){return String(v??'').trim().slice(0,max)}
function tokenHash(v){return crypto.createHash('sha256').update(String(v)).digest('hex')}
function sendError(res,status,message,code='error'){return res.status(status).json({ok:false,error:code,message})}
function clamp(v,min,max,fallback){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback}
function norm(v=''){return String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function jsonSize(v){try{return Buffer.byteLength(JSON.stringify(v),'utf8')}catch{return Infinity}}
function validPlanDraft(plan){return Array.isArray(plan)&&plan.length>0&&plan.length<=21&&jsonSize(plan)<=500000&&plan.every(day=>day&&typeof day==='object'&&!Array.isArray(day)&&['strength','run'].includes(day.type)&&clean(day.name,100).length>0&&Number.isInteger(Number(day.day))&&Number(day.day)>=0&&Number(day.day)<=6&&Number.isFinite(Number(day.duration||0))&&Number(day.duration||0)>=0&&Number(day.duration||0)<=300&&(!day.exercises||Array.isArray(day.exercises))&&(!day.exercises||day.exercises.length<=30))}

async function auth(req){
  const h=String(req.headers?.authorization||''),token=h.startsWith('Bearer ')?h.slice(7).trim():'';
  if(!token)return null;
  const sql=db();
  const rows=await sql`SELECT u.id,u.role,u.name,u.account_status FROM vf_sessions s JOIN vf_users u ON u.id=s.user_id WHERE s.token_hash=${tokenHash(token)} AND s.expires_at>now() LIMIT 1`;
  const user=rows[0];
  return user?.role==='personal'&&user.account_status==='approved'?{sql,user}:null;
}
async function linked(sql,personalId,athleteId){
  const rows=await sql`SELECT a.athlete_id,a.status,u.name,u.public_code FROM vf_athlete_access a JOIN vf_users u ON u.id=a.athlete_id WHERE a.athlete_id=${athleteId} AND a.personal_id=${personalId} LIMIT 1`;
  return rows[0]||null;
}
async function ensureMeta(sql){
  await sql`CREATE TABLE IF NOT EXISTS vf_personal_athlete_meta (
    athlete_id text PRIMARY KEY,
    personal_id text NOT NULL,
    gym_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS vf_personal_athlete_meta_personal_idx ON vf_personal_athlete_meta(personal_id)`;
}
async function ensureDrafts(sql){
  await sql`CREATE TABLE IF NOT EXISTS vf_plan_drafts (
    athlete_id text PRIMARY KEY,
    personal_id text NOT NULL,
    plan jsonb NOT NULL,
    notes text,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS vf_plan_drafts_personal_idx ON vf_plan_drafts(personal_id,updated_at DESC)`;
}
async function audit(sql,actor,athlete,action,payload={}){try{await sql`INSERT INTO vf_audit_log(actor_id,athlete_id,action,payload) VALUES (${actor},${athlete||null},${action},CAST(${JSON.stringify(payload)} AS jsonb))`}catch{}}
async function customExercises(sql,personalId){
  try{
    await sql`ALTER TABLE vf_personal_exercises ADD COLUMN IF NOT EXISTS image_end_url text`;
    const rows=await sql`SELECT id,name,muscle,secondary,equipment,default_sets,default_reps,default_rest,instructions,video_url,image_url,image_end_url FROM vf_personal_exercises WHERE personal_id=${personalId} AND is_archived=false ORDER BY name`;
    return rows.map(r=>({id:r.id,name:r.name,muscle:r.muscle,secondary:Array.isArray(r.secondary)?r.secondary:[],equipment:r.equipment||'Personal',sets:Number(r.default_sets)||3,reps:r.default_reps||'8-12',rest:Number(r.default_rest)||60,instructions:r.instructions||'',videoUrl:r.video_url||null,imageUrl:r.image_url||null,imageEndUrl:r.image_end_url||null,mediaQuery:r.name,source:'personal'}));
  }catch{return []}
}
function publicCatalogItem(x){return {...x,source:x.source||'builtin'}}

const planSchema={
  type:'object',properties:{
    summary:{type:'string'},reasons:{type:'array',items:{type:'string'}},
    plan:{type:'array',items:{type:'object',properties:{
      id:{type:'string'},type:{type:'string',enum:['strength','run']},name:{type:'string'},day:{type:'integer'},duration:{type:'integer'},status:{type:'string'},pace:{type:'string'},intensity:{type:'string'},
      exercises:{type:'array',items:{type:'object',properties:{id:{type:'string'},name:{type:'string'},muscle:{type:'string'},sets:{type:'integer'},reps:{type:'string'},load:{type:'number'},rest:{type:'integer'},priority:{type:'boolean'}},required:['id','name','muscle','sets','reps','rest']}}
    },required:['id','type','name','day','duration']}}
  },required:['summary','reasons','plan']
};
function instruction(catalogText){return `Você é AION IA, assistente de um profissional de Educação Física. Gere um RASCUNHO de próximo ciclo para revisão humana. Responda em português do Brasil e use somente os dados recebidos.

REGRAS CLÍNICAS E DE PROGRESSÃO:
- não faça diagnóstico médico;
- preserve progressão sustentável e evite saltos bruscos de volume, carga ou intensidade;
- respeite modalidade, objetivo, nível, disponibilidade semanal, tempo de sessão, histórico, esforço, prontidão, medidas e consistência;
- em corrida, não aumente simultaneamente distância, pace e intensidade de forma agressiva;
- o personal decide e pode alterar tudo antes de liberar.

REGRA DA BIBLIOTECA:
- para musculação, escolha exercícios prioritariamente da lista abaixo;
- use exatamente o ID indicado na lista quando selecionar um exercício;
- não invente variações desnecessárias se houver equivalente na biblioteca;
- exercícios personalizados do personal também podem ser usados.

BIBLIOTECA DISPONÍVEL (id | nome | músculo | equipamento):
${catalogText}`}
function canonicalizePlan(plan,available){
  const byId=new Map(available.map(x=>[x.id,x]));
  const byName=new Map(available.map(x=>[norm(x.name),x]));
  return (Array.isArray(plan)?plan:[]).slice(0,21).map((day,di)=>{
    const type=day?.type==='run'?'run':'strength';
    const out={id:clean(day?.id,120)||`aion-${Date.now()}-${di}`,type,name:clean(day?.name,100)||'Treino',day:clamp(day?.day,0,6,di%7),duration:clamp(day?.duration,0,300,60),status:'pending'};
    if(type==='run'){
      out.pace=clean(day?.pace,40);
      out.intensity=clean(day?.intensity,50)||'Leve';
      return out;
    }
    out.exercises=(Array.isArray(day?.exercises)?day.exercises:[]).slice(0,20).map((raw,ei)=>{
      const base=byId.get(clean(raw?.id,140))||byName.get(norm(raw?.name));
      const fallbackMuscle=MUSCLES.has(raw?.muscle)?raw.muscle:'core';
      if(!base)return {id:`aion-custom-${Date.now()}-${di}-${ei}`,name:clean(raw?.name,120)||'Exercício',muscle:fallbackMuscle,secondary:[],equipment:clean(raw?.equipment,100),sets:clamp(raw?.sets,1,12,3),reps:clean(raw?.reps,30)||'8-12',load:clamp(raw?.load,0,2000,0),rest:clamp(raw?.rest,0,900,60),icon:'🏋️',priority:!!raw?.priority};
      return {...base,sets:clamp(raw?.sets,1,12,base.sets||3),reps:clean(raw?.reps,30)||base.reps||'8-12',load:clamp(raw?.load,0,2000,0),rest:clamp(raw?.rest,0,900,base.rest||60),icon:'🏋️',priority:!!raw?.priority};
    });
    return out;
  });
}
function applyRestDays(plan,restDays=[]){const blocked=[...new Set((restDays||[]).map(Number).filter(d=>Number.isInteger(d)&&d>=0&&d<=6))].slice(0,5),available=[1,2,3,4,5,6,0].filter(d=>!blocked.includes(d));if(!available.length)return plan;return plan.map((day,i)=>blocked.includes(Number(day.day))?{...day,day:available[i%available.length]}:day)}

export default async function handler(req,res){
  if(applyCors(req,res))return;
  const a=await auth(req);if(!a)return sendError(res,401,'Sessão inválida ou conta não liberada.','unauthorized');
  const {sql,user}=a,action=clean(req.query?.action||req.body?.action,50),method=String(req.method||'GET').toUpperCase();
  try{
    if(action==='catalog'&&method==='GET'){
      const custom=await customExercises(sql,user.id);
      return res.status(200).json({ok:true,version:EXERCISE_CATALOG_VERSION,count:EXERCISE_CATALOG.length+custom.length,builtin:EXERCISE_CATALOG.map(publicCatalogItem),custom});
    }
    if(action==='meta_summary'&&method==='GET'){
      await ensureMeta(sql);
      const rows=await sql`SELECT athlete_id,gym_name,updated_at FROM vf_personal_athlete_meta WHERE personal_id=${user.id}`;
      const meta={};for(const r of rows)meta[r.athlete_id]={gymName:r.gym_name||'',updatedAt:r.updated_at};
      return res.status(200).json({ok:true,meta});
    }
    if(action==='set_gym'&&method==='POST'){
      const athleteId=clean(req.body?.athleteId,140),gymName=clean(req.body?.gymName,120);
      if(!athleteId)return sendError(res,400,'Aluno inválido.','invalid_athlete');
      if(!await linked(sql,user.id,athleteId))return sendError(res,404,'Aluno não encontrado na sua carteira.','not_found');
      await ensureMeta(sql);
      await sql`INSERT INTO vf_personal_athlete_meta(athlete_id,personal_id,gym_name,updated_at) VALUES (${athleteId},${user.id},${gymName||null},now()) ON CONFLICT(athlete_id) DO UPDATE SET personal_id=EXCLUDED.personal_id,gym_name=EXCLUDED.gym_name,updated_at=now()`;
      await audit(sql,user.id,athleteId,'gym_updated',{gymName});
      return res.status(200).json({ok:true,gymName});
    }
    if(action==='plan_draft'&&['GET','POST','DELETE'].includes(method)){
      const athleteId=clean(req.query?.athleteId||req.body?.athleteId,140);
      if(!athleteId)return sendError(res,400,'Aluno inválido.','invalid_athlete');
      if(!await linked(sql,user.id,athleteId))return sendError(res,404,'Aluno não encontrado na sua carteira.','not_found');
      await ensureDrafts(sql);
      if(method==='GET'){
        const rows=await sql`SELECT plan,notes,updated_at FROM vf_plan_drafts WHERE athlete_id=${athleteId} AND personal_id=${user.id} LIMIT 1`;
        return res.status(200).json({ok:true,draft:rows[0]||null});
      }
      if(method==='POST'){
        const plan=req.body?.plan,notes=clean(req.body?.notes,1000);
        if(!validPlanDraft(plan))return sendError(res,400,'Rascunho de treino inválido.','invalid_plan');
        const rows=await sql`INSERT INTO vf_plan_drafts(athlete_id,personal_id,plan,notes,updated_at) VALUES (${athleteId},${user.id},CAST(${JSON.stringify(plan)} AS jsonb),${notes||null},now()) ON CONFLICT(athlete_id) DO UPDATE SET personal_id=EXCLUDED.personal_id,plan=EXCLUDED.plan,notes=EXCLUDED.notes,updated_at=now() RETURNING updated_at`;
        await audit(sql,user.id,athleteId,'plan_draft_saved',{days:plan.length});
        return res.status(200).json({ok:true,draft:{plan,notes,updated_at:rows[0]?.updated_at}});
      }
      await sql`DELETE FROM vf_plan_drafts WHERE athlete_id=${athleteId} AND personal_id=${user.id}`;
      await audit(sql,user.id,athleteId,'plan_draft_deleted');
      return res.status(200).json({ok:true});
    }
    if(action==='suggest_plan'&&method==='POST'){
      if(!process.env.GEMINI_API_KEY)return sendError(res,503,'AION não configurada.','aion_not_configured');
      const athleteId=clean(req.body?.athleteId,140),client=await linked(sql,user.id,athleteId);if(!client)return sendError(res,404,'Aluno não encontrado.','not_found');
      const [stateRows,planRows,custom]=await Promise.all([
        sql`SELECT state FROM vf_cloud_state WHERE user_id=${athleteId} LIMIT 1`,
        sql`SELECT plan,plan_version,cycle_days FROM vf_training_plans WHERE athlete_id=${athleteId} LIMIT 1`,
        customExercises(sql,user.id)
      ]);
      const state=stateRows[0]?.state||{},currentPlan=planRows[0]?.plan||[];
      let activeRequest=null;try{const rows=await sql`SELECT reason,rest_days,created_at FROM vf_plan_change_requests WHERE athlete_id=${athleteId} AND personal_id=${user.id} AND status IN ('pending','reviewing') ORDER BY created_at DESC LIMIT 1`;activeRequest=rows[0]||null}catch{}
      const available=[...EXERCISE_CATALOG.map(publicCatalogItem),...custom];
      const catalogText=available.map(x=>`${x.id} | ${x.name} | ${x.muscle} | ${x.equipment||'—'}`).join('\n');
      const recentStrength=(state.sessions||[]).slice(-12),recentRuns=(state.runSessions||[]).slice(-12),recentWorkoutFeedback=[...recentStrength,...recentRuns].map(s=>({date:s.date,name:s.name,feedback:s.sessionFeedback||null})).filter(x=>x.feedback).slice(-12);
      const context={profile:state.profile||{},goals:state.goals||{},healthContext:state.profile?.healthContext||{},healthRecords:(state.healthRecords||[]).slice(-20),recentWorkoutFeedback,bodyMeasurements:(state.bodyMeasurements||[]).slice(-12),readiness:(state.readinessCheckins||[]).slice(-10),recentStrength,recentRuns,calendar:(state.calendarEvents||[]).slice(-60),currentPlan,cycleDays:Number(planRows[0]?.cycle_days)||30,planChangeRequest:activeRequest};
      const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
      const response=await ai.models.generateContent({model:MODEL,contents:`DADOS DO ALUNO E PLANO ATUAL:\n${JSON.stringify(context,null,2)}\n\nCrie uma sugestão de próximo ciclo. Considere lesões, limitações, feedbacks e o motivo informado na solicitação. Preserve uma quantidade de dias compatível com a disponibilidade do aluno e não agende treinos nos dias de descanso de profile.restDays ou planChangeRequest.rest_days. Para musculação, use IDs da biblioteca fornecida e inclua séries, repetições e descanso. Para corrida, inclua duração, pace/intensidade somente quando houver base suficiente.`,config:{systemInstruction:instruction(catalogText),responseMimeType:'application/json',responseSchema:planSchema}});
      let data;try{data=JSON.parse(response.text)}catch{return sendError(res,502,'AION retornou uma sugestão inválida. Tente novamente.','invalid_ai_output')}
      const plan=applyRestDays(canonicalizePlan(data.plan,available),activeRequest?.rest_days||state.profile?.restDays||[]);if(!plan.length)return sendError(res,502,'AION não conseguiu montar o plano agora.','empty_ai_plan');
      await audit(sql,user.id,athleteId,'aion_plan_suggested_v4',{days:plan.length,model:MODEL,catalogVersion:EXERCISE_CATALOG_VERSION});
      return res.status(200).json({ok:true,summary:clean(data.summary,1200),reasons:Array.isArray(data.reasons)?data.reasons.map(x=>clean(x,300)).filter(Boolean).slice(0,8):[],plan,catalogVersion:EXERCISE_CATALOG_VERSION});
    }
    return sendError(res,404,'Rota não encontrada.','not_found');
  }catch(error){
    console.error('Vaz Personal tools error',action,error);
    return sendError(res,500,'Não foi possível concluir esta operação agora.','server_error');
  }
}
