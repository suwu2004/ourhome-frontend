from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


api_path = Path('src/api.js')
api = api_path.read_text()

api = replace_once(
    api,
    """function emitCloudSyncState() {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
  const entries = [...staleCloudReads.entries()];
  window.dispatchEvent(new CustomEvent('ourhome-cloud-sync', {
    detail: {
      state: entries.length ? 'stale' : 'online',
      paths: entries.map(([path]) => path),
      cachedAt: entries.length ? Math.min(...entries.map(([, value]) => value || Date.now())) : null,
    },
  }));
}

function markCloudStale(path, cachedAt) {
  staleCloudReads.set(path, cachedAt || Date.now());
  emitCloudSyncState();
}

function markCloudFresh(path) {
  if (!path) return;
  staleCloudReads.delete(path);
  emitCloudSyncState();
}

function readCloudCache(path) {""",
    """function cloudSyncSnapshot() {
  const entries = [...staleCloudReads.entries()];
  return {
    state: entries.length ? 'stale' : 'online',
    paths: entries.map(([path]) => path),
    cachedAt: entries.length
      ? Math.min(...entries.map(([, value]) => Number(value?.cachedAt || 0) || Date.now()))
      : null,
  };
}

export function getCloudSyncState() {
  return cloudSyncSnapshot();
}

function emitCloudSyncState() {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent('ourhome-cloud-sync', { detail: cloudSyncSnapshot() }));
}

function markCloudStale(path, cachedAt, logicalUrl = '') {
  const previous = staleCloudReads.get(path);
  staleCloudReads.set(path, {
    cachedAt: cachedAt || previous?.cachedAt || Date.now(),
    logicalUrl: logicalUrl || previous?.logicalUrl || '',
  });
  emitCloudSyncState();
}

function markCloudFresh(path) {
  if (!path) return;
  staleCloudReads.delete(path);
  emitCloudSyncState();
}

function readCloudCache(path, logicalUrl = '') {""",
    'cloud sync state stores recovery URL',
)

api = replace_once(
    api,
    """    markCloudStale(path, savedAt);
    return new Response(parsed.body, { status: 200, headers });""",
    """    markCloudStale(path, savedAt, logicalUrl);
    return new Response(parsed.body, { status: 200, headers });""",
    'stale cache records logical URL',
)

api = replace_once(
    api,
    """async function fetchWithSafeReadRetry(url, options, headers) {""",
    """let cloudRecheckPromise = null;

export function recheckCloudSync() {
  if (cloudRecheckPromise) return cloudRecheckPromise;
  const logicalUrls = [...new Set(
    [...staleCloudReads.values()]
      .map(value => value?.logicalUrl)
      .filter(Boolean),
  )];
  if (!logicalUrls.length) return Promise.resolve(staleCloudReads.size === 0);

  cloudRecheckPromise = (async () => {
    for (const logicalUrl of logicalUrls) {
      try {
        await apiFetch(logicalUrl, {
          headers: { 'X-OurHome-Cloud-Recheck': '1' },
        });
      } catch {
        // Revalidation is read-only and best-effort. Keep the stale marker until a real read succeeds.
      }
    }
    return staleCloudReads.size === 0;
  })().finally(() => {
    cloudRecheckPromise = null;
  });

  return cloudRecheckPromise;
}

async function fetchWithSafeReadRetry(url, options, headers) {""",
    'add read-only cloud revalidation',
)

api = replace_once(
    api,
    """    const cached = cloudPath ? readCloudCache(cloudPath) : null;""",
    """    const cached = cloudPath ? readCloudCache(cloudPath, url) : null;""",
    'network fallback remembers URL',
)

api = replace_once(
    api,
    """    response = readCloudCache(cloudPath) || response;""",
    """    response = readCloudCache(cloudPath, url) || response;""",
    'status fallback remembers URL',
)

api_path.write_text(api)


badge_path = Path('src/CloudSyncBadge.jsx')
badge_path.write_text("""import { useEffect, useState } from 'react';
import { getCloudSyncState, recheckCloudSync } from './api.js';

const FIRST_RECHECK_DELAY_MS = 1800;
const STALE_RECHECK_INTERVAL_MS = 15_000;

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
    const probe = () => recheckCloudSync().catch(() => {});
    const firstTimer = window.setTimeout(probe, FIRST_RECHECK_DELAY_MS);
    const interval = window.setInterval(probe, STALE_RECHECK_INTERVAL_MS);
    return () => {
      window.clearTimeout(firstTimer);
      window.clearInterval(interval);
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
""")


test_path = Path('scripts/api-fetch-regression.test.mjs')
test = test_path.read_text()
test = replace_once(
    test,
    """import assert from 'node:assert/strict';""",
    """import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';""",
    'test readFile import',
)
test = replace_once(
    test,
    """const { apiFetch, DIRECT_BACKEND, getApiRouteState, clearOurHomePrivateCache } = await import('../src/api.js');""",
    """const { apiFetch, DIRECT_BACKEND, getApiRouteState, getCloudSyncState, recheckCloudSync, clearOurHomePrivateCache } = await import('../src/api.js');""",
    'test cloud sync exports',
)

anchor = """test('chat and session reads never use the stale home cache after both routes fail', async () => {"""
new_test = r"""test('stale home cache self-heals with a read-only recheck after the cloud recovers', async () => {
  storage.set('ourhome_token', 'test-token');
  clearOurHomePrivateCache();
  globalThis.fetch = async () => new Response('[{"id":"m1"}]', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  await apiFetch('/api/milestones');

  globalThis.fetch = async () => { throw new TypeError('temporary outage'); };
  const cached = await apiFetch('/api/milestones');
  assert.equal(cached.headers.get('X-OurHome-Cache'), 'stale');
  assert.equal(getCloudSyncState().state, 'stale');
  assert.deepEqual(getCloudSyncState().paths, ['/api/milestones']);

  const urls = [];
  globalThis.fetch = async url => {
    urls.push(String(url));
    return new Response('[{"id":"m1"},{"id":"m2"}]', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  assert.equal(await recheckCloudSync(), true);
  assert.equal(getCloudSyncState().state, 'online');
  assert.ok(urls.includes('/api/milestones') || urls.includes(`${DIRECT_BACKEND}/milestones`));
});

test('cloud badge automatically rechecks stale reads and listens for recovery signals', async () => {
  const badge = await readFile(new URL('../src/CloudSyncBadge.jsx', import.meta.url), 'utf8');
  assert.match(badge, /recheckCloudSync/);
  assert.match(badge, /FIRST_RECHECK_DELAY_MS/);
  assert.match(badge, /STALE_RECHECK_INTERVAL_MS/);
  assert.match(badge, /addEventListener\('online'/);
  assert.match(badge, /visibilitychange/);
});

""" + anchor
if anchor not in test:
    raise SystemExit('test self-heal insertion anchor missing')
test = test.replace(anchor, new_test, 1)
test_path.write_text(test)
