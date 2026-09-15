import { mkdir, rm, copyFile, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const out='www-personal';
const files=['index.html','app.js','branding.js','management-v2.js','manifest.webmanifest','sw.js'];
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for(const file of files){
  const src=`personal/${file}`;
  if(existsSync(src))await copyFile(src,`${out}/${file}`);
}
if(existsSync('icon.svg'))await copyFile('icon.svg',`${out}/icon.svg`);

let html=await readFile(`${out}/index.html`,'utf8');
const nativeBootstrap=`<script>window.VAZ_PERSONAL_NATIVE=true;window.VAZ_API_BASE='https://vaz-fitness.vercel.app';</script>`;
html=html.replace('<script src="./app.js"></script>',`${nativeBootstrap}\n  <script src="./app.js"></script>`);
await writeFile(`${out}/index.html`,html);
console.log(`Vaz Personal native bundle pronto: ${files.filter(f=>existsSync(`personal/${f}`)).length} assets.`);
