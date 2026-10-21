/* Sly Escape service worker: offline play.
   Bump CACHE on every release (matches BUILD.version/build in index.html); old caches are deleted on activate.
   Pages (index/privacy/support) are network-first so updates always load when online; assets are cache-first
   with a background refresh. */
const CACHE='sly-escape-1.0.0-2';
const CORE=['./','index.html','privacy.html','support.html','manifest.json','favicon.ico',
  'assets/icons/icon-192.png','assets/icons/icon-512.png','assets/icons/maskable-512.png','assets/icons/apple-touch-icon.png','assets/icons/favicon-32.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('sly-escape-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  const page=r.mode==='navigate'||/\.html$|\/$/.test(new URL(r.url).pathname);
  if(page){e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp))}return res})
      .catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('index.html'))));return}
  e.respondWith(caches.match(r,{ignoreSearch:true}).then(m=>{const net=fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp))}return res}).catch(()=>m);return m||net}))});
