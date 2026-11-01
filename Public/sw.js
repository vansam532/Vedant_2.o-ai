const CACHE="vedant-ai-v2";
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(["/","/manifest.webmanifest","/icon.svg"]))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener("fetch",e=>{if(e.request.method==="GET"&&!new URL(e.request.url).pathname.startsWith("/api/"))e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)));});
