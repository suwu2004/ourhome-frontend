from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


badge_path = Path('src/CloudSyncBadge.jsx')
badge = badge_path.read_text()
badge = replace_once(
    badge,
    """const FIRST_RECHECK_DELAY_MS = 1800;
const STALE_RECHECK_INTERVAL_MS = 15_000;
""",
    """const FIRST_RECHECK_DELAY_MS = 1800;
const STALE_RECHECK_BACKOFF_MS = [15_000, 30_000, 60_000, 120_000, 300_000];
""",
    'adaptive badge constants',
)
badge = replace_once(
    badge,
    """  useEffect(() => {
    if (!stale) return undefined;
    const probe = () => recheckCloudSync().catch(() => {});
    const firstTimer = window.setTimeout(probe, FIRST_RECHECK_DELAY_MS);
    const interval = window.setInterval(probe, STALE_RECHECK_INTERVAL_MS);
    return () => {
      window.clearTimeout(firstTimer);
      window.clearInterval(interval);
    };
  }, [stale]);
""",
    """  useEffect(() => {
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
""",
    'adaptive badge scheduling',
)
badge_path.write_text(badge)


api_path = Path('src/api.js')
api = api_path.read_text()
api = replace_once(
    api,
    """function markCloudStale(path, cachedAt, logicalUrl = '') {
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
""",
    """function markCloudStale(path, cachedAt, logicalUrl = '') {
  const previous = staleCloudReads.get(path);
  const next = {
    cachedAt: cachedAt || previous?.cachedAt || Date.now(),
    logicalUrl: logicalUrl || previous?.logicalUrl || '',
  };
  if (previous?.cachedAt === next.cachedAt && previous?.logicalUrl === next.logicalUrl) return;
  staleCloudReads.set(path, next);
  emitCloudSyncState();
}

function markCloudFresh(path) {
  if (!path || !staleCloudReads.has(path)) return;
  staleCloudReads.delete(path);
  emitCloudSyncState();
}
""",
    'avoid redundant sync events',
)
api = replace_once(
    api,
    """    for (const logicalUrl of logicalUrls) {
      try {
        await apiFetch(logicalUrl, {
          headers: { 'X-OurHome-Cloud-Recheck': '1' },
        });
      } catch {
        // Revalidation is read-only and best-effort. Keep the stale marker until a real read succeeds.
      }
    }
""",
    """    for (const logicalUrl of logicalUrls) {
      try {
        const response = await apiFetch(logicalUrl, {
          headers: { 'X-OurHome-Cloud-Recheck': '1' },
        });
        // One stale-cache fallback is enough evidence that the shared cloud path
        // is still unavailable. Stop this round instead of hammering the other
        // safe home reads with the same doomed probe.
        if (response.headers.get('X-OurHome-Cache') === 'stale') break;
      } catch {
        // Revalidation is read-only and best-effort. Keep the stale marker until a real read succeeds.
        break;
      }
    }
""",
    'stop recheck round after shared outage evidence',
)
api_path.write_text(api)


test_path = Path('scripts/api-fetch-regression.test.mjs')
test = test_path.read_text()
test = replace_once(
    test,
    """test('cloud badge automatically rechecks stale reads and listens for recovery signals', async () => {
  const badge = await readFile(new URL('../src/CloudSyncBadge.jsx', import.meta.url), 'utf8');
  assert.match(badge, /recheckCloudSync/);
  assert.match(badge, /FIRST_RECHECK_DELAY_MS/);
  assert.match(badge, /STALE_RECHECK_INTERVAL_MS/);
  assert.match(badge, /addEventListener\\('online'/);
  assert.match(badge, /visibilitychange/);
});
""",
    """test('cloud badge uses adaptive stale backoff while keeping immediate recovery signals', async () => {
  const badge = await readFile(new URL('../src/CloudSyncBadge.jsx', import.meta.url), 'utf8');
  assert.match(badge, /recheckCloudSync/);
  assert.match(badge, /FIRST_RECHECK_DELAY_MS/);
  assert.match(badge, /STALE_RECHECK_BACKOFF_MS/);
  assert.match(badge, /15_000, 30_000, 60_000, 120_000, 300_000/);
  assert.doesNotMatch(badge, /setInterval/);
  assert.match(badge, /addEventListener\\('online'/);
  assert.match(badge, /visibilitychange/);
});
""",
    'adaptive badge regression',
)
anchor = "test('chat and session reads never use the stale home cache after both routes fail', async () => {"
new_tests = r'''test('one stale recheck stops the round instead of probing every cached home endpoint', async () => {
  const fresh = await import(`../src/api.js?cloud-round=${Date.now()}`);
  storage.set('ourhome_token', 'test-token');
  fresh.clearOurHomePrivateCache();

  globalThis.fetch = async url => {
    const body = String(url).includes('settings') ? '{"dark_mode":false}' : '[{"id":"m1"}]';
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  await fresh.apiFetch('/api/settings');
  await fresh.apiFetch('/api/milestones');

  globalThis.fetch = async () => { throw new TypeError('shared cloud outage'); };
  assert.equal((await fresh.apiFetch('/api/settings')).headers.get('X-OurHome-Cache'), 'stale');
  assert.equal((await fresh.apiFetch('/api/milestones')).headers.get('X-OurHome-Cache'), 'stale');
  assert.equal(fresh.getCloudSyncState().paths.length, 2);

  let recheckCalls = 0;
  globalThis.fetch = async () => {
    recheckCalls += 1;
    throw new TypeError('still down');
  };
  assert.equal(await fresh.recheckCloudSync(), false);
  assert.equal(recheckCalls, 3, 'one logical safe read gets two same-origin attempts plus one direct-route attempt');
  assert.equal(fresh.getCloudSyncState().paths.length, 2);
});

''' + anchor
if anchor not in test:
    raise SystemExit('recheck regression anchor missing')
test = test.replace(anchor, new_tests, 1)
test_path.write_text(test)
