import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const storage = new Map([['ourhome_token', 'test-token']]);

function installBrowserGlobals() {
  globalThis.localStorage = {
    get length() { return storage.size; },
    key(index) { return [...storage.keys()][index] ?? null; },
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); },
    clear() { storage.clear(); },
  };
  globalThis.location = { origin: 'https://ourhome.test' };
  globalThis.window = { dispatchEvent() {} };
  globalThis.Event = class Event {
    constructor(type) { this.type = type; }
  };
  globalThis.CustomEvent = class CustomEvent extends globalThis.Event {
    constructor(type, options = {}) {
      super(type);
      this.detail = options.detail;
    }
  };
}

installBrowserGlobals();
const { apiFetch, DIRECT_BACKEND, getApiRouteState, getCloudSyncState, recheckCloudSync, clearOurHomePrivateCache, syncLocalFirstOutbox } = await import('../src/api.js');
const {
  clearLocalFirstData,
  getLocalFirstStats,
  listPendingMutations,
  localFirstMutation,
  localFirstReadPath,
} = await import('../src/localFirstStore.js');

test('local-first cache covers household data and excludes volatile or mutating routes', () => {
  assert.equal(localFirstReadPath('/api/sessions/one/messages?limit=80'), '/sessions/one/messages?limit=80');
  assert.equal(localFirstReadPath('/api/letters?category=future'), '/letters?category=future');
  assert.equal(localFirstReadPath('/api/messages/search?q=海棠'), '/messages/search?q=%E6%B5%B7%E6%A3%A0');
  assert.equal(localFirstReadPath('/api/vault'), '/vault');
  assert.equal(localFirstReadPath('/api/reading/books'), '/reading/books');
  assert.equal(localFirstReadPath('/api/weather?city=武汉'), '');
  assert.equal(localFirstReadPath('/api/backup'), '');
  assert.equal(localFirstReadPath('/api/letters', { method: 'POST' }), '');
});

test('local-first outbox accepts only bounded, safe household mutations', () => {
  const safeOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: '买花和牛奶' }),
  };
  const first = localFirstMutation('/api/home-memos', safeOptions, 'request-one', 402);
  const duplicate = localFirstMutation('/api/home-memos', safeOptions, 'request-two', 402);
  assert.equal(first?.replayable, true);
  assert.equal(first?.id, duplicate?.id, 'the same logical write must deduplicate across retries');

  assert.equal(localFirstMutation('/api/chat', safeOptions, 'chat', 402), null);
  assert.equal(localFirstMutation('/api/upload', safeOptions, 'upload', 402), null);
  assert.equal(localFirstMutation('/api/settings', {
    ...safeOptions,
    method: 'PATCH',
    body: JSON.stringify({ api_key: 'never-store-me' }),
  }, 'secret', 402), null);
  assert.equal(localFirstMutation('/api/letters', {
    method: 'POST',
    body: new FormData(),
  }, 'form', 402), null);
});

test('explicit quota failures queue one safe write and recovery replays it only once', async () => {
  await clearLocalFirstData();
  storage.set('ourhome_token', 'test-token');
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: '留在设备里', testMarker: 'quota-outbox' }),
  };
  globalThis.fetch = async () => new Response('{"message":"exceed_egress_quota"}', {
    status: 402,
    headers: { 'Content-Type': 'application/json' },
  });

  assert.equal((await apiFetch('/api/home-memos', options)).status, 402);
  assert.equal((await apiFetch('/api/home-memos', options)).status, 402);
  let pending = await listPendingMutations();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].replayable, true);

  let replayCalls = 0;
  globalThis.fetch = async (url, replayOptions) => {
    replayCalls += 1;
    assert.equal(String(url), '/api/home-memos');
    assert.equal(replayOptions.headers.get('X-OurHome-Local-Replay'), '1');
    return new Response('{"id":"memo-local"}', {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  assert.deepEqual(await syncLocalFirstOutbox(), { applied: 1, remaining: 0 });
  assert.deepEqual(await syncLocalFirstOutbox(), { applied: 0, remaining: 0 });
  assert.equal(replayCalls, 1);
  pending = await listPendingMutations();
  assert.equal(pending.length, 0);
});

test('transient GET failure is retried exactly once', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1
      ? new Response('{"error":"temporary"}', { status: 503, headers: { 'Content-Type': 'application/json' } })
      : new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const response = await apiFetch('/api/sessions');
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
  assert.deepEqual(await response.json(), []);
});

