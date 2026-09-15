import { mkdir, rm, copyFile, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { build } from 'esbuild';

// Keep the native package aligned with the same modular assets served by Vercel.
const files=['index.html','styles.css','app-core.js','app-pt-guides.js','app-ui.js','app-training.js','app-ai.js','app-running.js','app-profile-v2.js','app-onboarding-v3.js','app-calibration.js','app-calendar.js','app-integrations.js','app-workout-exit.js','app-training-details.js','manifest.webmanifest','icon.svg','sw.js'];
await rm('www',{recursive:true,force:true});
await mkdir('www',{recursive:true});
for(const file of files){if(existsSync(file))await copyFile(file,`www/${file}`);}

await build({entryPoints:['native-entry.js'],bundle:true,format:'iife',platform:'browser',target:['es2020'],outfile:'www/app-native-bundle.js',minify:false});

let html=await readFile('www/index.html','utf8');
const nativeBootstrap=`<script>
window.VAZ_NATIVE=true;
window.VAZ_API_BASE='https://vaz-fitness.vercel.app';
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
