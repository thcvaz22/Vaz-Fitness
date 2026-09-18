import { readFile,writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { readRelease } from './release-config.mjs';

export async function configureAndroidVersion(file='android/app/build.gradle'){
  const release=await readRelease();
  let source=await readFile(file,'utf8');
  source=source.replace(/versionCode\s+\d+/,`versionCode ${release.versionCode}`).replace(/versionName\s+"[^"]+"/,`versionName "${release.version}"`);
  await writeFile(file,source);
  return release;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const release=await configureAndroidVersion();
  console.log(`Android configurado: ${release.version} (${release.versionCode}).`);
}
