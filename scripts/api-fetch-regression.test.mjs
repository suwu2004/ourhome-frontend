import test from 'node:test';
import assert from 'node:assert/strict';

function installBrowserGlobals() {
  globalThis.localStorage = {
    getItem() { return 'test-token'; },
    removeItem() {},
  };
  globalThis.window = { dispatchEvent() {} };
  globalThis.Event = class Event {
    constructor(type) { this.type = type; }
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

test('persistent failed GET throws instead of looking like an empty cloud list', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('{"error":"backend unavailable"}', {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const response = await apiFetch('/api/sessions/1/messages');
  assert.equal(calls, 2);
  await assert.rejects(
    () => response.json(),
    error => error?.status === 503 && /backend unavailable/.test(error.message),
  );
});

test('POST is never retried and its error JSON stays inspectable by write callers', async () => {
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
  assert.deepEqual(await response.json(), { error: 'temporary' });
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
