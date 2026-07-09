/* سُفرة — Service Worker (يعمل بدون إنترنت بعد أول فتح) */
const CACHE = 'sufrah-v28';
const ASSETS = [
  './',
  './index.html',
  './partner.html',
  './terms.html',
  './admin.html',
  './css/styles.css',
  './js/data.js',
  './js/store.js',
  './js/app.js',
  './js/partner.js',
  './js/admin.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // نفس المصدر: من الكاش أولاً ثم الشبكة
  if (new URL(req.url).origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((cached) =>
        cached || fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        }).catch(() => caches.match('./index.html'))
      )
    );
  }
  // خطوط جوجل وغيرها: الشبكة ثم الكاش (لا تعطّل الصفحة إن فشلت)
});
