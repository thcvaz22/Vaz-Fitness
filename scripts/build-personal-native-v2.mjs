import { mkdir, rm, copyFile, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const out='www-personal';
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});

const copies=[
  ['personal/index-v2.html',`${out}/index.html`],
  ['personal/app-v2.js',`${out}/app-v2.js`],
  ['personal/app-v2.css',`${out}/app-v2.css`],
  ['personal/training-library-v2.js',`${out}/training-library-v2.js`],
  ['personal/training-library-v2.css',`${out}/training-library-v2.css`],
  ['personal/premium-v3.css',`${out}/premium-v3.css`],
  ['personal/premium-v3.js',`${out}/premium-v3.js`],
  ['personal/exercise-catalog-v4.js',`${out}/exercise-catalog-v4.js`],
  ['personal/coach-tools-v4.css',`${out}/coach-tools-v4.css`],
  ['personal/coach-tools-v4.js',`${out}/coach-tools-v4.js`],
  ['personal/plans-v5.js',`${out}/plans-v5.js`],
  ['personal/plan-pricing-v6.js',`${out}/plan-pricing-v6.js`],
  ['personal/training-planner-v6.js',`${out}/training-planner-v6.js`],
  ['personal/remap-v7.js',`${out}/remap-v7.js`],
  ['personal/advanced-v8.js',`${out}/advanced-v8.js`],
  ['personal/safety-v9.js',`${out}/safety-v9.js`],
  ['personal/exercise-gallery-v10.js',`${out}/exercise-gallery-v10.js`],
  ['personal/version.json',`${out}/version.json`],
  ['personal/sw.js',`${out}/sw.js`],
  ['personal/manifest.webmanifest',`${out}/manifest.webmanifest`],
  ['personal/icon.svg',`${out}/icon.svg`]
];
for(const [src,dst] of copies){if(!existsSync(src))throw new Error(`Arquivo ausente: ${src}`);await copyFile(src,dst)}

let html=await readFile(`${out}/index.html`,'utf8');
html=html.replace('<script src="./app-v2.js"></script>',`<script>window.VAZ_PERSONAL_NATIVE=true;window.VAZ_API_BASE='https://vaz-fitness.vercel.app';document.documentElement.classList.add('native-app');</script>\n  <script src="./app-v2.js"></script>`);
await writeFile(`${out}/index.html`,html);
console.log('Vaz Personal native bundle: premium + biblioteca + galeria pesquisável + planos + planejador + remanejamento semanal + segurança pronto.');