test('full household reads fall back to the device copy after the cloud goes away', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new TypeError('both clouds are locked');
  };

  const response = await apiFetch('/api/sessions');
  assert.equal(calls, 3);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-OurHome-Local-First'), '1');
  assert.deepEqual(await response.json(), []);
  assert.ok((await getLocalFirstStats()).entries >= 1);
});

test('network wobble on GET gets one quiet retry', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) throw new TypeError('temporary network failure');
    return new Response('[{"id":1}]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const response = await apiFetch('/api/sessions/1/messages');
  assert.equal(calls, 2);
  assert.deepEqual(await response.json(), [{ id: 1 }]);
});

test('small home reads can fall back to the last successful sync after both routes fail', async () => {
  storage.set('ourhome_token', 'test-token');
  globalThis.fetch = async () => new Response('[{"id":"memo-1","content":"爱你"}]', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  const fresh = await apiFetch('/api/home-memos');
  assert.deepEqual(await fresh.json(), [{ id: 'memo-1', content: '爱你' }]);

  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new TypeError('vpn wobble');
  };

  const cached = await apiFetch('/api/home-memos');
  assert.equal(calls, 3);
  assert.equal(cached.status, 200);
  assert.equal(cached.headers.get('X-OurHome-Cache'), 'stale');
  assert.deepEqual(await cached.json(), [{ id: 'memo-1', content: '爱你' }]);
});

