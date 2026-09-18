import { readFile } from 'node:fs/promises';

export async function readRelease(){
  const release=JSON.parse(await readFile(new URL('../release.json',import.meta.url),'utf8'));
  if(!/^\d+\.\d+\.\d+$/.test(String(release.version)))throw new Error('release.json: versão semântica inválida.');
  if(!Number.isInteger(Number(release.versionCode))||Number(release.versionCode)<1)throw new Error('release.json: versionCode inválido.');
  for(const app of ['fitness','personal'])if(!release.apps?.[app]?.appId)throw new Error(`release.json: appId ausente para ${app}.`);
  return release;
}

export function publicManifest(release,app){
  return {version:release.version,versionCode:Number(release.versionCode),notes:release.notes||'',downloadUrl:release.apps[app].downloadUrl||''};
}
