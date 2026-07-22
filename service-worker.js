const CACHE_NAME = "deadzone-cache-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/main.js",
  "./js/player.js",
  "./js/zombie.js",
  "./js/items.js",
  "./js/world.js",
  "./js/save.js",
  "./js/ui.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./assets/player.png",
  "./assets/zombie_normal.png",
  "./assets/zombie_runner.png",
  "./assets/zombie_tank.png",
  "./assets/item_milho.png",
  "./assets/item_agua.png",
  "./assets/item_atadura.png",
  "./assets/item_medkit.png",
  "./assets/item_pano.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && event.request.method === "GET") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