test('Supabase quota 402 uses the safe home cache without retrying the blocked route', async () => {
  const fresh = await import(`../src/api.js?quota-cache=${Date.now()}`);
  storage.set('ourhome_token', 'test-token');
  fresh.clearOurHomePrivateCache();
  globalThis.fetch = async () => new Response('[{"id":"memo-quota","content":"留在家里"}]', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  await fresh.apiFetch('/api/home-memos');

  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('{"message":"exceed_egress_quota"}', {
      status: 402,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const cached = await fresh.apiFetch('/api/home-memos');
  assert.equal(calls, 1, 'quota responses should not be retried or cross-routed');
  assert.equal(cached.headers.get('X-OurHome-Cache'), 'stale');
  assert.deepEqual(await cached.json(), [{ id: 'memo-quota', content: '留在家里' }]);
  assert.equal(fresh.getCloudSyncState().reason, 'quota');
});

test('stale home cache self-heals with a read-only recheck after the cloud recovers', async () => {
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

test('cloud badge uses adaptive stale backoff while keeping immediate recovery signals', async () => {
  const badge = await readFile(new URL('../src/CloudSyncBadge.jsx', import.meta.url), 'utf8');
  assert.match(badge, /recheckCloudSync/);
  assert.match(badge, /FIRST_RECHECK_DELAY_MS/);
  assert.match(badge, /STALE_RECHECK_BACKOFF_MS/);
  assert.match(badge, /15_000, 30_000, 60_000, 120_000, 300_000/);
  assert.doesNotMatch(badge, /setInterval/);
  assert.match(badge, /addEventListener\('online'/);
  assert.match(badge, /visibilitychange/);
  assert.match(badge, /云端额度暂时受限/);
  assert.match(badge, /NOTICE_VISIBLE_MS = 3600/);
  assert.match(badge, /setNoticeVisible\(false\)/);
  assert.match(badge, /subscribeGlobalSync/);
  assert.match(badge, /if \(!stale \|\| !noticeVisible\) return null/);
});

test('one stale recheck stops the round instead of probing every cached home endpoint', async () => {
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

test('chat and session reads use their own device snapshot after both routes fail', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new TypeError('network down');
  };

  const response = await apiFetch('/api/sessions/1/messages');
  assert.equal(calls, 3);
  assert.equal(response.headers.get('X-OurHome-Local-First'), '1');
  assert.deepEqual(await response.json(), [{ id: 1 }]);
});

test('a failed same-origin GET may pin the page session to direct Render', async () => {
  const urls = [];
  globalThis.fetch = async url => {
    urls.push(String(url));
    if (urls.length <= 2) throw new TypeError('same-origin route unavailable');
    return new Response('[{"id":9}]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const response = await apiFetch('/api/sessions');
  assert.deepEqual(await response.json(), [{ id: 9 }]);
  assert.equal(urls.length, 3);
  assert.equal(urls[0], '/api/sessions');
  assert.equal(urls[1], '/api/sessions');
  assert.equal(urls[2], `${DIRECT_BACKEND}/sessions`);
  assert.equal(getApiRouteState().mode, 'direct-backend');
});

test('POST is never retried or cross-routed after it is sent', async () => {
  storage.set('ourhome_token', 'test-token');
  let calls = 0;
  const urls = [];
  globalThis.fetch = async url => {
    calls += 1;
    urls.push(String(url));
    return new Response('{"error":"temporary"}', { status: 503, headers: { 'Content-Type': 'application/json' } });
  };

  const response = await apiFetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'hello' }),
  });

  assert.equal(response.status, 503);
  assert.equal(calls, 1);
  assert.equal(urls[0], `${DIRECT_BACKEND}/chat`);
});

test('a fresh module does not fall back after an ambiguous POST network failure', async () => {
  const fresh = await import(`../src/api.js?write-safety=${Date.now()}`);
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new TypeError('write connection failed');
  };

  await assert.rejects(() => fresh.apiFetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'one shot only' }),
  }), /write connection failed/);
  assert.equal(calls, 1);
  assert.equal(fresh.getApiRouteState().mode, 'same-origin');
});

test('caller-owned abort signals opt out of automatic retry and route fallback', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('{"error":"temporary"}', { status: 503, headers: { 'Content-Type': 'application/json' } });
  };

  const controller = new AbortController();
  const response = await apiFetch('/api/settings/models', { signal: controller.signal });
  assert.equal(response.status, 503);
  assert.equal(calls, 1);
});

test('cached settings keep only visual home fields and never retain private prompts', async () => {
  storage.set('ourhome_token', 'test-token');
  globalThis.fetch = async () => new Response(JSON.stringify({
    dark_mode: true,
    home_bg_day_image_url: 'https://img.test/day.webp',
    calendar_day_colors: { '2026-08-09': '#E9A0B6' },
    system_prompt: 'private persona',
    selected_model: 'private-model',
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  await apiFetch('/api/settings');
  const cachedEntry = [...storage.entries()].find(([key]) => key.startsWith('ourhome_cloud_read:/api/settings'));
  assert.ok(cachedEntry);
  const cached = JSON.parse(cachedEntry[1]);
  assert.deepEqual(JSON.parse(cached.body), {
    dark_mode: true,
    home_bg_day_image_url: 'https://img.test/day.webp',
    calendar_day_colors: { '2026-08-09': '#E9A0B6' },
  });
});

test('auth cleanup removes cloud cache entries without touching unrelated preferences', () => {
  storage.set('ourhome_cloud_read:/api/settings', '{}');
  storage.set('ourhome_weather_city', '武汉');
  clearOurHomePrivateCache();
  assert.equal(storage.has('ourhome_cloud_read:/api/settings'), false);
  assert.equal(storage.get('ourhome_weather_city'), '武汉');
});
