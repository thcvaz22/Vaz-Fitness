import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const [plan,training,running,calendar,cycle,ux,index,personalCss,visual,studentBrand,asset,remapHandler,membership]=await Promise.all([
  read('app-plan-request-v10.js'),read('app-training.js'),read('app-running.js'),read('app-calendar.js'),read('app-calendar-cycle-v7.js'),
  read('app-ux-v9.js'),read('index.html'),read('personal/app-v2.css'),read('personal/visual-system-v11.js'),read('app-branding.js'),
  read('assets/body-measurement-guide-v4.svg'),read('lib/remap-handler.js'),read('app-membership.js')
]);

assert.match(plan,/data-remap-workouts/,'Treinos precisa oferecer remanejamento');
assert.match(plan,/delete item\.scheduledDate/,'Remanejamento deve recalcular data');
assert.match(plan,/data-extra-workout-open/,'Dia de descanso precisa permitir treino extra');
assert.match(plan,/pendingExtraWorkout/,'Escolha do treino extra precisa ser persistida até o início');
assert.match(plan,/const baseWorkout=renderWorkout/,'Dias de descanso devem entrar na aba Treinos');
assert.match(plan,/state\.weekOverrides=\{\}/,'Troca de descanso deve limpar remanejamentos semanais antigos');
assert.match(plan,/status!=='abandoned'/,'Remanejamento global deve considerar todos os treinos válidos, não só pendentes');
assert.match(cycle,/restDay\?'Descanso':'Sem treino'/,'Calendário só pode chamar de descanso um dia explicitamente selecionado');
assert.match(cycle,/weekOverridesResetPending/,'Sincronização não pode restaurar remanejamentos antigos enquanto a limpeza estiver pendente');
assert.match(remapHandler,/action==='reset_overrides'/,'Backend deve permitir invalidar remanejamentos antigos do aluno');
assert.match(remapHandler,/status:'superseded'/,'Solicitações antigas pendentes devem ser invalidadas ao trocar descanso');
assert.match(plan,/restDaysUpdatedAt=Date\.now\(\)/,'Troca de descanso precisa registrar versão temporal local');
assert.match(plan,/state\.remapRequests=\[\]/,'Troca de descanso deve limpar solicitações antigas');
assert.match(cycle,/if\(state\.weekOverridesResetPending\)return baseWeekEntries\(wk\)/,'Calendário deve ignorar overrides antigos imediatamente');
assert.match(membership,/localRestAt>remoteRestAt/,'Sincronização deve preservar descanso local mais recente');
assert.match(membership,/localResetPending/,'Sincronização deve preservar limpeza local de overrides');

assert.match(training,/extraWorkout:!!c\.extraWorkout/,'Musculação deve registrar flag extra');
assert.match(training,/if\(item&&!c\.extraWorkout\)item\.status='done'/,'Treino extra de força não pode concluir o plano');
assert.match(running,/extraWorkout:extra/,'Corrida deve herdar seleção extra');
assert.match(running,/if\(item&&!r\.extraWorkout\)/,'Corrida extra não pode concluir o plano');
assert.match(calendar,/session\.planId&&!session\.extraWorkout/,'Calendário não pode converter extra em planejado concluído');
assert.match(cycle,/!s\.extraWorkout&&sessionDate/,'Ciclo deve ignorar extra ao checar conclusão');

assert.match(ux,/body-measurement-guide-v4\.svg/,'Guia deve usar asset válido em retrato');
assert.match(asset,/viewBox="0 0 600 1000"/,'Guia corporal deve ser retrato');
assert.match(index,/class="avatar-btn"[\s\S]*?<svg/,'Botão de perfil deve ter ícone visível');

assert.match(personalCss,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/,'Navegação móvel do Personal deve comportar seis abas');
assert.match(personalCss,/overflow-x:hidden/,'Personal deve conter overflow horizontal');
for(const code of [visual,studentBrand]){
  assert.match(code,/lion:[\s\S]*?stroke-width="1\.55"/,'Leão deve usar ícone refinado');
  assert.match(code,/alligator:[\s\S]*?stroke-width="1\.55"/,'Jacaré deve usar ícone refinado');
  assert.match(code,/flame:[\s\S]*?stroke-width="1\.6"/,'Fogo deve usar ícone refinado');
}
console.log('Pacote descanso/treino extra/guia/mobile: regressões cobertas.');
