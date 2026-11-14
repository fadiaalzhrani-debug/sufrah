/* سُفرة · Service Worker
   - الصفحات: الشبكة أول (عشان التحديثات توصل فورًا) وبدونها النسخة المحفوظة
   - الملفات الثابتة: المحفوظ أول مع تحديث بالخلفية
   - الإشعارات: يعرض الإشعار من الحمولة، والضغط يفتح الرابط */
const CACHE = 'sufrah-202611142004';
const CORE = ['./', 'index.html', 'family.html', 'admin.html', 'css/sufrah.css', 'js/core.js', 'js/config.js', 'img/mark.svg', 'img/sadu.svg', 'manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            // Supabase والخطوط: بدون تدخل
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return r; })
      .catch(() => caches.match(req).then((r) => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: e.data ? e.data.text() : 'سُفرة' }; }
  const title = d.title || 'سُفرة';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', dir: 'auto', lang: d.lang || 'ar',
    tag: d.tag || undefined, renotify: !!d.tag, requireInteraction: !!d.sticky,
    data: { url: d.url || './' }, vibrate: d.sticky ? [300, 120, 300, 120, 600] : [120, 60, 120],
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (c.url.split('?')[0] === target.split('?')[0] && 'focus' in c) { c.navigate(target).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});
