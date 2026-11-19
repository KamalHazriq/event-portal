/*
 * The portal's service worker. Its only job is event alerts: show a
 * notification when the secretariat sends one, and open the right page when
 * it is tapped. It caches nothing, so the portal always shows live data.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = { body: event.data ? event.data.text() : '' };
  }
  const title = message.title || 'Event update';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: message.body || '',
      icon: message.icon || undefined,
      badge: message.icon || undefined,
      tag: message.tag || undefined,
      renotify: Boolean(message.tag),
      data: { url: message.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || '/';
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url.startsWith(self.location.origin) && 'focus' in w) {
          w.navigate(target);
          return w.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
