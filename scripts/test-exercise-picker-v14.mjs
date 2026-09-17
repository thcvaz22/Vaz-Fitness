import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const source=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('editor do aluno pesquisa e filtra a biblioteca',()=>{
  const code=source('personal/coach-tools-v4.js');
  assert.match(code,/Pesquisar pelo nome do exercício/);
  assert.match(code,/Todas as partes do corpo/);
  assert.match(code,/catalogPickerSource/);
  assert.match(code,/catalogPickerEquipment/);
  assert.match(code,/data-add-library/);
  assert.match(code,/data-swap-library/);
});

test('editor de plano padrão usa o mesmo fluxo pesquisável',()=>{
  const code=source('personal/training-library-v2.js');
  assert.match(code,/openTemplateExercisePicker/);
  assert.match(code,/data-tpl-add-ex/);
  assert.match(code,/data-tpl-pick/);
  assert.match(code,/tplPickerMuscle/);
  assert.match(code,/tplPickerSource/);
  assert.match(code,/tplPickerEquipment/);
});

test('seleção mantém prescrição e metadados do exercício',()=>{
  const code=source('personal/training-library-v2.js');
  assert.match(code,/function templateExercise\(base\)/);
  for(const field of ['secondary','sets','reps','rest','instructions','videoUrl','imageUrl','equipment','mediaQuery'])assert.match(code,new RegExp(`${field}:`));
});

test('recursos da busca entram no site, cache e pacote Android',()=>{
  const html=source('personal/index-v2.html');
  const publicHtml=source('personal/index.html');
  const sw=source('personal/sw.js');
  const build=source('scripts/build-personal-native-v2.mjs');
  for(const content of [html,publicHtml,sw,build])assert.match(content,/exercise-picker-v14\.css/);
  assert.match(publicHtml,/plan-history-v13\.js/);
  assert.ok(Number(JSON.parse(source('personal/version.json')).versionCode)>=55);
});
