// OurHome 推送通知的 service worker
// 负责：收到后端推送过来的消息时，真正把它弹成一条系统通知；
// 以及：点击通知时，把页面唤醒/聚焦。

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: '陆泽', body: '想你了。' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (err) {
    // 万一推送内容不是合法JSON，就用上面的默认文案，不让通知直接消失
  }

  const title = data.title || '陆泽';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'ourhome-notification',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => 'focus' in c);
      if (existing) return existing.focus();
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
