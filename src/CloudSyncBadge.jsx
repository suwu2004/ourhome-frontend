import { useEffect, useState } from 'react';

export default function CloudSyncBadge() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const handleSync = event => setStale(event?.detail?.state === 'stale');
    window.addEventListener('ourhome-cloud-sync', handleSync);
    return () => window.removeEventListener('ourhome-cloud-sync', handleSync);
  }, []);

  if (!stale) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        zIndex: 9999,
        top: 'calc(env(safe-area-inset-top) + 8px)',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: 'calc(100vw - 32px)',
        padding: '7px 12px',
        border: '1px solid rgba(183, 132, 48, .22)',
        borderRadius: 999,
        background: 'rgba(255, 249, 232, .94)',
        boxShadow: '0 4px 16px rgba(93, 64, 29, .10)',
        color: '#8a6326',
        fontSize: 11,
        lineHeight: 1.2,
        letterSpacing: '.04em',
        whiteSpace: 'nowrap',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        pointerEvents: 'none',
      }}
    >
      云端连接中 · 先显示上次同步
    </div>
  );
}
