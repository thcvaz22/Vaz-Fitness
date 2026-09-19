import { mkdir, rm, copyFile, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { build } from 'esbuild';

// Keep the native package aligned with the same modular assets served by Vercel.
// White-label build: include membership, approval gate, dynamic branding and scale safeguards.
const files=['index.html','styles.css','native-safearea.css','app-core.js','app-pt-guides.js','app-ui.js','app-training.js','app-ai.js','app-running.js','app-profile-v2.js','app-onboarding-v3.js','app-calibration.js','app-calendar.js','app-integrations.js','app-workout-exit.js','app-training-details.js','app-coach-v2.js','app-running-plus.js','app-running-structured-v33.js','app-polish-v2.js','app-membership.js','app-auth-entry-v8.js','app-branding.js','app-custom-exercise-media.js','app-scale-v1.js','app-experience-v6.js','app-calendar-cycle-v7.js','app-measurement-female-v34.js','app-ux-v9.js','app-plan-request-v10.js','app-plan-sync-v11.js','app-profile-cleanup-v12.js','version.json','release.json','manifest.webmanifest','icon.svg','sw.js'];
await rm('www',{recursive:true,force:true});
await mkdir('www',{recursive:true});
await mkdir('www/assets',{recursive:true});
for(const file of files){if(existsSync(file))await copyFile(file,`www/${file}`);}
if(existsSync('assets/body-measurement-guide-v4.svg'))await copyFile('assets/body-measurement-guide-v4.svg','www/assets/body-measurement-guide-v4.svg');
if(existsSync('assets/body-measurement-guide-v2.png'))await copyFile('assets/body-measurement-guide-v2.png','www/assets/body-measurement-guide-v2.png');
if(existsSync('assets/measurement-overview.jpg'))await copyFile('assets/measurement-overview.jpg','www/assets/measurement-overview.jpg');
if(existsSync('assets/measurement-chest.jpg'))await copyFile('assets/measurement-chest.jpg','www/assets/measurement-chest.jpg');
if(existsSync('assets/measurement-waist.jpg'))await copyFile('assets/measurement-waist.jpg','www/assets/measurement-waist.jpg');
if(existsSync('assets/measurement-hip.jpg'))await copyFile('assets/measurement-hip.jpg','www/assets/measurement-hip.jpg');
if(existsSync('assets/measurement-arm.jpg'))await copyFile('assets/measurement-arm.jpg','www/assets/measurement-arm.jpg');
if(existsSync('assets/measurement-thigh.jpg'))await copyFile('assets/measurement-thigh.jpg','www/assets/measurement-thigh.jpg');

await build({entryPoints:['native-entry.js'],bundle:true,format:'iife',platform:'browser',target:['es2020'],outfile:'www/app-native-bundle.js',minify:false});

let html=await readFile('www/index.html','utf8');
html=html.replace('<link rel="stylesheet" href="styles.css" />','<link rel="stylesheet" href="styles.css" />\n  <link rel="stylesheet" href="native-safearea.css" />');
const nativeBootstrap=`<script>
window.VAZ_NATIVE=true;
window.VAZ_API_BASE='https://vaz-fitness.vercel.app';
document.documentElement.classList.add('native-app');
const __vazFetch=window.fetch.bind(window);
window.fetch=(input,init)=>{
  if(typeof input==='string'&&input.startsWith('/api/'))input=window.VAZ_API_BASE+input;
  return __vazFetch(input,init);
};
</script>`;
html=html.replace('<script src="app-core.js"></script>',`${nativeBootstrap}\n  <script src="app-core.js"></script>`);
html=html.replace('</body>','  <script src="app-native-bundle.js"></script>\n</body>');
await writeFile('www/index.html',html);
console.log(`Vaz Fitness native bundle pronto: ${files.filter(existsSync).length} assets + runtime nativo.`);
