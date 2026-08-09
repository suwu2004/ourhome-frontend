import test from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map([['ourhome_token', 'test-token']]);

function installBrowserGlobals() {
  globalThis.localStorage = {
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
const { apiFetch } = await import('../src/api.js');

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

test('small home reads can fall back to the last successful sync after both network attempts fail', async () => {
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
  assert.equal(calls, 2);
  assert.equal(cached.status, 200);
  assert.equal(cached.headers.get('X-OurHome-Cache'), 'stale');
  assert.deepEqual(await cached.json(), [{ id: 'memo-1', content: '爱你' }]);
});

test('chat and session reads never use the stale home cache', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new TypeError('network down');
  };

  await assert.rejects(() => apiFetch('/api/sessions/1/messages'), /network down/);
  assert.equal(calls, 2);
});

test('POST is never retried so writes and model calls stay single-shot', async () => {
  storage.set('ourhome_token', 'test-token');
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('{"error":"temporary"}', { status: 503, headers: { 'Content-Type': 'application/json' } });
  };

  const response = await apiFetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'hello' }),
  });

  assert.equal(response.status, 503);
  assert.equal(calls, 1);
});

test('caller-owned abort signals opt out of automatic retry', async () => {
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
