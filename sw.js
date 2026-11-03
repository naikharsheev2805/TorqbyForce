// TORQ service worker: keeps the app usable offline and lets the browser offer installation.
// Network first, so updates reach the device; the cache is the fallback when offline.
const CACHE = 'torq-v4';
// Each file is cached on its own, so one missing file cannot stop the worker installing.
const SHELL = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/badge-96.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  if(new URL(e.request.url).origin !== self.location.origin) return;
  if(e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

// ---- Push notifications (chat messages, doubt cards and incoming calls) ----
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { data = { title: 'TORQ', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'TORQ';
  const isCall = !!data.call;
  const options = {
    body: data.body || '',
    tag: data.tag || 'torq',
    renotify: true,
    icon: './icons/icon-192.png',
    // Android shows the badge as a small status-bar symbol, so it must be a plain white silhouette.
    badge: './icons/badge-96.png',
    requireInteraction: isCall,
    vibrate: isCall ? [400, 200, 400, 200, 400] : undefined,
    data: { url: data.url || './' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if ('focus' in client) { await client.navigate(url).catch(() => {}); return client.focus(); }
    }
    return self.clients.openWindow(url);
  })());
});
