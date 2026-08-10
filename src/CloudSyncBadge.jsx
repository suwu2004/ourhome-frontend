import { useEffect, useState } from 'react';
import { getCloudSyncState, recheckCloudSync } from './api.js';

const FIRST_RECHECK_DELAY_MS = 1800;
const STALE_RECHECK_BACKOFF_MS = [15_000, 30_000, 60_000, 120_000, 300_000];

export default function CloudSyncBadge() {
  const [stale, setStale] = useState(() => getCloudSyncState().state === 'stale');

  useEffect(() => {
    const handleSync = event => setStale(event?.detail?.state === 'stale');
    const handleOnline = () => {
      if (getCloudSyncState().state === 'stale') recheckCloudSync().catch(() => {});
    };
    const handleVisible = () => {
      if (document.visibilityState === 'visible' && getCloudSyncState().state === 'stale') {
        recheckCloudSync().catch(() => {});
      }
    };

    window.addEventListener('ourhome-cloud-sync', handleSync);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisible);
    return () => {
      window.removeEventListener('ourhome-cloud-sync', handleSync);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, []);

  useEffect(() => {
    if (!stale) return undefined;
    let cancelled = false;
    let timer = null;
    let backoffIndex = 0;

    const schedule = delay => {
      timer = window.setTimeout(async () => {
        const fresh = await recheckCloudSync().catch(() => false);
        if (cancelled || fresh) return;
        const nextDelay = STALE_RECHECK_BACKOFF_MS[Math.min(backoffIndex, STALE_RECHECK_BACKOFF_MS.length - 1)];
        backoffIndex += 1;
        schedule(nextDelay);
      }, delay);
    };

    schedule(FIRST_RECHECK_DELAY_MS);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [stale]);

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
