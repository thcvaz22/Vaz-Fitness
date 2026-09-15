const DB_KEY = 'vazFitness.v1';
const muscleNames = { shoulders:'Ombros', chest:'Peitoral', back:'Costas', quads:'Quadríceps', hamstrings:'Posteriores', glutes:'Glúteos', arms:'Braços', core:'Core', triceps:'Tríceps', biceps:'Bíceps', calves:'Panturrilhas' };
const weekdayNames = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
const dayLong = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

const exerciseLibrary = [
  {id:'bench',mediaQuery:'Barbell Bench Press',name:'Supino reto',muscle:'chest',secondary:['triceps','shoulders'],reps:'6–10',sets:4,load:70,icon:'🏋️',rest:120},
  {id:'incline-db',mediaQuery:'Incline Dumbbell Bench Press',name:'Supino inclinado com halteres',muscle:'chest',secondary:['shoulders','triceps'],reps:'8–12',sets:3,load:28,icon:'↗️',rest:90},
  {id:'fly',mediaQuery:'Cable Fly',name:'Crucifixo na polia',muscle:'chest',secondary:['shoulders'],reps:'10–15',sets:3,load:18,icon:'🪽',rest:75},
  {id:'ohp',mediaQuery:'Dumbbell Shoulder Press',name:'Desenvolvimento com halteres',muscle:'shoulders',secondary:['triceps'],reps:'6–10',sets:4,load:22,icon:'⬆️',rest:105},
  {id:'lateral',mediaQuery:'Dumbbell Lateral Raise',name:'Elevação lateral',muscle:'shoulders',secondary:[],reps:'12–18',sets:4,load:10,icon:'↔️',rest:60},
  {id:'rear-delt',mediaQuery:'Reverse Fly',name:'Crucifixo inverso',muscle:'shoulders',secondary:['back'],reps:'12–18',sets:3,load:16,icon:'🔁',rest:60},
  {id:'pulldown',mediaQuery:'Lat Pulldown',name:'Puxada alta',muscle:'back',secondary:['biceps'],reps:'8–12',sets:4,load:55,icon:'⬇️',rest:90},
  {id:'row',mediaQuery:'Seated Cable Row',name:'Remada baixa',muscle:'back',secondary:['biceps'],reps:'8–12',sets:4,load:55,icon:'🚣',rest:90},
  {id:'db-row',mediaQuery:'One Arm Dumbbell Row',name:'Remada unilateral',muscle:'back',secondary:['biceps'],reps:'8–12',sets:3,load:30,icon:'🧱',rest:90},
  {id:'squat',mediaQuery:'Barbell Back Squat',name:'Agachamento livre',muscle:'quads',secondary:['glutes','core'],reps:'5–8',sets:4,load:80,icon:'🦵',rest:150},
  {id:'legpress',mediaQuery:'Leg Press',name:'Leg press',muscle:'quads',secondary:['glutes'],reps:'8–12',sets:4,load:160,icon:'🦿',rest:120},
  {id:'extension',mediaQuery:'Leg Extension',name:'Cadeira extensora',muscle:'quads',secondary:[],reps:'10–15',sets:3,load:45,icon:'⚙️',rest:75},
  {id:'rdl',mediaQuery:'Romanian Deadlift',name:'Levantamento romeno',muscle:'hamstrings',secondary:['glutes','back'],reps:'6–10',sets:4,load:70,icon:'🏗️',rest:120},
  {id:'curl-leg',mediaQuery:'Lying Leg Curl',name:'Mesa flexora',muscle:'hamstrings',secondary:[],reps:'10–15',sets:3,load:35,icon:'🧲',rest:75},
  {id:'hip',mediaQuery:'Barbell Hip Thrust',name:'Elevação pélvica',muscle:'glutes',secondary:['hamstrings'],reps:'8–12',sets:4,load:90,icon:'⛰️',rest:105},
  {id:'curl',mediaQuery:'Barbell Biceps Curl',name:'Rosca direta',muscle:'biceps',secondary:[],reps:'8–12',sets:3,load:20,icon:'💪',rest:75},
  {id:'hammer',mediaQuery:'Dumbbell Hammer Curl',name:'Rosca martelo',muscle:'biceps',secondary:['arms'],reps:'10–14',sets:3,load:14,icon:'🔨',rest:60},
  {id:'pushdown',mediaQuery:'Cable Triceps Pushdown',name:'Tríceps corda',muscle:'triceps',secondary:[],reps:'10–15',sets:3,load:28,icon:'🪢',rest:60},
  {id:'overtri',mediaQuery:'Overhead Triceps Extension',name:'Tríceps francês',muscle:'triceps',secondary:[],reps:'10–14',sets:3,load:18,icon:'🎯',rest:60},
  {id:'plank',mediaQuery:'Plank',name:'Prancha',muscle:'core',secondary:[],reps:'30–60s',sets:3,load:0,icon:'🧘',rest:45},
  {id:'calf',mediaQuery:'Standing Calf Raise',name:'Panturrilha em pé',muscle:'calves',secondary:[],reps:'12–20',sets:4,load:40,icon:'🦶',rest:60},
];

