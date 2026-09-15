import { mkdir, rm, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const files=['index.html','styles.css','app-core.js','app-pt-guides.js','app-ui.js','app-training.js','app-ai.js','app-running.js','app-profile-v2.js','app-integrations.js','app-native.js','manifest.webmanifest','icon.svg','sw.js'];
await rm('www',{recursive:true,force:true});
await mkdir('www',{recursive:true});
for(const file of files){
  if(existsSync(file))await copyFile(file,`www/${file}`);
}
console.log(`Vaz Fitness native web bundle: ${files.filter(existsSync).length} arquivos copiados.`);
