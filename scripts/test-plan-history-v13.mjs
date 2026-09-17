import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source=file=>readFileSync(file,'utf8');

function loadHistoryModule(){
  const context=vm.createContext({
    window:{},renderClientManagement:()=>'<button id="openPlanHistory"></button><p>Consulte versões anteriores e restaure com segurança.</p>',bindPersonal(){},
    document:{createElement:()=>({textContent:''}),head:{appendChild(){}},getElementById:()=>null},
    safe:value=>String(value??''),toast(){},showModal(){},opsApi(){},selected:null,render(){}
  });
  vm.runInContext(source('personal/plan-history-v13.js'),context);
  return context.window.__VAZ_PLAN_HISTORY_TEST__;
}

test('visual history calculates plan metrics and rest days',()=>{
  const {planMetrics}=loadHistoryModule();
  const metrics=planMetrics([
    {day:1,type:'strength',duration:60,exercises:[{name:'Supino'},{name:'Remada'}]},
    {day:3,type:'run',duration:40}
  ]);
  assert.equal(metrics.days,2);assert.equal(metrics.strength,1);assert.equal(metrics.runs,1);assert.equal(metrics.exercises,2);assert.equal(metrics.minutes,100);
  assert.deepEqual([...metrics.restDays],[0,2,4,5,6]);
});

test('visual comparison identifies changed, recovered and removed days',()=>{
  const {comparePlans}=loadHistoryModule();
  const current=[{day:1,type:'strength',name:'A',duration:50,exercises:[{name:'Supino',sets:3,reps:'10'}]},{day:5,type:'run',name:'Corrida',duration:30}];
  const target=[{day:1,type:'strength',name:'A',duration:60,exercises:[{name:'Supino',sets:4,reps:'10'}]},{day:3,type:'run',name:'Tiros',duration:35}];
  const diff=comparePlans(current,target);
  assert.equal(diff.changed.length,1);assert.equal(diff.added.length,1);assert.equal(diff.removed.length,1);assert.equal(diff.totalChanges,3);
});

test('restore endpoint preserves current plan and uses optimistic version protection',()=>{
  const api=source('api/personal-ops.js');
  assert.match(api,/expectedVersion=Number\(req\.body\?\.expectedVersion\)/);
  assert.match(api,/WITH current AS MATERIALIZED/);
  assert.match(api,/source\)\s*\n\s*SELECT[\s\S]*'before_restore'/);
  assert.match(api,/plan_version_changed/);
  assert.match(api,/jsonb_build_object\('restDays'/);
});

test('personal web and native bundles include visual history module',()=>{
  assert.match(source('personal/index-v2.html'),/plan-history-v13\.js/);
  assert.match(source('personal/sw.js'),/plan-history-v13\.js/);
  assert.match(source('scripts/build-personal-native-v2.mjs'),/plan-history-v13\.js/);
});

test('applying a saved template also creates a restorable history snapshot',()=>{
  const library=source('lib/training-library-handler.js');
  assert.match(library,/before_template/);
  assert.match(library,/INSERT INTO vf_plan_history/);
  assert.match(library,/restDays=planRestDays\(tpl\.plan\)/);
});
