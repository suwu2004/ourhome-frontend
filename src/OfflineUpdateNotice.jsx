import { useEffect, useState } from 'react';

export default function OfflineUpdateNotice() {
  const [registration, setRegistration] = useState(null);

  useEffect(() => {
    const ready = event => setRegistration(event.detail?.registration || null);
    window.addEventListener('ourhome-update-ready', ready);
    return () => window.removeEventListener('ourhome-update-ready', ready);
  }, []);

  if (!registration) return null;
  const update = () => {
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    }, { once: true });
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
  };

  return (
    <aside className="offline-update-notice" role="status">
      <span>我们的家有新版本啦</span>
      <button type="button" onClick={update}>刷新看看</button>
      <button type="button" aria-label="稍后更新" onClick={() => setRegistration(null)}>×</button>
    </aside>
  );
}
