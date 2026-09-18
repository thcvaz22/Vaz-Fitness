import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {EXERCISE_CATALOG,EXERCISE_CATALOG_VERSION} from '../lib/exercise-catalog-v5.js';

const source=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const muscles=new Set(['chest','back','shoulders','quads','hamstrings','glutes','arms','core','biceps','triceps','calves']);

test('catálogo v5 oferece 154 exercícios válidos e sem IDs duplicados',()=>{
  assert.equal(EXERCISE_CATALOG_VERSION,5);
  assert.equal(EXERCISE_CATALOG.length,154);
  assert.equal(new Set(EXERCISE_CATALOG.map(exercise=>exercise.id)).size,154);
  for(const exercise of EXERCISE_CATALOG){
    assert.ok(exercise.id&&exercise.name&&exercise.equipment&&exercise.mediaQuery);
    assert.ok(muscles.has(exercise.muscle),`Grupo inválido em ${exercise.id}`);
    assert.ok(Array.isArray(exercise.secondary));
    assert.ok(Number(exercise.sets)>=1&&Number(exercise.rest)>=0);
  }
});

test('catálogo do navegador corresponde ao catálogo da API',()=>{
  const context={window:{}};vm.createContext(context);
  vm.runInContext(source('personal/exercise-catalog-v4.js'),context);
  vm.runInContext(source('personal/exercise-catalog-v5.js'),context);
  assert.equal(context.window.VAZ_EXERCISE_CATALOG_VERSION,5);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.VAZ_EXERCISE_CATALOG_V4)),EXERCISE_CATALOG);
});

test('API salva e devolve imagem inicial, imagem final, vídeo e instruções',()=>{
  const handler=source('lib/training-library-handler.js');
  const tools=source('lib/personal-tools-handler.js');
  for(const code of [handler,tools]){
    assert.match(code,/exercise-catalog-v5\.js/);
    assert.match(code,/image_end_url/);
    assert.match(code,/imageEndUrl/);
  }
  assert.match(handler,/safeUrl\(req\.body\?\.imageEndUrl\)/);
  assert.match(handler,/ALTER TABLE vf_personal_exercises ADD COLUMN IF NOT EXISTS image_end_url text/);
});

test('Vaz Personal preserva e exibe o pacote completo de mídia',()=>{
  const gallery=source('personal/exercise-gallery-v10.js');
  const library=source('personal/training-library-v2.js');
  const coach=source('personal/coach-tools-v4.js');
  for(const code of [gallery,library,coach])assert.match(code,/imageEndUrl/);
  assert.match(gallery,/Posição inicial/);
  assert.match(gallery,/Posição final/);
  assert.match(gallery,/youtubeEmbed/);
  assert.match(gallery,/vimeoEmbed/);
  assert.match(gallery,/name="imageEndUrl"/);
});

test('Vaz Fitness mostra as duas imagens e vídeo enviados pelo personal',()=>{
  const media=source('app-custom-exercise-media.js');
  assert.match(media,/imagesHtml\(ex\)/);
  assert.match(media,/ex\.imageEndUrl/);
  assert.match(media,/Posição inicial/);
  assert.match(media,/Posição final/);
  assert.match(media,/youtubeEmbed/);
  assert.match(media,/vimeoEmbed/);
});

test('site, cache, pacote Android e versão incluem a biblioteca v5',()=>{
  for(const file of ['personal/index.html','personal/index-v2.html','personal/sw.js','scripts/build-personal-native-v2.mjs'])assert.match(source(file),/exercise-catalog-v5\.js/);
  const version=JSON.parse(source('personal/version.json'));
  assert.equal(version.version,'0.6.0');
  assert.equal(version.versionCode,60);
});
