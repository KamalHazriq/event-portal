/*
 * The portal's service worker.
 *
 * 1. Event alerts: shows a notification when the secretariat sends one, and
 *    opens the right page when it is tapped.
 * 2. Patchy Wi-Fi: the agenda, home, info, resources and session pages are
 *    always fetched fresh, and a copy is kept. With no connection, the last
 *    copy is shown instead of an error. Build files (which never change
 *    under the same name) are kept too. Nothing personal or secretariat
 *    related is stored.
 */
const PAGES = 'pages-v1';
const ASSETS = 'assets-v1';
const KEEP = [PAGES, ASSETS];
const PAGE_PATHS = /^\/(|agenda|info|resources|guide|session\/[a-z0-9-]+)$/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => !KEEP.includes(n)).map((n) => caches.delete(n))),
      )
      .then(() => self.clients.claim()),
  ),
);

const OFFLINE_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Offline</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#04090b;color:#eaf4f3;
font:16px/1.5 system-ui,sans-serif;padding:24px;text-align:center}a{color:#2fb5c9}</style></head>
<body><main><h1>You are offline</h1><p>This page has not been saved on this phone yet.
It will load when the connection is back.</p><p><a href="/agenda">Try the agenda</a></p></main></body></html>`;

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Build files and logos: named by their content, so safe to keep.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/branding/')) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // Attendee pages: fresh when online, the last copy when not.
  if (request.mode === 'navigate' && PAGE_PATHS.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && !response.redirected) {
            const copy = response.clone();
            caches.open(PAGES).then((cache) => cache.put(url.pathname, copy));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(PAGES);
          return (
            (await cache.match(url.pathname)) ||
            new Response(OFFLINE_PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
          );
        }),
    );
  }
});

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
