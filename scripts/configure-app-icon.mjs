import { mkdir, readFile, writeFile } from 'node:fs/promises';

const mode=String(process.argv[2]||'fitness').toLowerCase();
if(!['fitness','personal'].includes(mode))throw new Error('Use: node scripts/configure-app-icon.mjs fitness|personal');
const bg=mode==='personal'?'#050505':'#FFFFFF';
const drawableDir='android/app/src/main/res/drawable';
await mkdir(drawableDir,{recursive:true});

const vector=`<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
  android:width="108dp" android:height="108dp"
  android:viewportWidth="108" android:viewportHeight="108">
  <path android:fillColor="${bg}" android:pathData="M0,0h108v108h-108z"/>
  <path android:fillColor="#FFC928" android:pathData="M33,50h42v8h-42z"/>
  <path android:fillColor="#111111" android:pathData="M28,33h5v42h-5z"/>
  <path android:fillColor="#F5B400" android:pathData="M23,33h8v42h-8z"/>
  <path android:fillColor="#F5B400" android:pathData="M16,38h6v32h-6z"/>
  <path android:fillColor="#FFC928" android:pathData="M11,44h4v20h-4z"/>
  <path android:fillColor="#111111" android:pathData="M75,33h5v42h-5z"/>
  <path android:fillColor="#F5B400" android:pathData="M77,33h8v42h-8z"/>
  <path android:fillColor="#F5B400" android:pathData="M86,38h6v32h-6z"/>
  <path android:fillColor="#FFC928" android:pathData="M93,44h4v20h-4z"/>
  <path android:fillColor="#FFF07A" android:pathData="M23,33h8v5h-8zM77,33h8v5h-8zM16,38h6v4h-6zM86,38h6v4h-6z"/>
</vector>`;
await writeFile(`${drawableDir}/vaz_launcher.xml`,vector);

const manifestPath='android/app/src/main/AndroidManifest.xml';
let manifest=await readFile(manifestPath,'utf8');
manifest=manifest
  .replace(/android:icon="@[^"]+"/,'android:icon="@drawable/vaz_launcher"')
  .replace(/android:roundIcon="@[^"]+"/,'android:roundIcon="@drawable/vaz_launcher"');
await writeFile(manifestPath,manifest);
console.log(`${mode==='personal'?'Vaz Personal':'Vaz Fitness'} launcher icon configurado (${bg}).`);
