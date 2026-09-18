import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const [personal,student,styles,api,index,versionText]=await Promise.all([
  read('personal/visual-system-v11.js'),
  read('app-branding.js'),
  read('styles.css'),
  read('api/branding.js'),
  read('index.html'),
  read('personal/version.json')
]);

const home=personal.slice(personal.indexOf('renderHome=function'),personal.indexOf('const oldRenderSettings'));
const settings=personal.slice(personal.indexOf('renderSettings=function'),personal.indexOf('function colorControl'));
const icons=(personal.match(/const ICONS=\[(.*?)\];/)?.[1].match(/\['[a-z-]+','[^']+'\]/g)||[]);

assert.equal(icons.length,20,'a galeria deve oferecer 20 ícones');
for(const key of ['dumbbell','lion','bear','eagle','tree','flower','alligator','star','bolt']){
  assert.match(personal,new RegExp(`\\['${key}'`),`ícone obrigatório ausente: ${key}`);
  assert.match(student,new RegExp(`${key}:`),`ícone não é reconhecido pelo Vaz Fitness: ${key}`);
}

assert.match(home,/vp-quick-grid/,'ações rápidas devem usar a grade compacta');
assert.match(home,/vp-quick-icon/,'ações rápidas devem exibir ícones');
assert.doesNotMatch(home,/Atualizar dados/,'atalho redundante ainda aparece');
assert.match(settings,/id="profileForm"/,'cadastro deve permanecer nas configurações');
assert.match(settings,/id="passwordForm"/,'alteração de senha deve permanecer nas configurações');
assert.match(settings,/id="logoutBtn"/,'saída deve permanecer nas configurações');
assert.doesNotMatch(settings,/<h2>Gestão<\/h2>/,'card Gestão redundante ainda aparece');

for(const color of ['primaryColor','accentColor','backgroundColor','surfaceColor','textColor']){
  assert.match(personal,new RegExp(`setProperty\\('--preview-[^']+',get\\('${color}'\\)`),`prévia não reage a ${color}`);
}
assert.match(personal,/data-brand-icon=/,'galeria de ícones não está selecionável');
assert.match(personal,/#vf-icon=/,'ícone escolhido não é codificado para persistência');
assert.match(personal,/toast\('Identidade salva e sincronizada\.'\)/,'salvamento não confirma a sincronização');

assert.match(index,/class="brand-mark"/,'cabeçalho do Vaz Fitness não possui espaço para o ícone');
assert.match(student,/querySelectorAll\('\.brand strong'\)/,'nome salvo não é aplicado ao cabeçalho');
assert.match(student,/querySelectorAll\('\.brand-mark'\)/,'ícone salvo não é aplicado ao cabeçalho');
for(const variable of ['--page-bg','--white','--ink','--yellow','--black']){
  assert.ok(student.includes(`setProperty('${variable}'`),`paleta não aplica ${variable}`);
}
assert.match(styles,/\.card,.stat-card,.exercise-row\{background:var\(--white\)\}/,'cards não usam a superfície personalizada');
assert.match(styles,/\.bottom-nav,.live-card,.summary-hero,.aion-profile\{background:var\(--black\)/,'áreas de contraste não usam a paleta personalizada');

assert.match(api,/FROM vf_athlete_access/,'branding não localiza o personal do aluno vinculado');
assert.match(api,/getBrand\(auth\.sql,access\.personal_id\)/,'aluno vinculado não recebe a marca do personal');
assert.match(api,/ON CONFLICT \(personal_id\) DO UPDATE/,'branding não possui atualização persistente');

const version=JSON.parse(versionText);
assert.equal(version.version,'0.5.8');
assert.equal(version.versionCode,58);

console.log('Configurações e identidade visual: 33 verificações concluídas.');
