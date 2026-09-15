import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

async function configureAndroid(){
  const file='android/app/src/main/AndroidManifest.xml';
  if(!existsSync(file))return;
  let xml=await readFile(file,'utf8');
  const permissions=[
    '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
    '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
    '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
    '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />',
    '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />'
  ];
  for(const permission of permissions){if(!xml.includes(permission))xml=xml.replace('<application',`${permission}\n    <application`);}
  if(!xml.includes('android:scheme="vazfitness"')){
    const filter=`\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="vazfitness" />\n            </intent-filter>`;
    xml=xml.replace('</activity>',`${filter}\n        </activity>`);
  }
  await writeFile(file,xml);
}

async function configureIos(){
  const file='ios/App/App/Info.plist';
  if(!existsSync(file))return;
  let xml=await readFile(file,'utf8');
  const additions=[];
  if(!xml.includes('NSLocationWhenInUseUsageDescription'))additions.push('<key>NSLocationWhenInUseUsageDescription</key><string>O Vaz Fitness usa sua localização para registrar distância, pace e rota durante a corrida.</string>');
  if(!xml.includes('NSLocationAlwaysAndWhenInUseUsageDescription'))additions.push('<key>NSLocationAlwaysAndWhenInUseUsageDescription</key><string>O Vaz Fitness precisa continuar registrando sua corrida quando a tela estiver bloqueada.</string>');
  if(!xml.includes('<string>location</string>'))additions.push('<key>UIBackgroundModes</key><array><string>location</string></array>');
  if(!xml.includes('<string>vazfitness</string>'))additions.push('<key>CFBundleURLTypes</key><array><dict><key>CFBundleURLSchemes</key><array><string>vazfitness</string></array></dict></array>');
  if(!xml.includes('<string>strava</string>'))additions.push('<key>LSApplicationQueriesSchemes</key><array><string>strava</string></array>');
  if(additions.length)xml=xml.replace('</dict>',`${additions.join('\n')}\n</dict>`);
  await writeFile(file,xml);
}

await configureAndroid();
await configureIos();
console.log('Permissões nativas e deep links do Vaz Fitness configurados.');
