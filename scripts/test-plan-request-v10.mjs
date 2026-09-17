import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

test('plan generation never schedules a selected rest day',async()=>{
  const source=await readFile(new URL('../app-core.js',import.meta.url),'utf8');
  const context={console,Blob,fetch:async()=>({ok:false}),localStorage:{getItem:()=>null,setItem:()=>{}},setTimeout,clearTimeout,Date};
  vm.createContext(context);
  vm.runInContext(`${source}\nstate.profile={...state.profile,days:4,mode:'hybrid',restDays:[0,3]};generatePlan();globalThis.__days=state.plan.map(x=>x.day);`,context);
  assert.ok(context.__days.length>0);
  assert.equal(context.__days.includes(0),false);
  assert.equal(context.__days.includes(3),false);
});

test('new-user assessment captures rest days',async()=>{
  const profile=await readFile(new URL('../app-profile-v2.js',import.meta.url),'utf8');
  const onboarding=await readFile(new URL('../app-onboarding-v3.js',import.meta.url),'utf8');
  assert.match(profile,/name="restDays"/);
  assert.match(profile,/A AION não colocará treinos nesses dias/);
  assert.match(onboarding,/fd\.getAll\('restDays'\)/);
  assert.match(onboarding,/p\.restDays/);
});

test('new-plan request preserves current plan until personal review',async()=>{
  const source=await readFile(new URL('../app-plan-request-v10.js',import.meta.url),'utf8');
  assert.match(source,/Seu treino atual não será alterado agora/);
  assert.match(source,/plan_change_request/);
  assert.doesNotMatch(source,/generatePlan\(\)/);
});

test('weekly remapping also excludes fixed rest days',async()=>{
  const source=await readFile(new URL('../app-calendar-cycle-v7.js',import.meta.url),'utf8');
  assert.match(source,/restDays\.has\(d\.getDay\(\)\)/);
});

test('personal AION draft honors requested rest days',async()=>{
  const tools=await readFile(new URL('../lib/personal-tools-handler.js',import.meta.url),'utf8');
  const ops=await readFile(new URL('../api/personal-ops.js',import.meta.url),'utf8');
  assert.match(tools,/applyRestDays\(canonicalizePlan/);
  assert.match(ops,/data\.plan=applyRestDays/);
});
