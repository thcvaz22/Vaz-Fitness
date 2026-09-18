import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readRelease,publicManifest } from './release-config.mjs';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const json=async path=>JSON.parse(await read(path));
const release=await readRelease();
const [pkg,fitnessManifest,personalManifest,fitnessCap,personalCap,releaseWorkflow,fitnessWorkflow,personalWorkflow]=await Promise.all([
  json('package.json'),json('version.json'),json('personal/version.json'),json('capacitor.config.json'),json('capacitor.personal.config.json'),
  read('.github/workflows/android-release.yml'),read('.github/workflows/android-debug.yml'),read('.github/workflows/android-personal-debug.yml')
]);

assert.equal(pkg.version,release.version,'package.json fora da versão oficial');
assert.deepEqual(fitnessManifest,publicManifest(release,'fitness'),'version.json fora da versão oficial');
assert.deepEqual(personalManifest,publicManifest(release,'personal'),'personal/version.json fora da versão oficial');
assert.equal(fitnessCap.appId,release.apps.fitness.appId,'appId do Vaz Fitness foi alterado');
assert.equal(personalCap.appId,release.apps.personal.appId,'appId do Vaz Personal foi alterado');
assert.notEqual(fitnessCap.appId,personalCap.appId,'os dois aplicativos precisam de IDs distintos');
assert.match(releaseWorkflow,/configure-release-signing\.mjs/,'release não aplica assinatura permanente');
assert.match(releaseWorkflow,/apksigner" verify --verbose Vaz-Personal\.apk/,'assinatura do Vaz Personal não é verificada');
assert.match(releaseWorkflow,/apksigner" verify --verbose Vaz-Fitness\.apk/,'assinatura do Vaz Fitness não é verificada');
assert.doesNotMatch(releaseWorkflow,/APP_VERSION_NAME:\s*[0-9]/,'workflow ainda possui versão duplicada');
assert.match(fitnessWorkflow,/configure-android-version\.mjs/,'APK Fitness debug fora da versão unificada');
assert.match(personalWorkflow,/configure-android-version\.mjs/,'APK Personal debug fora da versão unificada');
console.log(`Release consistente: ${release.version} (${release.versionCode}), ${fitnessCap.appId} e ${personalCap.appId}.`);
