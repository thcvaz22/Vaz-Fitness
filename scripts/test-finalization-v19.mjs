import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [api,membership,auth,planSync,personal,releaseWorkflow]=await Promise.all([
  source('api/vf.js'),source('app-membership.js'),source('app-auth-entry-v8.js'),source('app-plan-sync-v11.js'),source('personal/advanced-v8.js'),source('.github/workflows/android-release.yml')
]);

const checks=[
  [/baseVersion===0/,api,'criação otimista da nuvem'],
  [/state_version=state_version\+1/,api,'incremento de versão da nuvem'],
  [/error:'sync_conflict'/,api,'resposta explícita de conflito'],
  [/mergeCloudConflict/,membership,'combinação de alterações locais e remotas'],
  [/SYNC_QUEUE_KEY='vazFitness\.pendingSync\.v19'/,membership,'fila local offline do aluno'],
  [/window\.addEventListener\('online'/,membership,'retomada automática do aluno'],
  [/delete copy\.plan/,membership,'plano excluído do snapshot genérico'],
  [/state\.cloudStateVersion=cloudVersion/,auth,'versão restaurada após reinstalação'],
  [/window\.VazCloudSync\.syncNow/,planSync,'dias de descanso usam sincronizador único'],
  [/offline_write_blocked/,personal,'escritas críticas bloqueadas offline'],
  [/último backup local/,personal,'consulta offline do personal'],
  [/ANDROID_KEYSTORE_BASE64/,releaseWorkflow,'segredo da chave permanente'],
  [/Vaz-Personal\.apk/,releaseWorkflow,'APK Vaz Personal'],
  [/Vaz-Fitness\.apk/,releaseWorkflow,'APK Vaz Fitness']
];
for(const [pattern,text,label] of checks)assert.match(text,pattern,label);
console.log(`${checks.length} verificações de finalização técnica aprovadas.`);
