import { applyCors } from './cors.js';
import { authenticateBearer, requireApprovedAthlete } from './session-auth.js';

const POLICY_VALUES=new Set(['auto','ask','off']);
const MAX_REQUESTS=40;
const MAX_OVERRIDES=24;

function sendError(res,status,message,code='error'){return res.status(status).json({ok:false,error:code,message})}
function clean(v='',max=160){return String(v??'').trim().slice(0,max)}
function isObject(v){return v&&typeof v==='object'&&!Array.isArray(v)}
function safeArray(v,max=60){return Array.isArray(v)?v.slice(-max):[]}
function normalizePolicy(v){return POLICY_VALUES.has(String(v))?String(v):'ask'}
function normalizeCycle(row={}){return {days:Number(row.cycle_days)||30,startedAt:row.cycle_started_at||null,endsAt:row.cycle_ends_at||null}}
function normalizeProposal(p){
  if(!isObject(p))return null;
  const weekKey=clean(p.weekKey,10),skippedDate=clean(p.skippedDate,10),summary=clean(p.summary,280);
  const entries=safeArray(p.entries,14).map((e,i)=>({
    date:clean(e?.date,10),
    sourceDate:clean(e?.sourceDate,10)||null,
    mode:['move','supplement','base'].includes(e?.mode)?e.mode:'move',
    plan:isObject(e?.plan)?e.plan:null,
    note:clean(e?.note,220),
    order:i
  })).filter(e=>/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&e.plan);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(skippedDate)||!/^\d{4}-\d{2}-\d{2}$/.test(weekKey)||!entries.length)return null;
  return {weekKey,skippedDate,summary,entries,safe:p.safe!==false,coverageComplete:p.coverageComplete!==false};
}
async function linkedPersonal(sql,personalId,athleteId){
  const rows=await sql`SELECT a.athlete_id,u.name,u.public_code FROM vf_athlete_access a JOIN vf_users u ON u.id=a.athlete_id WHERE a.athlete_id=${athleteId} AND a.personal_id=${personalId} LIMIT 1`;
  return rows[0]||null;
}
async function getState(sql,athleteId){
  const rows=await sql`SELECT state FROM vf_cloud_state WHERE user_id=${athleteId} LIMIT 1`;
  return isObject(rows[0]?.state)?rows[0].state:{};
}
async function getCycle(sql,athleteId){
  const rows=await sql`SELECT cycle_days,cycle_started_at,cycle_ends_at FROM vf_training_plans WHERE athlete_id=${athleteId} LIMIT 1`;
  return normalizeCycle(rows[0]||{});
}
async function saveExperienceFields(sql,athleteId,{policy,requests,overrides}){
  const patch={};
  if(policy)patch.remapPolicy=normalizePolicy(policy);
  if(requests)patch.remapRequests=safeArray(requests,MAX_REQUESTS);
  if(overrides){
    const keys=Object.keys(overrides).sort().slice(-MAX_OVERRIDES),out={};
    keys.forEach(k=>{out[k]=overrides[k]});patch.weekOverrides=out;
  }
  await sql`INSERT INTO vf_cloud_state(user_id,state,state_version,updated_at) VALUES (${athleteId},CAST(${JSON.stringify(patch)} AS jsonb),1,now())
    ON CONFLICT(user_id) DO UPDATE SET state=COALESCE(vf_cloud_state.state,'{}'::jsonb)||EXCLUDED.state,state_version=vf_cloud_state.state_version+1,updated_at=now()`;
}
async function audit(sql,actorId,athleteId,action,payload={}){try{await sql`INSERT INTO vf_audit_log(actor_id,athlete_id,action,payload) VALUES (${actorId},${athleteId},${action},CAST(${JSON.stringify(payload)} AS jsonb))`}catch{}}
function publicRequest(r={}){return {id:r.id,status:r.status,createdAt:r.createdAt,decidedAt:r.decidedAt||null,weekKey:r.weekKey,skippedDate:r.skippedDate,workoutName:r.workoutName||'Treino',reason:r.reason||'',proposal:r.proposal||null,decisionNote:r.decisionNote||''}}

