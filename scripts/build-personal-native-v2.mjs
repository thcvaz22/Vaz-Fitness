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
  ['personal/manifest.webmanifest',`${out}/manifest.webmanifest`],
  ['personal/icon.svg',`${out}/icon.svg`]
];
for(const [src,dst] of copies){if(!existsSync(src))throw new Error(`Arquivo ausente: ${src}`);await copyFile(src,dst)}

let html=await readFile(`${out}/index.html`,'utf8');
html=html.replace('<script src="./app-v2.js"></script>',`<script>window.VAZ_PERSONAL_NATIVE=true;window.VAZ_API_BASE='https://vaz-fitness.vercel.app';</script>\n  <script src="./app-v2.js"></script>`);
await writeFile(`${out}/index.html`,html);
console.log('Vaz Personal 2.0 native bundle pronto.');
