import { writeFile } from 'node:fs/promises';
import { readRelease,publicManifest } from './release-config.mjs';

const release=await readRelease();
const json=value=>`${JSON.stringify(value,null,2)}\n`;
await Promise.all([
  writeFile(new URL('../version.json',import.meta.url),json(publicManifest(release,'fitness'))),
  writeFile(new URL('../personal/version.json',import.meta.url),json(publicManifest(release,'personal')))
]);
console.log(`Manifestos web e Android sincronizados em ${release.version} (${release.versionCode}).`);