const splits = {
  2:[['Full Body A',['squat','bench','pulldown','rdl','lateral','plank']],['Full Body B',['legpress','incline-db','row','hip','ohp','curl']]],
  3:[['Full Body A',['squat','bench','pulldown','lateral','curl-leg','plank']],['Full Body B',['rdl','incline-db','row','ohp','extension','pushdown']],['Full Body C',['legpress','db-row','fly','hip','lateral','curl']]],
  4:[['Superior A',['bench','row','ohp','pulldown','lateral','pushdown']],['Inferior A',['squat','rdl','extension','curl-leg','calf','plank']],['Superior B',['incline-db','db-row','lateral','rear-delt','curl','overtri']],['Inferior B',['legpress','hip','curl-leg','extension','calf','plank']]],
  5:[['Push',['bench','ohp','incline-db','lateral','pushdown','overtri']],['Pull',['pulldown','row','db-row','curl','hammer','rear-delt']],['Pernas',['squat','rdl','legpress','curl-leg','calf','plank']],['Superior',['incline-db','row','lateral','pulldown','curl','pushdown']],['Inferior',['hip','legpress','rdl','extension','calf','plank']]],
  6:[['Push A',['bench','ohp','incline-db','lateral','pushdown','overtri']],['Pull A',['pulldown','row','db-row','curl','hammer','rear-delt']],['Pernas A',['squat','rdl','legpress','curl-leg','calf','plank']],['Push B',['incline-db','ohp','fly','lateral','pushdown','overtri']],['Pull B',['row','pulldown','rear-delt','db-row','curl','hammer']],['Pernas B',['hip','legpress','rdl','extension','curl-leg','calf']]],
};

function defaultState(){
  return {
    onboarded:false,
    profile:{name:'Thiago',mode:'hybrid',goal:'hypertrophy',level:'intermediate',priorityMuscle:'shoulders',days:4,minutes:60,location:'gym',runLevel:'regular',easyPace:'5:20'},
    plan:[], sessions:[], runSessions:[], skipped:[], current:null,
    chat:[{role:'ai',text:'Olá! Eu sou a AION. Vou acompanhar seus treinos, cargas, esforço e recuperação para ajustar seu plano conforme você evolui.'}],
    score:82
  };
}
let state = load();
let activeView='home';
let workoutTimer=null;
let seconds=0;
let currentExerciseIndex=0;
let pendingEffortExercise=null;
let exerciseMediaCache=null;
const REPDB_BASE='https://exercise-dataset.com/';

function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c]))}
function normalizeText(value=''){return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
async function getRepDb(){
  if(exerciseMediaCache)return exerciseMediaCache;
  const r=await fetch(`${REPDB_BASE}exercises.json`);
  if(!r.ok)throw new Error('Não foi possível carregar a biblioteca visual.');
  exerciseMediaCache=await r.json();
  return exerciseMediaCache;
}
async function findExerciseMedia(ex){
  const data=await getRepDb();
  const target=normalizeText(ex.mediaQuery||ex.name);
  const exact=data.exercises.find(x=>normalizeText(x.name_en)===target || normalizeText(x.id)===target.replace(/ /g,' '));
  if(exact)return exact;
  const words=target.split(' ').filter(w=>w.length>2);
  return data.exercises.find(x=>{const n=normalizeText(x.name_en);return words.every(w=>n.includes(w))}) || null;
}
async function showExerciseMedia(ex){
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
    const tips=(m.tips_es||m.tips_en||[]).slice(0,3);
    const instructions=(m.instructions_es||m.instructions_en||[]).slice(0,5);
    content.innerHTML=`<div class="media-sheet"><div class="media-head"><div><span class="eyebrow">EXECUÇÃO DO EXERCÍCIO</span><h2>${escapeHtml(ex.name)}</h2><p>Demonstração visual alternando posição inicial e final.</p></div><button class="media-close" data-close-media>✕</button></div><div class="motion-demo">${start?`<img class="motion-frame frame-a" src="${REPDB_BASE+start}" alt="Posição inicial de ${escapeHtml(ex.name)}">`:''}${peak?`<img class="motion-frame frame-b" src="${REPDB_BASE+peak}" alt="Posição final de ${escapeHtml(ex.name)}">`:''}<span class="motion-badge">DEMONSTRAÇÃO VISUAL</span></div><div class="media-info-grid"><div><h3>Como executar</h3><ol>${instructions.map(i=>`<li>${escapeHtml(i)}</li>`).join('')}</ol></div><div><h3>Pontos de atenção</h3><ul>${tips.map(i=>`<li>${escapeHtml(i)}</li>`).join('')||'<li>Mantenha a execução controlada e sem dor.</li>'}</ul><p class="media-credit">Exercise data by <a href="https://repdb.co" target="_blank" rel="noopener noreferrer">RepDB</a>.</p></div></div><div class="media-actions"><a class="btn ghost" href="https://www.youtube.com/results?search_query=${encodeURIComponent(ex.mediaQuery+' exercise form')}" target="_blank" rel="noopener noreferrer">Ver vídeos no YouTube</a><button class="btn primary" data-close-media>Voltar ao treino</button></div></div>`;
    content.querySelectorAll('[data-close-media]').forEach(b=>b.onclick=()=>dialog.close());
  }catch(err){
    content.innerHTML=`<div class="media-sheet"><div class="media-head"><div><span class="eyebrow">DEMONSTRAÇÃO</span><h2>${escapeHtml(ex.name)}</h2></div><button class="media-close" data-close-media>✕</button></div><div class="media-error"><strong>Conteúdo visual indisponível agora.</strong><p>${escapeHtml(err.message)}</p><a class="btn primary" href="https://www.youtube.com/results?search_query=${encodeURIComponent(ex.mediaQuery+' exercise form')}" target="_blank" rel="noopener noreferrer">Buscar vídeo demonstrativo</a></div></div>`;
    content.querySelectorAll('[data-close-media]').forEach(b=>b.onclick=()=>dialog.close());
  }
}

