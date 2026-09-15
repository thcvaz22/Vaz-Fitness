import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { applyCors } from './cors.js';

const BUILTIN_EXERCISES=[
  {id:'bench',name:'Supino reto',muscle:'chest',secondary:['triceps','shoulders'],sets:4,reps:'6-10',rest:120,mediaQuery:'Barbell Bench Press'},
  {id:'incline-db',name:'Supino inclinado com halteres',muscle:'chest',secondary:['shoulders','triceps'],sets:3,reps:'8-12',rest:90,mediaQuery:'Incline Dumbbell Bench Press'},
  {id:'fly',name:'Crucifixo na polia',muscle:'chest',secondary:['shoulders'],sets:3,reps:'10-15',rest:75,mediaQuery:'Cable Fly'},
  {id:'ohp',name:'Desenvolvimento com halteres',muscle:'shoulders',secondary:['triceps'],sets:4,reps:'6-10',rest:105,mediaQuery:'Dumbbell Shoulder Press'},
  {id:'lateral',name:'Elevação lateral',muscle:'shoulders',secondary:[],sets:4,reps:'12-18',rest:60,mediaQuery:'Dumbbell Lateral Raise'},
  {id:'rear-delt',name:'Crucifixo inverso',muscle:'shoulders',secondary:['back'],sets:3,reps:'12-18',rest:60,mediaQuery:'Reverse Fly'},
  {id:'pulldown',name:'Puxada alta',muscle:'back',secondary:['biceps'],sets:4,reps:'8-12',rest:90,mediaQuery:'Lat Pulldown'},
  {id:'row',name:'Remada baixa',muscle:'back',secondary:['biceps'],sets:4,reps:'8-12',rest:90,mediaQuery:'Seated Cable Row'},
  {id:'db-row',name:'Remada unilateral',muscle:'back',secondary:['biceps'],sets:3,reps:'8-12',rest:90,mediaQuery:'One Arm Dumbbell Row'},
  {id:'squat',name:'Agachamento livre',muscle:'quads',secondary:['glutes','core'],sets:4,reps:'5-8',rest:150,mediaQuery:'Barbell Back Squat'},
  {id:'legpress',name:'Leg press',muscle:'quads',secondary:['glutes'],sets:4,reps:'8-12',rest:120,mediaQuery:'Leg Press'},
  {id:'extension',name:'Cadeira extensora',muscle:'quads',secondary:[],sets:3,reps:'10-15',rest:75,mediaQuery:'Leg Extension'},
  {id:'rdl',name:'Levantamento romeno',muscle:'hamstrings',secondary:['glutes','back'],sets:4,reps:'6-10',rest:120,mediaQuery:'Romanian Deadlift'},
  {id:'curl-leg',name:'Mesa flexora',muscle:'hamstrings',secondary:[],sets:3,reps:'10-15',rest:75,mediaQuery:'Lying Leg Curl'},
  {id:'hip',name:'Elevação pélvica',muscle:'glutes',secondary:['hamstrings'],sets:4,reps:'8-12',rest:105,mediaQuery:'Barbell Hip Thrust'},
  {id:'curl',name:'Rosca direta',muscle:'biceps',secondary:[],sets:3,reps:'8-12',rest:75,mediaQuery:'Barbell Biceps Curl'},
  {id:'hammer',name:'Rosca martelo',muscle:'biceps',secondary:['arms'],sets:3,reps:'10-14',rest:60,mediaQuery:'Dumbbell Hammer Curl'},
  {id:'pushdown',name:'Tríceps corda',muscle:'triceps',secondary:[],sets:3,reps:'10-15',rest:60,mediaQuery:'Cable Triceps Pushdown'},
  {id:'overtri',name:'Tríceps francês',muscle:'triceps',secondary:[],sets:3,reps:'10-14',rest:60,mediaQuery:'Overhead Triceps Extension'},
  {id:'plank',name:'Prancha',muscle:'core',secondary:[],sets:3,reps:'30-60s',rest:45,mediaQuery:'Plank'},
  {id:'calf',name:'Panturrilha em pé',muscle:'calves',secondary:[],sets:4,reps:'12-20',rest:60,mediaQuery:'Standing Calf Raise'}
];