export default async function remapHandler(req,res){
  if(applyCors(req,res))return;
  res.setHeader('Cache-Control','no-store');
  const method=String(req.method||'GET').toUpperCase(),action=clean(req.query?.action||req.body?.action,40);
  try{
    if(action==='athlete_config'&&method==='GET'){
      const auth=await requireApprovedAthlete(req);if(!auth)return sendError(res,401,'Sessão inválida.','unauthorized');if(!auth.approved)return sendError(res,423,'Aluno ainda não está liberado.','athlete_not_approved');
      const state=await getState(auth.sql,auth.user.id),cycle=await getCycle(auth.sql,auth.user.id);
      return res.status(200).json({ok:true,policy:normalizePolicy(state.remapPolicy),cycle,requests:safeArray(state.remapRequests,MAX_REQUESTS).map(publicRequest),weekOverrides:isObject(state.weekOverrides)?state.weekOverrides:{}});
    }

    if(action==='request'&&method==='POST'){
      const auth=await requireApprovedAthlete(req);if(!auth)return sendError(res,401,'Sessão inválida.','unauthorized');if(!auth.approved)return sendError(res,423,'Aluno ainda não está liberado.','athlete_not_approved');
      const proposal=normalizeProposal(req.body?.proposal);if(!proposal)return sendError(res,400,'Sugestão de remanejamento inválida.','invalid_proposal');
      const state=await getState(auth.sql,auth.user.id),policy=normalizePolicy(state.remapPolicy),requests=safeArray(state.remapRequests,MAX_REQUESTS),overrides=isObject(state.weekOverrides)?{...state.weekOverrides}:{};
      const request={id:`remap_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,status:'pending',createdAt:new Date().toISOString(),weekKey:proposal.weekKey,skippedDate:proposal.skippedDate,workoutName:clean(req.body?.workoutName,100)||'Treino',reason:clean(req.body?.reason,240)||'Aluno informou indisponibilidade.',proposal};
      if(policy==='off')request.status='blocked';
      else if(policy==='auto'&&proposal.safe&&proposal.coverageComplete){request.status='approved_auto';request.decidedAt=new Date().toISOString();overrides[proposal.weekKey]={requestId:request.id,appliedAt:request.decidedAt,source:'aion_auto',entries:proposal.entries};}
      requests.push(request);
      await saveExperienceFields(auth.sql,auth.user.id,{policy,requests,overrides});
      await audit(auth.sql,auth.user.id,auth.user.id,'weekly_remap_requested',{requestId:request.id,policy,status:request.status,weekKey:proposal.weekKey,safe:proposal.safe,coverageComplete:proposal.coverageComplete});
      return res.status(200).json({ok:true,policy,status:request.status,applied:request.status==='approved_auto',request:publicRequest(request),weekOverrides:overrides});
    }

    const auth=await authenticateBearer(req,{roles:['personal']});if(!auth)return sendError(res,401,'Sessão inválida.','unauthorized');

    if(action==='summary'&&method==='GET'){
      const rows=await auth.sql`SELECT u.id,u.name,c.state FROM vf_athlete_access a JOIN vf_users u ON u.id=a.athlete_id LEFT JOIN vf_cloud_state c ON c.user_id=u.id WHERE a.personal_id=${auth.user.id} ORDER BY u.name`;
      const alerts=[],clients=[];
      for(const row of rows){const st=isObject(row.state)?row.state:{},requests=safeArray(st.remapRequests,MAX_REQUESTS),pending=requests.filter(r=>r?.status==='pending');clients.push({athleteId:row.id,name:row.name,policy:normalizePolicy(st.remapPolicy),pending:pending.map(publicRequest)});pending.forEach(r=>alerts.push({kind:'remap',severity:'warning',athleteId:row.id,name:row.name,requestId:r.id,message:`Solicitação de remanejamento da semana de ${r.weekKey}.`}))}
      return res.status(200).json({ok:true,clients,alerts,count:alerts.length});
    }

    if(action==='client'&&method==='GET'){
      const athleteId=clean(req.query?.athleteId,120);const linked=await linkedPersonal(auth.sql,auth.user.id,athleteId);if(!linked)return sendError(res,404,'Aluno não encontrado.','not_found');
      const state=await getState(auth.sql,athleteId),cycle=await getCycle(auth.sql,athleteId);
      return res.status(200).json({ok:true,policy:normalizePolicy(state.remapPolicy),requests:safeArray(state.remapRequests,MAX_REQUESTS).map(publicRequest),weekOverrides:isObject(state.weekOverrides)?state.weekOverrides:{},cycle});
    }

    if(action==='policy'&&method==='POST'){
      const athleteId=clean(req.body?.athleteId,120),policy=normalizePolicy(req.body?.policy);const linked=await linkedPersonal(auth.sql,auth.user.id,athleteId);if(!linked)return sendError(res,404,'Aluno não encontrado.','not_found');
      await saveExperienceFields(auth.sql,athleteId,{policy});await audit(auth.sql,auth.user.id,athleteId,'weekly_remap_policy_changed',{policy});return res.status(200).json({ok:true,policy});
    }

    if(action==='decision'&&method==='POST'){
      const athleteId=clean(req.body?.athleteId,120),requestId=clean(req.body?.requestId,120),decision=clean(req.body?.decision,20);const linked=await linkedPersonal(auth.sql,auth.user.id,athleteId);if(!linked)return sendError(res,404,'Aluno não encontrado.','not_found');if(!['approve','reject','modify'].includes(decision))return sendError(res,400,'Decisão inválida.','invalid_decision');
      const state=await getState(auth.sql,athleteId),requests=safeArray(state.remapRequests,MAX_REQUESTS),overrides=isObject(state.weekOverrides)?{...state.weekOverrides}:{},idx=requests.findIndex(r=>r?.id===requestId);if(idx<0)return sendError(res,404,'Solicitação não encontrada.','request_not_found');
      const reqItem={...requests[idx]};if(reqItem.status!=='pending')return sendError(res,409,'Esta solicitação já foi analisada.','already_decided');
      let proposal=decision==='modify'?normalizeProposal(req.body?.proposal):normalizeProposal(reqItem.proposal);if(decision!=='reject'&&!proposal)return sendError(res,400,'Remanejamento inválido.','invalid_proposal');
      reqItem.status=decision==='reject'?'rejected':decision==='modify'?'approved_modified':'approved';reqItem.decidedAt=new Date().toISOString();reqItem.decisionNote=clean(req.body?.note,300);if(proposal)reqItem.proposal=proposal;
      if(decision!=='reject')overrides[proposal.weekKey]={requestId:reqItem.id,appliedAt:reqItem.decidedAt,source:decision==='modify'?'personal_modified':'personal_approved',entries:proposal.entries};
      requests[idx]=reqItem;await saveExperienceFields(auth.sql,athleteId,{requests,overrides});await audit(auth.sql,auth.user.id,athleteId,'weekly_remap_decided',{requestId,decision,weekKey:proposal?.weekKey||reqItem.weekKey});
      return res.status(200).json({ok:true,request:publicRequest(reqItem),weekOverrides:overrides});
    }

    return sendError(res,404,'Rota não encontrada.','not_found');
  }catch(error){console.error('Remap handler error',{action,code:String(error?.code||error?.name||'error').slice(0,80)});return sendError(res,500,'Não foi possível concluir o remanejamento agora.','server_error')}
}