function load(){ try{return {...defaultState(),...JSON.parse(localStorage.getItem(DB_KEY)||'{}')}}catch{return defaultState()} }
function save(){localStorage.setItem(DB_KEY,JSON.stringify(state));}
function cloneExercise(id){
  const base=exerciseLibrary.find(x=>x.id===id);
  const hist=[...state.sessions].reverse().flatMap(s=>s.exercises||[]).find(e=>e.id===id);
  const load=hist?.nextLoad ?? hist?.load ?? base.load;
  return {...base,load,effort:null};
}
function getExerciseLimit(){ const m=+state.profile.minutes; return m<=30?4:m<=45?5:m<=60?6:m<=75?7:8; }
function priorityRelated(ex){ const p=state.profile.priorityMuscle; if(p==='arms')return ['biceps','triceps','arms'].includes(ex.muscle); return ex.muscle===p || ex.secondary.includes(p); }
function generatePlan(){
  const days=Math.max(2,Math.min(6,+state.profile.days||4));
  const base=splits[days];
  const today=new Date().getDay();
  const preferred=[1,2,3,4,5,6,0];
  const start=preferred.indexOf(today)>=0?preferred.indexOf(today):0;
  const scheduled=[];
  const limit=getExerciseLimit();
  for(let i=0;i<days;i++){
    const [name,ids]=base[i];
    let ex=ids.map(cloneExercise);
    const pri=exerciseLibrary.find(x=>x.muscle===state.profile.priorityMuscle && !ids.includes(x.id));
    if(pri && limit>ex.length) ex.push(cloneExercise(pri.id));
    ex=ex.slice(0,limit).map(e=>priorityRelated(e)?{...e,sets:e.sets+1,priority:true}:e);
    scheduled.push({id:`s-${Date.now()}-${i}`,type:'strength',name,day:preferred[(start+i*2)%7],duration:+state.profile.minutes,exercises:ex,status:'pending'});
  }
  if(state.profile.mode!=='strength'){
    const runCount=state.profile.mode==='run'?Math.max(3,Math.min(5,days)):Math.min(2,Math.max(1,7-days));
    const runTypes = state.profile.runLevel==='new'
      ? [['Corrida leve',25,'Leve'],['Caminhada + trote',30,'Leve'],['Corrida contínua',35,'Moderado']]
      : [['Rodagem leve',35,'Leve'],['Intervalado',45,'Forte'],['Longão',60,'Moderado'],['Tempo run',40,'Moderado']];
    for(let i=0;i<runCount;i++){
      const r=runTypes[i%runTypes.length];
      scheduled.push({id:`r-${Date.now()}-${i}`,type:'run',name:r[0],day:preferred[(start+i*3+1)%7],duration:r[1],intensity:r[2],pace:suggestRunPace(r[2]),status:'pending'});
    }
  }
  state.plan=scheduled.sort((a,b)=>orderFromToday(a.day)-orderFromToday(b.day));
  save();
}
function orderFromToday(day){const t=new Date().getDay();return (day-t+7)%7}
function paceToSeconds(p){const [m,s]=String(p||'5:30').split(':').map(Number);return (m||5)*60+(s||0)}
function secondsToPace(sec){sec=Math.max(180,Math.round(sec));return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`}
function suggestRunPace(intensity){
  let sec=paceToSeconds(state.profile.easyPace);
  const last=state.runSessions.at(-1);
  if(last?.effort==='easy') sec-=5; else if(last?.effort==='hard') sec+=8;
  if(intensity==='Forte')sec-=35; if(intensity==='Moderado')sec-=15;
  return secondsToPace(sec);
}
function todaysItem(){
  const t=new Date().getDay();
  return state.plan.find(x=>x.day===t && x.status==='pending') || state.plan.find(x=>x.status==='pending');
}
function toast(msg){let t=document.querySelector('.toast');if(!t){t=document.createElement('div');t.className='toast';document.body.appendChild(t)}t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
