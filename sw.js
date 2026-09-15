const CACHE='vaz-fitness-v3';
const ASSETS=['./','./index.html','./styles.css','./app-core.js','./app-ui.js','./app-training.js','./app-ai.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
