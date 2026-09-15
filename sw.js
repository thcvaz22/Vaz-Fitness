const CACHE='vaz-fitness-v16';
const ASSETS=['./','./index.html','./styles.css','./app-core.js','./app-pt-guides.js','./app-ui.js','./app-training.js','./app-ai.js','./app-running.js','./app-profile-v2.js','./app-onboarding-v3.js','./app-calibration.js','./app-calendar.js','./app-integrations.js','./app-workout-exit.js','./app-training-details.js','./app-coach-v2.js','./app-running-plus.js','./app-polish-v2.js','./app-membership.js','./app-branding.js','./manifest.webmanifest','./icon.svg'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  const isAppAsset=url.origin===self.location.origin&&(event.request.mode==='navigate'||['script','style','document'].includes(event.request.destination));
  if(isAppAsset){event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;}).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));return;}
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
