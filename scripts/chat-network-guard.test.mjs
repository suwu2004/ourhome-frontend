import test from 'node:test';
import assert from 'node:assert/strict';

const originalFetch = globalThis.fetch;
const originalLocation = globalThis.location;
const originalNavigator = globalThis.navigator;
const originalLocalStorage = globalThis.localStorage;

let mode = 'dedupe';
let historyMessage = 'recover me';
let postCalls = 0;
let historyCalls = 0;
const storageValues = new Map();

Object.defineProperty(globalThis, 'location', {
  configurable: true,
  value: { origin: 'https://ourhome.example' },
});
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { onLine: true },
});
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem(key) { return storageValues.has(key) ? storageValues.get(key) : null; },
    setItem(key, value) { storageValues.set(key, String(value)); },
    removeItem(key) { storageValues.delete(key); },
    clear() { storageValues.clear(); },
  },
});

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input), 'https://ourhome.example');
  const method = String(init.method || 'GET').toUpperCase();
  if (method === 'POST' && /\/api\/chat\/?$/.test(url.pathname)) {
    postCalls += 1;
    if (mode === 'recover') throw new TypeError('simulated mobile network drop');
    await new Promise(resolve => setTimeout(resolve, 60));
    return new Response(JSON.stringify({ reply: 'only once', id: 88 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (method === 'GET' && /\/api\/sessions\/22\/messages$/.test(url.pathname)) {
    historyCalls += 1;
    return new Response(JSON.stringify([
      { id: 77, session_id: 22, role: 'user', content: historyMessage, attachment_url: null, created_at: new Date().toISOString() },
      { id: 78, session_id: 22, role: 'assistant', content: 'recovered reply', reasoning_content: 'native thought', requested_model: 'model-a', model_name: 'model-a', input_tokens: 10, output_tokens: 20, created_at: new Date(Date.now() + 10).toISOString() },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  throw new Error(`unexpected fetch ${method} ${url}`);
};

const { __chatNetworkGuardTest: guardTest } = await import(`../src/chatNetworkGuard.js?test=${Date.now()}`);

test.afterEach(() => {
  guardTest.clearPersistedSendsForTest();
});

test.after(() => {
  globalThis.fetch = originalFetch;
  if (originalLocation === undefined) delete globalThis.location;
  else Object.defineProperty(globalThis, 'location', { configurable: true, value: originalLocation });
  if (originalNavigator === undefined) delete globalThis.navigator;
  else Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
  if (originalLocalStorage === undefined) delete globalThis.localStorage;
  else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalLocalStorage });
});

test('two concurrent copies of one Chat send produce one POST', async () => {
  mode = 'dedupe';
  postCalls = 0;
  const makeOptions = requestId => ({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test',
      'X-OurHome-Request-Id': requestId,
    },
    body: JSON.stringify({ session_id: 22, message: 'same turn', model: 'model-a' }),
  });
  const [left, right] = await Promise.all([
    globalThis.fetch('https://ourhome.example/api/chat', makeOptions('chat-first-12345678')),
    globalThis.fetch('https://ourhome.example/api/chat', makeOptions('chat-second-87654321')),
  ]);
  const [leftBody, rightBody] = await Promise.all([left.json(), right.json()]);
  assert.equal(postCalls, 1);
  assert.deepEqual(leftBody, rightBody);
  assert.equal(leftBody.reply, 'only once');
});

test('a lost Chat response is recovered with GET only and never POSTed twice', async () => {
  mode = 'recover';
  historyMessage = 'recover me';
  postCalls = 0;
  historyCalls = 0;
  const response = await globalThis.fetch('https://ourhome.example/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test',
      'X-OurHome-Request-Id': 'chat-recover-12345678',
    },
    body: JSON.stringify({ session_id: 22, message: 'recover me', model: 'model-a' }),
  });
  const data = await response.json();
  assert.equal(postCalls, 1);
  assert.equal(historyCalls, 1);
  assert.equal(data.reply, 'recovered reply');
  assert.equal(data.recoveredAfterNetworkLoss, true);
  assert.equal(response.headers.get('X-OurHome-Chat-Recovered'), '1');
});

test('an unfinished Chat send survives a page refresh and the rebuilt page performs zero new POSTs', async () => {
  mode = 'recover';
  historyMessage = 'survive refresh';
  postCalls = 0;
  historyCalls = 0;

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test',
      'X-OurHome-Request-Id': 'chat-new-page-87654321',
    },
    body: JSON.stringify({ session_id: 22, message: 'survive refresh', model: 'model-a' }),
  };
  const info = guardTest.chatRequestInfo('https://ourhome.example/api/chat', options);
  info.startedAt = Date.now() - 40_000;
  guardTest.rememberPendingSend(info, 'chat-before-refresh-12345678');

  const response = await globalThis.fetch('https://ourhome.example/api/chat', options);
  const data = await response.json();

  assert.equal(postCalls, 0);
  assert.equal(historyCalls, 1);
  assert.equal(data.reply, 'recovered reply');
  assert.equal(data.recoveredAfterNetworkLoss, true);
  assert.equal(response.headers.get('X-OurHome-Request-Id'), 'chat-before-refresh-12345678');
  assert.equal(guardTest.pendingSendFor(info), null);
});

test('after a completed turn clears its refresh marker, the same text can be intentionally sent again', async () => {
  mode = 'dedupe';
  postCalls = 0;
  historyCalls = 0;
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test',
      'X-OurHome-Request-Id': 'chat-repeat-intent-12345678',
    },
    body: JSON.stringify({ session_id: 22, message: 'same words on purpose', model: 'model-a' }),
  };

  const response = await globalThis.fetch('https://ourhome.example/api/chat', options);
  await response.json();

  assert.equal(postCalls, 1);
  assert.equal(historyCalls, 0);
  assert.equal(guardTest.pendingSendFor(guardTest.chatRequestInfo('https://ourhome.example/api/chat', options)), null);
});
