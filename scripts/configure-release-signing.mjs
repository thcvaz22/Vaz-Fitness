import { readFile, writeFile } from 'node:fs/promises';

const file='android/app/build.gradle';
const required=['ANDROID_KEYSTORE_PATH','ANDROID_KEYSTORE_PASSWORD','ANDROID_KEY_ALIAS','ANDROID_KEY_PASSWORD'];
for(const name of required)if(!process.env[name])throw new Error(`Variável obrigatória ausente: ${name}`);
const versionCode=Math.max(1,Number(process.env.APP_VERSION_CODE)||50);
const versionName=String(process.env.APP_VERSION_NAME||'0.5.0').replace(/[^0-9A-Za-z._-]/g,'');
let source=await readFile(file,'utf8');
source=source.replace(/versionCode\s+\d+/,`versionCode ${versionCode}`).replace(/versionName\s+"[^"]+"/,`versionName "${versionName}"`);
source=source.replace('    buildTypes {',`    signingConfigs {
        release {
            storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'))
            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
            keyAlias System.getenv('ANDROID_KEY_ALIAS')
            keyPassword System.getenv('ANDROID_KEY_PASSWORD')
        }
    }
    buildTypes {`);
source=source.replace('        release {\n            minifyEnabled false','        release {\n            signingConfig signingConfigs.release\n            minifyEnabled false');
await writeFile(file,source);
console.log(`Android release configurado: ${versionName} (${versionCode}).`);
