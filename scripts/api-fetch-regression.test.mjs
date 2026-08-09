import test from 'node:test';
import assert from 'node:assert/strict';

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
const { apiFetch, DIRECT_BACKEND, getApiRouteState, clearOurHomePrivateCache } = await import('../src/api.js');

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

test('chat and session reads never use the stale home cache after both routes fail', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new TypeError('network down');
  };

  await assert.rejects(() => apiFetch('/api/sessions/1/messages'), /network down/);
  assert.equal(calls, 3);
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