function db(){if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL não configurada.');return neon(process.env.DATABASE_URL)}
function tokenHash(v){return crypto.createHash('sha256').update(String(v)).digest('hex')}
function clean(v='',max=240){return String(v??'').trim().slice(0,max)}
function jsonSize(v){try{return Buffer.byteLength(JSON.stringify(v),'utf8')}catch{return Infinity}}
function safeUrl(v){const x=clean(v,1200);if(!x)return null;try{const u=new URL(x);return u.protocol==='https:'?u.toString():null}catch{return null}}
function sendError(res,status,message,code='error'){return res.status(status).json({ok:false,error:code,message})}
async function auth(req){const h=String(req.headers?.authorization||''),token=h.startsWith('Bearer ')?h.slice(7).trim():'';if(!token)return null;const sql=db();const rows=await sql`SELECT u.id,u.role,u.name,u.account_status FROM vf_sessions s JOIN vf_users u ON u.id=s.user_id WHERE s.token_hash=${tokenHash(token)} AND s.expires_at>now() LIMIT 1`;const user=rows[0];return user?.role==='personal'&&user.account_status==='approved'?{sql,user}:null}
async function linked(sql,personalId,athleteId){const rows=await sql`SELECT 1 FROM vf_athlete_access WHERE athlete_id=${athleteId} AND personal_id=${personalId} LIMIT 1`;return !!rows.length}
async function audit(sql,actor,athlete,action,payload={}){try{await sql`INSERT INTO vf_audit_log(actor_id,athlete_id,action,payload) VALUES (${actor},${athlete||null},${action},CAST(${JSON.stringify(payload)} AS jsonb))`}catch{}}
function exerciseRow(r){return {id:r.id,name:r.name,muscle:r.muscle,secondary:Array.isArray(r.secondary)?r.secondary:[],instructions:r.instructions||'',videoUrl:r.video_url||null,imageUrl:r.image_url||null,equipment:r.equipment||'',sets:Number(r.default_sets)||3,reps:r.default_reps||'8-12',rest:Number(r.default_rest)||60,source:'personal',updatedAt:r.updated_at}}
function templateRow(r){return {id:r.id,name:r.name,description:r.description||'',mode:r.mode||'',goal:r.goal||'',source:r.source||'manual',daysCount:Number(r.days_count)||1,plan:Array.isArray(r.plan)?r.plan:[],tags:Array.isArray(r.tags)?r.tags:[],updatedAt:r.updated_at}}
function validatePlan(plan){return Array.isArray(plan)&&plan.length>=1&&plan.length<=21&&jsonSize(plan)<=500000&&plan.every(d=>d&&typeof d==='object'&&['strength','run'].includes(d.type)&&clean(d.name,100).length>0&&Number(d.duration||0)>=0&&Number(d.duration||0)<=300)}

export default async function handler(req,res){
  if(applyCors(req,res))return;
  const a=await auth(req);if(!a)return sendError(res,401,'Sessão inválida ou conta não liberada.','unauthorized');
  const {sql,user}=a,action=clean(req.query?.action||req.body?.action,50),method=String(req.method||'GET').toUpperCase();
  try{
    if(action==='library'&&method==='GET'){
      const [exRows,tplRows]=await Promise.all([
        sql`SELECT * FROM vf_personal_exercises WHERE personal_id=${user.id} AND is_archived=false ORDER BY updated_at DESC,name`,
        sql`SELECT * FROM vf_workout_templates WHERE personal_id=${user.id} AND is_archived=false ORDER BY updated_at DESC,name`
      ]);
      return res.status(200).json({ok:true,builtinExercises:BUILTIN_EXERCISES,exercises:exRows.map(exerciseRow),templates:tplRows.map(templateRow)});
    }

    if(action==='save_exercise'&&method==='POST'){
      const id=clean(req.body?.id,140),name=clean(req.body?.name,120),muscle=clean(req.body?.muscle,40),instructions=clean(req.body?.instructions,5000),equipment=clean(req.body?.equipment,120),videoUrl=safeUrl(req.body?.videoUrl),imageUrl=safeUrl(req.body?.imageUrl);
      const secondary=Array.isArray(req.body?.secondary)?req.body.secondary.map(x=>clean(x,40)).filter(Boolean).slice(0,8):[];
      const sets=Math.max(1,Math.min(12,Number(req.body?.sets)||3)),reps=clean(req.body?.reps,30)||'8-12',rest=Math.max(0,Math.min(900,Number(req.body?.rest)||60));
      if(!name||!muscle)return sendError(res,400,'Informe nome e grupo muscular.','invalid_exercise');
      let rows;
      if(id){rows=await sql`UPDATE vf_personal_exercises SET name=${name},muscle=${muscle},secondary=CAST(${JSON.stringify(secondary)} AS jsonb),instructions=${instructions||null},video_url=${videoUrl},image_url=${imageUrl},equipment=${equipment||null},default_sets=${sets},default_reps=${reps},default_rest=${rest},updated_at=now() WHERE id=${id} AND personal_id=${user.id} AND is_archived=false RETURNING *`;if(!rows.length)return sendError(res,404,'Exercício não encontrado.','not_found')}
      else{const newId=`pex_${crypto.randomUUID()}`;rows=await sql`INSERT INTO vf_personal_exercises(id,personal_id,name,muscle,secondary,instructions,video_url,image_url,equipment,default_sets,default_reps,default_rest) VALUES (${newId},${user.id},${name},${muscle},CAST(${JSON.stringify(secondary)} AS jsonb),${instructions||null},${videoUrl},${imageUrl},${equipment||null},${sets},${reps},${rest}) RETURNING *`}
      await audit(sql,user.id,null,'personal_exercise_saved',{exerciseId:rows[0].id,name});
      return res.status(200).json({ok:true,exercise:exerciseRow(rows[0])});
    }

    if(action==='archive_exercise'&&method==='POST'){
      const id=clean(req.body?.id,140);const rows=await sql`UPDATE vf_personal_exercises SET is_archived=true,updated_at=now() WHERE id=${id} AND personal_id=${user.id} RETURNING id`;if(!rows.length)return sendError(res,404,'Exercício não encontrado.','not_found');return res.status(200).json({ok:true});
    }

    if(action==='save_template'&&method==='POST'){
      const id=clean(req.body?.id,140),name=clean(req.body?.name,120),description=clean(req.body?.description,1200),mode=clean(req.body?.mode,40),goal=clean(req.body?.goal,50),source=req.body?.source==='aion'?'aion':'manual',plan=req.body?.plan,tags=Array.isArray(req.body?.tags)?req.body.tags.map(x=>clean(x,50)).filter(Boolean).slice(0,12):[];
      if(!name||!validatePlan(plan))return sendError(res,400,'Informe um nome e um plano de treino válido.','invalid_template');
      const days=plan.length;let rows;
      if(id){rows=await sql`UPDATE vf_workout_templates SET name=${name},description=${description||null},mode=${mode||null},goal=${goal||null},source=${source},days_count=${days},plan=CAST(${JSON.stringify(plan)} AS jsonb),tags=CAST(${JSON.stringify(tags)} AS jsonb),updated_at=now() WHERE id=${id} AND personal_id=${user.id} AND is_archived=false RETURNING *`;if(!rows.length)return sendError(res,404,'Treino salvo não encontrado.','not_found')}
      else{const newId=`tpl_${crypto.randomUUID()}`;rows=await sql`INSERT INTO vf_workout_templates(id,personal_id,name,description,mode,goal,source,days_count,plan,tags) VALUES (${newId},${user.id},${name},${description||null},${mode||null},${goal||null},${source},${days},CAST(${JSON.stringify(plan)} AS jsonb),CAST(${JSON.stringify(tags)} AS jsonb)) RETURNING *`}
      await audit(sql,user.id,null,'workout_template_saved',{templateId:rows[0].id,name,source});
      return res.status(200).json({ok:true,template:templateRow(rows[0])});
    }

    if(action==='archive_template'&&method==='POST'){
      const id=clean(req.body?.id,140);const rows=await sql`UPDATE vf_workout_templates SET is_archived=true,updated_at=now() WHERE id=${id} AND personal_id=${user.id} RETURNING id`;if(!rows.length)return sendError(res,404,'Treino salvo não encontrado.','not_found');return res.status(200).json({ok:true});
    }

    if(action==='apply_template'&&method==='POST'){
      const templateId=clean(req.body?.templateId,140),athleteId=clean(req.body?.athleteId,140);if(!await linked(sql,user.id,athleteId))return sendError(res,404,'Aluno não encontrado na sua carteira.','not_found');
      const rows=await sql`SELECT plan,name FROM vf_workout_templates WHERE id=${templateId} AND personal_id=${user.id} AND is_archived=false LIMIT 1`;const tpl=rows[0];if(!tpl)return sendError(res,404,'Treino salvo não encontrado.','template_not_found');
      await sql`INSERT INTO vf_training_plans(athlete_id,personal_id,plan,plan_version,updated_at) VALUES (${athleteId},${user.id},${tpl.plan},1,now()) ON CONFLICT(athlete_id) DO UPDATE SET personal_id=${user.id},plan=EXCLUDED.plan,plan_version=vf_training_plans.plan_version+1,updated_at=now()`;
      await audit(sql,user.id,athleteId,'workout_template_applied',{templateId,name:tpl.name});
      return res.status(200).json({ok:true,plan:tpl.plan});
    }

    return res.status(405).json({ok:false,error:'method_not_allowed',message:'Operação não permitida.'});
  }catch(error){console.error('Training library API error',action,error);const msg=String(error?.message||'');if(msg.includes('vf_personal_exercises')||msg.includes('vf_workout_templates'))return sendError(res,503,'A biblioteca de treinos ainda precisa ser ativada no banco.','migration_required');if(msg.includes('vf_personal_exercises_name_key')||msg.includes('vf_workout_templates_name_key'))return sendError(res,409,'Já existe um item com este nome.','duplicate_name');return res.status(500).json({ok:false,error:'server_error',message:'Não foi possível concluir esta operação agora.'})}
}
