const CACHE_NAME = "forge3d-cache-v8";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/forge/animation-bootstrap.js",
  "./js/forge/animationSystem.js",
  "./js/forge/rigging.js",
  "./js/forge/image-to-3d.js",
  "./js/forge/main.js",
  "./js/forge/generators.js",
  "./js/forge/promptParser.js",
  "./js/forge/utils.js",
  "./js/forge/exporter.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))));self.clients.claim();});
self.addEventListener("fetch",event=>{const url=event.request.url;if(url.includes("cdn.jsdelivr.net")||url.includes("colab.research.google.com")||url.includes("ngrok")||url.includes("/api/"))return;event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response&&response.status===200&&event.request.method==="GET"){const clone=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,clone));}return response;}).catch(()=>cached)));});