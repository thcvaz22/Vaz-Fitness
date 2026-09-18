import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
function moduleApi(){
  const memory=new Map(),context={console,setTimeout:()=>0,clearTimeout(){},Date,JSON,Math,FormData:class{},Notification:function(){},navigator:{},localStorage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,String(value)),removeItem:key=>memory.delete(key)},window:{addEventListener(){},Capacitor:null},renderHome(){return''},renderSettings(){return''},bindPersonal(){},async loadPersonal(){},ops:{alerts:[],finance:{},counts:{}},clients:[],me:{name:'Teste',role:'personal'},view:'home',selected:null,pageHead(){return''},money:value=>String(value),safe:value=>String(value),clientRows(){return''},toast(){},render(){}};
  vm.createContext(context);vm.runInContext(source('personal/today-center-v15.js'),context);return {api:context.window.__VAZ_TODAY_CENTER_TEST__,context};
}

test('central organiza prioridades e remove alertas duplicados',()=>{
  const {api}=moduleApi(),tasks=api.buildTasks([
    {kind:'billing',severity:'danger',athleteId:'a1',name:'Ana',message:'Mensalidade pendente'},
    {kind:'request',severity:'warning',athleteId:'a2',name:'Bia',message:'Solicitou treino',requestId:'r1'}
  ],[{id:'a3',name:'Caio',status:'pending'},{id:'a3',name:'Caio',status:'pending'}]);
  assert.equal(tasks.length,3);
  assert.equal(tasks[0].kind,'request');
  assert.equal(tasks[1].kind,'approval');
  assert.equal(tasks[2].kind,'billing');
  assert.equal(tasks[2].category,'finance');
});

test('itens críticos entram no filtro urgente',()=>{
  const {api}=moduleApi();
  assert.equal(api.isUrgent({severity:'danger',priority:20}),true);
  assert.equal(api.isUrgent({severity:'warning',priority:95}),true);
  assert.equal(api.isUrgent({severity:'warning',priority:60}),false);
});

test('notificações permitem horário, categorias e lembrete Android',()=>{
  const code=source('personal/today-center-v15.js');
  assert.match(code,/type="time"/);
  assert.match(code,/LocalNotifications/);
  assert.match(code,/allowWhileIdle:true/);
  assert.match(code,/training:true,finance:true,access:true/);
  assert.match(code,/Lembrar amanhã/);
});

test('resumo da API entrega prioridade e contadores da central',()=>{
  const code=source('api/personal-ops.js');
  assert.match(code,/kind:'approval'/);
  assert.match(code,/priority:100/);
  assert.match(code,/accessPending/);
  assert.match(code,/billingUpcoming/);
  assert.match(code,/totalActions:alerts\.length/);
});

test('site, cache e Android incluem a central v15',()=>{
  for(const file of ['personal/index.html','personal/index-v2.html','personal/sw.js','scripts/build-personal-native-v2.mjs']){
    const content=source(file);assert.match(content,/today-center-v15\.js/);assert.match(content,/today-center-v15\.css/);
  }
  assert.ok(Number(JSON.parse(source('personal/version.json')).versionCode)>=56);
});
