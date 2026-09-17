// Vaz Fitness — perfil físico ampliado e objetivo de emagrecimento.
(function installProfileV2(){
  const form=document.getElementById('onboardingForm');
  if(!form||document.querySelector('[data-step="5"]'))return;

  if(!state.onboarded&&state.profile.name==='Thiago')state.profile.name='';

  const original2=document.querySelector('[data-step="2"]');
  const original3=document.querySelector('[data-step="3"]');
  const original4=document.querySelector('[data-step="4"]');
  if(original2)original2.dataset.step='3';
  if(original3)original3.dataset.step='4';
  if(original4)original4.dataset.step='5';
  const restDays=Array.isArray(state.profile.restDays)?state.profile.restDays.map(Number):[];
  if(original4)original4.insertAdjacentHTML('beforeend',`<fieldset class="rest-day-field"><legend>Dias que você quer descansar</legend><p class="step-helper">A AION não colocará treinos nesses dias.</p><div class="rest-day-options">${[['0','Dom'],['1','Seg'],['2','Ter'],['3','Qua'],['4','Qui'],['5','Sex'],['6','Sáb']].map(([v,l])=>`<label><input type="checkbox" name="restDays" value="${v}" ${restDays.includes(Number(v))?'checked':''}><span>${l}</span></label>`).join('')}</div><small data-rest-limit></small></fieldset>`);

  function alignRestDays(showMessage=false){
    const trainingDays=Math.max(2,Math.min(6,Number(form.elements.days?.value)||4));
    const maxRest=7-trainingDays,inputs=[...form.querySelectorAll('input[name="restDays"]')];
    const checked=inputs.filter(input=>input.checked);
    if(checked.length>maxRest){checked.slice(maxRest).forEach(input=>{input.checked=false});if(showMessage)toast(`Com ${trainingDays} dias de treino, escolha no máximo ${maxRest} dia(s) de descanso.`)}
    const count=inputs.filter(input=>input.checked).length;
    inputs.forEach(input=>{input.disabled=!input.checked&&count>=maxRest});
    const helper=form.querySelector('[data-rest-limit]');
    if(helper)helper.textContent=`Com ${trainingDays} dias de treino, você pode escolher até ${maxRest} dia(s) de descanso.`;
  }
  form.addEventListener('change',event=>{if(event.target?.matches?.('input[name="restDays"],input[name="days"]'))alignRestDays(true)},true);
  form.addEventListener('input',event=>{if(event.target?.matches?.('input[name="days"]'))alignRestDays(true)},true);
  alignRestDays();

  const physical=document.createElement('div');
  physical.className='step';
  physical.dataset.step='2';
  physical.innerHTML=`
    <h2>Conte um pouco sobre você</h2>
    <p class="step-helper">Esses dados ajudam a AION a calibrar volume, impacto, recuperação e progressão.</p>
    <label>Nome
      <input name="name" type="text" maxlength="40" value="${escapeHtml(state.profile.name||'')}" placeholder="Como quer ser chamado?" required>
    </label>
    <div class="field-row" style="margin-top:14px">
      <label>Idade
        <input name="age" type="number" inputmode="numeric" min="13" max="100" value="${state.profile.age||''}" placeholder="Ex.: 34" required>
      </label>
      <label>Sexo
        <select name="sex" required>
          <option value="" ${!state.profile.sex?'selected':''} disabled>Selecione</option>
          <option value="male" ${state.profile.sex==='male'?'selected':''}>Masculino</option>
          <option value="female" ${state.profile.sex==='female'?'selected':''}>Feminino</option>
          <option value="other" ${state.profile.sex==='other'?'selected':''}>Outro / intersexo</option>
          <option value="prefer_not" ${state.profile.sex==='prefer_not'?'selected':''}>Prefiro não informar</option>
        </select>
      </label>
    </div>
    <div class="field-row">
      <label>Peso atual (kg)
        <input name="weight" type="number" inputmode="decimal" min="30" max="350" step="0.1" value="${state.profile.weight||''}" placeholder="Ex.: 80" required>
      </label>
      <label>Altura (cm)
        <input name="height" type="number" inputmode="numeric" min="120" max="230" step="1" value="${state.profile.height||''}" placeholder="Ex.: 175" required>
      </label>
    </div>`;
  original2?.before(physical);

  const goalSelect=form.querySelector('select[name="goal"]');
  if(goalSelect&&!goalSelect.querySelector('option[value="weight_loss"]')){
    const opt=document.createElement('option');opt.value='weight_loss';opt.textContent='Emagrecimento';goalSelect.appendChild(opt);
  }

  const style=document.createElement('style');
  style.textContent=`.step-helper{color:var(--muted);margin:-8px 0 18px;line-height:1.5}.physical-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px}.physical-summary>div{background:#fafafa;border:1px solid var(--line);border-radius:16px;padding:13px}.physical-summary span{display:block;color:var(--muted);font-size:10px}.physical-summary strong{font-size:15px}.rest-day-field{border:1px solid var(--line);border-radius:18px;padding:14px;margin-top:16px}.rest-day-field legend{font-weight:850;padding:0 6px}.rest-day-field .step-helper{margin:2px 0 10px}.rest-day-options{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.rest-day-options label{margin:0}.rest-day-options input{position:absolute;opacity:0}.rest-day-options span{display:grid;place-items:center;padding:9px 3px;border:1px solid var(--line);border-radius:12px;font-size:10px;font-weight:850}.rest-day-options input:checked+span{background:#191919;color:#fff;border-color:#191919}@media(max-width:560px){.physical-summary{grid-template-columns:1fr 1fr}.rest-day-options{grid-template-columns:repeat(4,1fr)}}`;
  document.head.appendChild(style);

  showStep=function(){
    document.querySelectorAll('.step').forEach(s=>s.classList.toggle('active',+s.dataset.step===currentStep));
    document.getElementById('stepCounter').textContent=`${currentStep}/5`;
    document.getElementById('prevStep').style.visibility=currentStep===1?'hidden':'visible';
    document.getElementById('nextStep').classList.toggle('hidden',currentStep===5);
    document.getElementById('finishOnboarding').classList.toggle('hidden',currentStep!==5);
    document.querySelector('.progress-ring').style.background=`conic-gradient(var(--yellow) ${currentStep*20}%,#eee 0)`;
    document.querySelector('.onboarding-dialog')?.scrollTo({top:0,behavior:'smooth'});
  };
  document.getElementById('nextStep').onclick=()=>{currentStep=Math.min(5,currentStep+1);showStep()};
  document.getElementById('prevStep').onclick=()=>{currentStep=Math.max(1,currentStep-1);showStep()};

  form.onsubmit=e=>{
    e.preventDefault();
    const fd=new FormData(e.currentTarget);
    const name=String(fd.get('name')||'').trim().slice(0,40);
    const age=Number(fd.get('age')),weight=Number(fd.get('weight')),height=Number(fd.get('height'));
    if(!name){toast('Informe seu nome.');return;}
    if(!Number.isFinite(age)||age<13||age>100||!Number.isFinite(weight)||weight<30||weight>350||!Number.isFinite(height)||height<120||height>230){toast('Revise idade, peso e altura.');return;}
    state.profile={...state.profile,
      name,age,weight,height,sex:fd.get('sex')||'prefer_not',profileVersion:2,
      mode:fd.get('mode'),goal:fd.get('goal'),level:fd.get('level'),priorityMuscle:fd.get('priorityMuscle'),
      days:+fd.get('days'),minutes:+fd.get('minutes'),location:fd.get('location'),runLevel:fd.get('runLevel'),easyPace:fd.get('easyPace')||'5:30',restDays:fd.getAll('restDays').map(Number).slice(0,5)
    };
    state.onboarded=true;generatePlan();save();document.getElementById('onboardingDialog').close();render();toast('Plano personalizado gerado!');
  };

  const oldGoalName=goalName;
  goalName=function(g){return g==='weight_loss'?'Emagrecimento':oldGoalName(g)};

  const oldGeneratePlan=generatePlan;
  generatePlan=function(){
    oldGeneratePlan();
    if(state.profile.goal==='weight_loss'){
      state.plan.filter(x=>x.type==='strength').forEach(day=>{
        day.goalTag='Emagrecimento';
        day.exercises=day.exercises.map((ex,index)=>({...ex,rest:index<2?Math.max(90,ex.rest-15):Math.max(45,ex.rest-15)}));
      });
      save();
    }
  };

  const oldRenderProfile=renderProfile;
  renderProfile=function(){
    const html=oldRenderProfile();
    const p=state.profile;
    const sexLabel={male:'Masculino',female:'Feminino',other:'Outro / intersexo',prefer_not:'Não informado'}[p.sex]||'Não informado';
    const extra=`<div class="card"><div class="card-head"><div><h2>Perfil físico</h2><p>Dados usados pela AION para individualizar o planejamento</p></div></div><div class="physical-summary"><div><span>Idade</span><strong>${p.age||'—'} anos</strong></div><div><span>Peso</span><strong>${p.weight||'—'} kg</strong></div><div><span>Altura</span><strong>${p.height||'—'} cm</strong></div><div><span>Sexo</span><strong>${sexLabel}</strong></div></div></div>`;
    return html.replace(/<\/section>\s*$/,`${extra}</section>`);
  };

  showStep();
  const authenticated=!!localStorage.getItem('vazFitness.authToken');
  const missingPhysical=authenticated&&state.onboarded&&(!state.profile.age||!state.profile.weight||!state.profile.height||!state.profile.sex||state.profile.profileVersion!==2);
  if(missingPhysical)setTimeout(()=>{toast('Atualizamos seu perfil. Complete idade, peso, altura e sexo para recalibrar o plano.');openOnboarding();},500);
})();
