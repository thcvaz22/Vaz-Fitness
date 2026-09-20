import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');

const [ux,plan,training,calendar,cycle,membership,sw,build,fitnessCss,personal,personalCss,client360,aion,index,release]=await Promise.all([
  read('app-ux-v9.js'),read('app-plan-request-v10.js'),read('app-training.js'),read('app-calendar.js'),read('app-calendar-cycle-v7.js'),
  read('app-membership.js'),read('sw.js'),read('scripts/build-native.mjs'),read('styles.css'),
  read('personal/app-v2.js'),read('personal/app-v2.css'),read('personal/client-360-v22.js'),read('personal/aion-action-plan-v20.js'),
  read('personal/index-v2.html'),read('release.json')
]);

// Guia real de medidas.
for(const asset of ['overview.jpg','chest.jpg','waist.jpg','hip.jpg','arm.jpg','thigh.jpg']){
  const path='assets/measurements/male/'+asset;
  assert.ok(ux.includes(path),`guia masculino precisa usar ${path}`);
  assert.ok(sw.includes('./'+path),`cache precisa incluir ./${path}`);
  assert.ok(build.includes(path),`build nativo precisa incluir ${path}`);
}
assert.match(ux,/data-measure-detail-img/,'detalhe real de medição precisa ser interativo');
assert.ok(ux.includes('assets/measurements/male/overview.jpg'),'imagem principal masculina deve usar o novo caminho organizado');

// Descanso, remanejamento e treino extra.
assert.match(plan,/data-remap-workouts/,'aba Treinos precisa permitir remanejar');
assert.match(plan,/confirmRemapWorkouts/,'remanejamento deve usar modal próprio');
assert.doesNotMatch(plan,/\bconfirm\s*\(/,'remanejamento não pode usar confirm nativo');
assert.match(plan,/pendingExtraWorkout/,'dia de descanso precisa permitir seleção de treino extra');
assert.match(training,/extraWorkout/,'sessão extra deve ser persistida');
assert.doesNotMatch(training,/\bprompt\s*\(/,'fallback de corrida não pode usar prompt nativo');
assert.match(calendar,/Treino extra/,'calendário deve identificar treino extra');
assert.match(cycle,/Treino extra/,'ciclo deve identificar treino extra');

// Conflito por versão e reinstalação/sincronização.
assert.match(membership,/sync_conflict/,'cliente precisa tratar conflito de versão');
assert.match(membership,/cloudStateVersion/,'cliente precisa manter versão de estado');
assert.match(membership,/baseVersion/,'push precisa enviar versão base');
assert.match(membership,/mergeCloudConflict/,'conflito deve usar merge de estado');
assert.match(membership,/delete copy\.pendingExtraWorkout/,'estado transitório não deve contaminar nuvem');
assert.match(plan,/planDayOverrides/,'remanejamento precisa sobreviver à sincronização sem alterar exercícios');
assert.match(plan,/weekOverridesResetPending/,'troca de descanso deve invalidar overrides antigos');

// Visão 360 e AION acionável.
assert.match(client360,/VISÃO 360º DO ALUNO/,'Personal precisa ter Visão 360');
assert.match(client360,/AION • plano de ação/,'Visão 360 deve integrar AION');
assert.match(client360,/data-360-tab="plan"/,'Visão 360 precisa abrir treino');
assert.match(client360,/data-360-tab="management"/,'Visão 360 precisa abrir gestão');
assert.match(index,/client-360-v22\.js/,'Visão 360 precisa ser carregada no Personal');
assert.match(aion,/data-aion-link/,'plano AION deve oferecer atalhos de ação');
assert.match(personal,/function vpConfirm/,'Personal precisa usar confirmação interna');
assert.doesNotMatch(personal,/\bconfirm\s*\(/,'Personal não deve usar confirm nativo');

// Responsividade defensiva.
assert.match(fitnessCss,/responsive hardening/,'Fitness precisa conter proteção de overflow');
assert.match(personalCss,/value hardening/,'Personal precisa proteger valores longos');
assert.match(personalCss,/overflow-x:hidden/,'Personal não deve permitir rolagem lateral global');

const version=JSON.parse(release);
assert.ok(/^0\.7\./.test(version.version)||/^0\.6\./.test(version.version),'release deve manter versionamento válido');
console.log('Pré-1.0: guia real, treino extra, identidade, 360, conflito e responsividade validados.');
