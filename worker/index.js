// Custom service worker code — next-pwa auto-detects this file
// (customWorkerDir: 'worker', its default) and bundles it into
// public/worker-<hash>.js, then injects an importScripts(...) for it at
// the top of the main generated sw.js. It runs alongside next-pwa's own
// precaching/runtime-caching setup untouched — this file only adds the
// two events actual push delivery needs, nothing else.

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* non-JSON payload — fall back to defaults below */ }

  const title = data.title || 'SHEP.HERD';
  const link = data.link || '/dashboard';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // A stable tag per link means a second push about the same thing
      // (e.g. two quick updates to one prayer request) replaces the
      // earlier alert instead of stacking duplicates in the tray.
      tag: link,
      data: { link },
    })
  );
});

// Focuses an already-open tab on the right page rather than always
// spawning a new one — the same "don't fork the app into multiple tabs"
// principle NotificationBell's in-tab click handling already follows.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(link).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(link);
    })
  );
});
