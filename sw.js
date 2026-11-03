// チームToDo service worker：期限超過のプッシュ通知を受け取り表示する
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: '期限超過のタスクがあります', body: e.data && e.data.text() }; }
  const title = d.title || '⚠ 期限超過のタスクがあります';
  e.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body: d.body || 'アプリを開いて確認してください',
      tag: d.tag || 'overdue',
      renotify: true,
      requireInteraction: true,
      vibrate: [400, 200, 400, 200, 400],
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      data: { url: d.url || './' }
    });
    try { if (self.navigator.setAppBadge) await self.navigator.setAppBadge(d.count || 1); } catch (_) {}
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) { if (c.url.startsWith(self.registration.scope)) { await c.focus(); return; } }
    await self.clients.openWindow(url);
  })());
});
