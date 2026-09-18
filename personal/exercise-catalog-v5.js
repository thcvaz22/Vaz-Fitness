// Vaz Personal v5 — ampliação do catálogo base para 154 exercícios.
(()=>{
  const additions=[
    {id:'squeeze-press-db',name:'Supino squeeze com halteres',muscle:'chest',equipment:'Halteres',secondary:['triceps','shoulders'],sets:3,reps:'10-15',rest:75,mediaQuery:'Dumbbell Squeeze Press'},
    {id:'floor-press-db',name:'Supino no chão com halteres',muscle:'chest',equipment:'Halteres',secondary:['triceps','shoulders'],sets:3,reps:'8-12',rest:90,mediaQuery:'Dumbbell Floor Press'},
    {id:'floor-press-bar',name:'Supino no chão com barra',muscle:'chest',equipment:'Barra',secondary:['triceps','shoulders'],sets:4,reps:'6-10',rest:120,mediaQuery:'Barbell Floor Press'},
    {id:'cable-press-single',name:'Supino unilateral na polia',muscle:'chest',equipment:'Polia',secondary:['triceps','shoulders','core'],sets:3,reps:'10-15',rest:75,mediaQuery:'Single Arm Cable Chest Press'},
    {id:'pushup-band',name:'Flexão de braços com elástico',muscle:'chest',equipment:'Elástico',secondary:['triceps','shoulders','core'],sets:3,reps:'8-15',rest:75,mediaQuery:'Resistance Band Push Up'},
    {id:'rack-pull',name:'Rack pull',muscle:'back',equipment:'Barra',secondary:['glutes','hamstrings','arms'],sets:4,reps:'5-8',rest:150,mediaQuery:'Barbell Rack Pull'},
    {id:'inverted-row',name:'Remada invertida',muscle:'back',equipment:'Barra fixa',secondary:['biceps','core'],sets:3,reps:'8-15',rest:75,mediaQuery:'Inverted Row'},
    {id:'cable-row-single',name:'Remada unilateral na polia',muscle:'back',equipment:'Polia',secondary:['biceps'],sets:3,reps:'10-15',rest:75,mediaQuery:'Single Arm Cable Row'},
    {id:'seal-row',name:'Remada Seal com barra',muscle:'back',equipment:'Barra e banco',secondary:['biceps'],sets:4,reps:'6-10',rest:105,mediaQuery:'Barbell Seal Row'},
    {id:'pullover-machine',name:'Pullover na máquina',muscle:'back',equipment:'Máquina',secondary:['chest','triceps'],sets:3,reps:'10-15',rest:75,mediaQuery:'Machine Pullover'},
    {id:'landmine-press-single',name:'Desenvolvimento unilateral Landmine',muscle:'shoulders',equipment:'Barra Landmine',secondary:['triceps','core'],sets:3,reps:'8-12',rest:75,mediaQuery:'Single Arm Landmine Press'},
    {id:'upright-row-cable',name:'Remada alta na polia',muscle:'shoulders',equipment:'Polia',secondary:['arms'],sets:3,reps:'10-15',rest:75,mediaQuery:'Cable Upright Row'},
    {id:'y-raise-incline',name:'Elevação Y no banco inclinado',muscle:'shoulders',equipment:'Halteres e banco',secondary:['back'],sets:3,reps:'12-18',rest:60,mediaQuery:'Incline Y Raise'},
    {id:'rear-delt-cable',name:'Crucifixo inverso na polia',muscle:'shoulders',equipment:'Polia',secondary:['back'],sets:3,reps:'12-18',rest:60,mediaQuery:'Cable Rear Delt Fly'},
    {id:'cuban-press',name:'Rotação cubana com halteres',muscle:'shoulders',equipment:'Halteres',secondary:['back'],sets:3,reps:'10-15',rest:60,mediaQuery:'Dumbbell Cuban Press'},
    {id:'belt-squat',name:'Agachamento com cinto',muscle:'quads',equipment:'Máquina Belt Squat',secondary:['glutes'],sets:4,reps:'8-12',rest:120,mediaQuery:'Belt Squat'},
    {id:'sissy-squat',name:'Agachamento Sissy',muscle:'quads',equipment:'Peso corporal',secondary:['core'],sets:3,reps:'10-15',rest:75,mediaQuery:'Sissy Squat'},
    {id:'pendulum-squat',name:'Agachamento pêndulo',muscle:'quads',equipment:'Máquina',secondary:['glutes'],sets:4,reps:'8-12',rest:120,mediaQuery:'Pendulum Squat'},
    {id:'box-squat',name:'Agachamento no banco',muscle:'quads',equipment:'Barra e banco',secondary:['glutes','core'],sets:4,reps:'6-10',rest:120,mediaQuery:'Barbell Box Squat'},
    {id:'spanish-squat',name:'Agachamento espanhol',muscle:'quads',equipment:'Faixa ou cinta',secondary:['glutes'],sets:3,reps:'10-15',rest:75,mediaQuery:'Spanish Squat'},
    {id:'leg-curl-slider',name:'Flexão de joelhos com slider',muscle:'hamstrings',equipment:'Discos deslizantes',secondary:['glutes','core'],sets:3,reps:'10-15',rest:75,mediaQuery:'Slider Leg Curl'},
    {id:'reverse-hyper',name:'Hiperextensão reversa',muscle:'hamstrings',equipment:'Máquina ou banco',secondary:['glutes','back'],sets:3,reps:'10-15',rest:75,mediaQuery:'Reverse Hyperextension'},
    {id:'back-extension-45',name:'Extensão de quadril no banco 45°',muscle:'hamstrings',equipment:'Banco 45°',secondary:['glutes','back'],sets:3,reps:'10-15',rest:75,mediaQuery:'45 Degree Back Extension'},
    {id:'kettlebell-swing',name:'Balanço com kettlebell',muscle:'hamstrings',equipment:'Kettlebell',secondary:['glutes','core','back'],sets:4,reps:'12-20',rest:75,mediaQuery:'Kettlebell Swing'},
    {id:'frog-pump',name:'Frog pump',muscle:'glutes',equipment:'Peso corporal',secondary:['hamstrings'],sets:3,reps:'15-25',rest:60,mediaQuery:'Frog Pump'},
    {id:'lateral-band-walk',name:'Caminhada lateral com elástico',muscle:'glutes',equipment:'Mini band',secondary:['quads'],sets:3,reps:'12-20',rest:45,mediaQuery:'Lateral Band Walk'},
    {id:'single-leg-hip-thrust',name:'Elevação pélvica unilateral',muscle:'glutes',equipment:'Banco',secondary:['hamstrings','core'],sets:3,reps:'10-15',rest:75,mediaQuery:'Single Leg Hip Thrust'},
    {id:'pull-through',name:'Pull-through na polia',muscle:'glutes',equipment:'Polia',secondary:['hamstrings','back'],sets:3,reps:'10-15',rest:75,mediaQuery:'Cable Pull Through'},
    {id:'bayesian-curl',name:'Rosca Bayesian na polia',muscle:'biceps',equipment:'Polia',secondary:['arms'],sets:3,reps:'10-15',rest:60,mediaQuery:'Bayesian Cable Curl'},
    {id:'drag-curl',name:'Rosca arrastada com barra',muscle:'biceps',equipment:'Barra',secondary:['arms'],sets:3,reps:'8-12',rest:75,mediaQuery:'Barbell Drag Curl'},
    {id:'zottman-curl',name:'Rosca Zottman',muscle:'biceps',equipment:'Halteres',secondary:['arms'],sets:3,reps:'10-14',rest:60,mediaQuery:'Zottman Curl'},
    {id:'high-cable-curl',name:'Rosca alta na polia',muscle:'biceps',equipment:'Polia',secondary:[],sets:3,reps:'10-15',rest:60,mediaQuery:'High Cable Curl'},
    {id:'cross-body-triceps',name:'Extensão de tríceps cruzada na polia',muscle:'triceps',equipment:'Polia',secondary:[],sets:3,reps:'10-15',rest:60,mediaQuery:'Cross Body Cable Triceps Extension'},
    {id:'jm-press',name:'JM press',muscle:'triceps',equipment:'Barra',secondary:['chest','shoulders'],sets:3,reps:'6-10',rest:90,mediaQuery:'JM Press'},
    {id:'diamond-pushup',name:'Flexão diamante',muscle:'triceps',equipment:'Peso corporal',secondary:['chest','shoulders','core'],sets:3,reps:'8-15',rest:75,mediaQuery:'Diamond Push Up'},
    {id:'single-arm-pushdown',name:'Tríceps unilateral na polia',muscle:'triceps',equipment:'Polia',secondary:[],sets:3,reps:'10-15',rest:60,mediaQuery:'Single Arm Cable Triceps Pushdown'},
    {id:'donkey-calf',name:'Panturrilha Donkey',muscle:'calves',equipment:'Máquina ou banco',secondary:[],sets:4,reps:'12-20',rest:60,mediaQuery:'Donkey Calf Raise'},
    {id:'tibialis-raise',name:'Elevação de tibial anterior',muscle:'calves',equipment:'Peso corporal',secondary:[],sets:3,reps:'15-25',rest:45,mediaQuery:'Tibialis Raise'},
    {id:'pogo-jump',name:'Saltos curtos de panturrilha',muscle:'calves',equipment:'Peso corporal',secondary:['core'],sets:3,reps:'20-30s',rest:60,mediaQuery:'Pogo Jump'},
    {id:'hollow-body',name:'Hollow body hold',muscle:'core',equipment:'Peso corporal',secondary:[],sets:3,reps:'20-45s',rest:45,mediaQuery:'Hollow Body Hold'},
    {id:'suitcase-carry',name:'Caminhada unilateral com peso',muscle:'core',equipment:'Halter ou kettlebell',secondary:['arms','back'],sets:3,reps:'30-60s',rest:60,mediaQuery:'Suitcase Carry'},
    {id:'russian-twist',name:'Rotação russa',muscle:'core',equipment:'Peso corporal ou anilha',secondary:[],sets:3,reps:'16-24',rest:45,mediaQuery:'Russian Twist'},
    {id:'v-up',name:'Abdominal V-up',muscle:'core',equipment:'Peso corporal',secondary:[],sets:3,reps:'10-20',rest:45,mediaQuery:'V Up'},
    {id:'wrist-extension',name:'Extensão de punho',muscle:'arms',equipment:'Halteres',secondary:[],sets:3,reps:'12-20',rest:45,mediaQuery:'Dumbbell Wrist Extension'},
    {id:'plate-pinch',name:'Pinça com anilhas',muscle:'arms',equipment:'Anilhas',secondary:['core'],sets:3,reps:'20-45s',rest:60,mediaQuery:'Plate Pinch Hold'}
  ];
  const legacy=Array.isArray(window.VAZ_EXERCISE_CATALOG_V4)?window.VAZ_EXERCISE_CATALOG_V4:[];
  const merged=new Map(legacy.map(exercise=>[exercise.id,exercise]));
  additions.forEach(exercise=>merged.set(exercise.id,exercise));
  window.VAZ_EXERCISE_CATALOG_V4=[...merged.values()];
  window.VAZ_EXERCISE_CATALOG_VERSION=5;
})();
