import { mkdir, rm, copyFile, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const out='www-personal';
const files=['index.html','branding.js','management-v2.js','manifest.webmanifest','sw.js'];
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for(const file of files){
  const src=`personal/${file}`;
  if(existsSync(src))await copyFile(src,`${out}/${file}`);
}
if(existsSync('icon.svg'))await copyFile('icon.svg',`${out}/icon.svg`);

let appSource=await readFile('personal/app.js','utf8');
const broken="catch(e){toast(e.message)}\n\nfunction bind(){";
const fixed="catch(e){toast(e.message)}\n}\n\nfunction bind(){";
if(appSource.includes(broken))appSource=appSource.replace(broken,fixed);
await writeFile(`${out}/app.js`,appSource);

let html=await readFile(`${out}/index.html`,'utf8');
const nativeBootstrap=`<script>window.VAZ_PERSONAL_NATIVE=true;window.VAZ_API_BASE='https://vaz-fitness.vercel.app';</script>`;
html=html.replace('<script src="./app.js"></script>',`${nativeBootstrap}\n  <script src="./app.js"></script>`);
await writeFile(`${out}/index.html`,html);
console.log(`Vaz Personal native bundle pronto: ${files.filter(f=>existsSync(`personal/${f}`)).length+1} assets corrigidos.`);
