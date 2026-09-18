import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const [ui,css,api,index,indexV2,sw,build,versionText,releaseText]=await Promise.all([
  read('personal/finance-v18.js'),read('personal/finance-v18.css'),read('api/personal-ops.js'),
  read('personal/index.html'),read('personal/index-v2.html'),read('personal/sw.js'),
  read('scripts/build-personal-native-v2.mjs'),read('personal/version.json'),read('release.json')
]);

const context={
  window:{},ops:{clients:[]},selected:null,selectedOps:null,view:'home',me:{name:'Personal Teste'},
  renderBilling(){},renderClientManagement(){return''},saveStudentBilling:async()=>{},bindPersonal(){},
  safe:String,money:value=>String(value),fmtDate:String,initials:()=>'',pageHead:()=>'',
  opsApi:async()=>({}),loadPersonal:async()=>{},toast(){},render(){},showModal(){return{}},
  navigator:{},document:{},confirm:()=>true,Blob,URL,FormData,setTimeout,clearTimeout,console
};
vm.runInNewContext(ui,context,{filename:'finance-v18.js'});
const finance=context.window.__VAZ_FINANCE_V18_TEST__;
assert.ok(finance,'financeiro deve expor verificações internas');

finance.setMonth('2026-09');
finance.setData({accounts:[
  {id:'a1',name:'Ana',billing:{configured:true,amount:100,billingDay:10,nextDueDate:'2026-10-10'}},
  {id:'a2',name:'Bia',billing:{configured:true,amount:150,billingDay:10,nextDueDate:'2026-09-10'}},
  {id:'a3',name:'Carlos',billing:{configured:false}}
],payments:[{id:'p1',athleteId:'a1',dueDate:'2026-09-10',amount:100,status:'paid',paidAt:'2026-09-08T12:00:00Z'}]});
const metrics=finance.metrics();
assert.equal(metrics.expected,250);
assert.equal(metrics.received,100);
assert.equal(metrics.toReceive,150);
assert.equal(metrics.rate,40);
assert.equal(metrics.paidCount,1);
assert.equal(metrics.pendingCount,1);
assert.equal(metrics.unconfigured,1);
assert.equal(finance.whatsappNumber('(41) 99999-9999'),'5541999999999');

for(const label of ['Total mensal previsto','Total recebido','Total a receber','Em atraso','Próximos vencimentos','Sem mensalidade configurada','Pagamentos realizados','Pagamentos pendentes'])assert.ok(ui.includes(label),`indicador ou filtro ausente: ${label}`);
for(const action of ['Marcar pago','Marcar pendente','Histórico','Recibo','WhatsApp','Exportar'])assert.ok(ui.includes(action),`ação financeira ausente: ${action}`);
assert.match(ui,/type="month" id="financeMonth"/);
assert.match(ui,/id="financeStatus"/);
assert.match(ui,/id="financeSearch"/);
assert.match(ui,/data-finance-config/);
assert.match(ui,/name="amount"/);
assert.match(ui,/name="dueDate"/);
assert.match(ui,/name="notes"/);
assert.match(ui,/name="contactPhone"/);
assert.match(ui,/navigator\.share/);
assert.match(ui,/Imprimir \/ salvar PDF/);
assert.match(ui,/if\(!confirm\(`Abrir o WhatsApp/,'WhatsApp precisa de confirmação explícita');
assert.ok(ui.indexOf('if(!confirm(`Abrir o WhatsApp')<ui.indexOf('window.open(`https://wa.me/'),'confirmação deve acontecer antes de abrir o WhatsApp');
assert.match(ui,/text\/csv;charset=utf-8/);

assert.match(api,/action==='finance'/);
assert.match(api,/action==='payment_update'/);
assert.match(api,/contact_phone/);
assert.match(api,/UNIQUE\(athlete_id,due_date\)/);
assert.match(api,/status='paid',paid_at=now\(\)/);
assert.match(api,/status='pending',paid_at=NULL/);
assert.match(api,/payment_marked_paid/);
assert.match(api,/payment_marked_pending/);

for(const source of [index,indexV2]){
  assert.match(source,/finance-v18\.css/);
  assert.match(source,/finance-v18\.js/);
}
assert.match(sw,/finance-v18\.css/);
assert.match(sw,/finance-v18\.js/);
assert.match(sw,/vaz-personal-v24-aion-action-plan/,'nova interface móvel precisa renovar o cache do Vaz Personal');
assert.match(build,/finance-v18\.css/);
assert.match(build,/finance-v18\.js/);
assert.match(css,/\.vp-student-finance-grid/);
assert.match(css,/\.vp-finance-ring/);
assert.doesNotMatch(css,/^\.vp-finance-metric-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}$/m,'grade financeira não pode sobrescrever o layout móvel');
assert.match(css,/overflow-wrap:anywhere/,'valores financeiros longos precisam continuar visíveis');
assert.match(css,/@media\(max-width:680px\)\{\.vp-finance-metric-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,'cards financeiros devem usar duas colunas no celular');

const version=JSON.parse(versionText),release=JSON.parse(releaseText);
assert.equal(version.version,release.version);
assert.equal(version.versionCode,release.versionCode);

console.log('Mensalidades e financeiro v18: 48 verificações concluídas.');
