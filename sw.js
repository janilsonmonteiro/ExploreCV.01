const CACHE_NAME = "explorecv-cache-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/styles/main.css",
  "/images/logo.png",
  "/images/og-image.jpg"
];

// Instalando SW e cache inicial
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Ativando SW e limpando caches antigos
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.map(key => key !== CACHE_NAME && caches.delete(key)))
    )
  );
});

// Interceptando requisições para offline
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});