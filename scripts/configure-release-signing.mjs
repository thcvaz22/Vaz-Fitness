import { readFile, writeFile } from 'node:fs/promises';
import { configureAndroidVersion } from './configure-android-version.mjs';
import { readRelease } from './release-config.mjs';

const file='android/app/build.gradle';
const required=['ANDROID_KEYSTORE_PATH','ANDROID_KEYSTORE_PASSWORD','ANDROID_KEY_ALIAS','ANDROID_KEY_PASSWORD'];
for(const name of required)if(!process.env[name])throw new Error(`Variável obrigatória ausente: ${name}`);
const release=await readRelease();
const versionCode=Number(release.versionCode);
const versionName=release.version;
await configureAndroidVersion(file);
let source=await readFile(file,'utf8');
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
