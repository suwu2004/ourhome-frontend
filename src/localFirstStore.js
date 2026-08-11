const DB_NAME = 'ourhome-local-first';
const DB_VERSION = 2;
const RESPONSE_STORE = 'responses';
const OUTBOX_STORE = 'outbox';
const MAX_CACHE_ENTRIES = 320;
const MAX_CACHE_BYTES = 128 * 1024 * 1024;
const MAX_ENTRY_BYTES = 8 * 1024 * 1024;

const memoryResponses = new Map();
const memoryOutbox = new Map();
let databasePromise = null;
let writesSincePrune = 0;

function emitLocalFirstUpdate() {
  try {
    globalThis.window?.dispatchEvent(new CustomEvent('ourhome-local-first-updated'));
  } catch { /* status updates are best-effort */ }
}

const LOCAL_FIRST_ROUTES = [
  /^\/settings$/,
  /^\/sessions(?:\/|$)/,
  /^\/messages\/search$/,
  /^\/(?:memory-log|memories|memory-favorites)(?:\/|$)/,
  /^\/letters(?:\/|$)/,
  /^\/(?:calendar|milestones|schedule|wishes|home-memos)(?:\/|$)/,
  /^\/vault$/,
  /^\/reading(?:\/|$)/,
  /^\/toybox(?:\/|$)/,
  /^\/theater(?:\/|$)/,
  /^\/music\/(?:tracks|state)$/,
  /^\/photo-memories$/,
  /^\/luze-room(?:\/|$)/,
  /^\/luze-autonomy\/settings$/,
  /^\/agentmail\/activity$/,
];

const LOCAL_FIRST_EXCLUSIONS = [
  /^\/(?:backup|export|upload|weather|failover|push|api-usage)(?:\/|$)/,
];

const OUTBOX_ROUTES = [
  /^\/settings$/,
  /^\/sessions(?:\/|$)/,
  /^\/(?:home-memos|calendar|milestones|schedule|wishes|letters)(?:\/|$)/,
  /^\/(?:memories|memory-favorites)(?:\/|$)/,
  /^\/vault(?:\/|$)/,
  /^\/reading(?:\/|$)/,
  /^\/theater\/(?:rules|global-rules)(?:\/|$)/,
  /^\/photo-memories(?:\/|$)/,
  /^\/music\/(?:tracks|state)(?:\/|$)/,
  /^\/luze-autonomy\/settings$/,
];

const OUTBOX_EXCLUSIONS = [
  /\/(?:generate|regenerate|rollback|import|luze-reply|chat)(?:\/|$)/,
  /^\/(?:upload|push|failover|agentmail|api-profiles|connections|toybox|luze-room)(?:\/|$)/,
];

function normalizedApiPath(value) {
  try {
    const url = new URL(String(value || ''), globalThis.location?.origin || 'https://ourhome.local');
    const pathname = url.pathname.replace(/^\/api(?=\/|$)/, '') || '/';
    const search = new URLSearchParams(url.search);
    search.sort();
    const suffix = search.toString();
    return `${pathname}${suffix ? `?${suffix}` : ''}`;
  } catch {
    return '';
  }
}

export function localFirstReadPath(value, options = {}) {
  if (String(options.method || 'GET').toUpperCase() !== 'GET') return '';
  const normalized = normalizedApiPath(value);
  if (!normalized) return '';
  const pathname = normalized.split('?')[0];
  if (LOCAL_FIRST_EXCLUSIONS.some(pattern => pattern.test(pathname))) return '';
  return LOCAL_FIRST_ROUTES.some(pattern => pattern.test(pathname)) ? normalized : '';
}

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  if (databasePromise) return databasePromise;

  databasePromise = new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    let request;
    try {
      request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      finish(null);
      return;
    }
    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.objectStoreNames.contains(RESPONSE_STORE)
        ? request.transaction.objectStore(RESPONSE_STORE)
        : database.createObjectStore(RESPONSE_STORE, { keyPath: 'path' });
      if (!store.indexNames.contains('lastAccessedAt')) store.createIndex('lastAccessedAt', 'lastAccessedAt');
      if (!database.objectStoreNames.contains(OUTBOX_STORE)) {
        const outbox = database.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
        outbox.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      finish(database);
    };
    request.onerror = () => finish(null);
    request.onblocked = () => finish(null);
  });

  return databasePromise;
}

function simpleHash(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function containsCredential(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, item]) => (
    /(?:api[_-]?key|token|secret|password|passphrase|webhook[_-]?key|vapid)/i.test(key)
    || (item && typeof item === 'object' && containsCredential(item))
  ));
}

export function localFirstMutation(value, options = {}, requestId = '', failureStatus = 0) {
  const method = String(options.method || 'GET').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return null;
  const path = normalizedApiPath(value);
  if (!path) return null;
  const pathname = path.split('?')[0];
  if (!OUTBOX_ROUTES.some(pattern => pattern.test(pathname))) return null;
  if (OUTBOX_EXCLUSIONS.some(pattern => pattern.test(pathname))) return null;

  const contentType = new Headers(options.headers || undefined).get('Content-Type') || '';
  const body = options.body == null ? '' : options.body;
  if (body && (typeof body !== 'string' || !/application\/json/i.test(contentType))) return null;
  if (byteLength(body) > 512 * 1024) return null;
  if (body) {
    try {
      if (containsCredential(JSON.parse(body))) return null;
    } catch {
      return null;
    }
  }

  const id = `mutation:${simpleHash(`${method}\n${path}\n${body}`)}`;
  const now = Date.now();
  return {
    id,
    path,
    method,
    body,
    contentType: contentType || 'application/json',
    requestId: String(requestId || id),
    replayable: Number(failureStatus) === 402,
    failureStatus: Number(failureStatus) || 0,
    createdAt: now,
    updatedAt: now,
  };
}

async function outboxPut(record) {
  const database = await openDatabase();
  if (!database) {
    const previous = memoryOutbox.get(record.id);
    memoryOutbox.set(record.id, previous ? { ...record, createdAt: previous.createdAt } : record);
    return;
  }
  const previousTransaction = database.transaction(OUTBOX_STORE, 'readonly');
  const previous = await requestValue(previousTransaction.objectStore(OUTBOX_STORE).get(record.id));
  const transaction = database.transaction(OUTBOX_STORE, 'readwrite');
  await requestValue(transaction.objectStore(OUTBOX_STORE).put(
    previous ? { ...record, createdAt: previous.createdAt } : record,
  ));
}

export async function rememberPendingMutation(value, options, requestId, failureStatus) {
  const record = localFirstMutation(value, options, requestId, failureStatus);
  if (!record) return false;
  try {
    await outboxPut(record);
    emitLocalFirstUpdate();
    return true;
  } catch {
    return false;
  }
}

export async function listPendingMutations({ replayableOnly = false } = {}) {
  const database = await openDatabase();
  let records;
  if (!database) records = [...memoryOutbox.values()];
  else {
    const transaction = database.transaction(OUTBOX_STORE, 'readonly');
    records = await requestValue(transaction.objectStore(OUTBOX_STORE).getAll()).catch(() => []);
  }
  return records
    .filter(record => !replayableOnly || record.replayable)
    .sort((left, right) => left.createdAt - right.createdAt);
}

export async function removePendingMutation(id) {
  memoryOutbox.delete(id);
  const database = await openDatabase();
  if (database) {
    const transaction = database.transaction(OUTBOX_STORE, 'readwrite');
    await requestValue(transaction.objectStore(OUTBOX_STORE).delete(id)).catch(() => {});
  }
  emitLocalFirstUpdate();
}

export async function removeMatchingPendingMutation(value, options = {}) {
  const record = localFirstMutation(value, options, '', 0);
  if (record) await removePendingMutation(record.id);
}

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

async function readRecord(path) {
  const database = await openDatabase();
  if (!database) return memoryResponses.get(path) || null;
  const transaction = database.transaction(RESPONSE_STORE, 'readonly');
  return requestValue(transaction.objectStore(RESPONSE_STORE).get(path));
}

async function putRecord(record) {
  const database = await openDatabase();
  if (!database) {
    memoryResponses.set(record.path, record);
    return;
  }
  const transaction = database.transaction(RESPONSE_STORE, 'readwrite');
  await requestValue(transaction.objectStore(RESPONSE_STORE).put(record));
}

async function touchRecord(record) {
  const next = { ...record, lastAccessedAt: Date.now() };
  try { await putRecord(next); } catch { /* a read must still work if metadata cannot be updated */ }
}

async function pruneOldest(database, amount, bytesToFree = 0) {
  if (!database || (amount <= 0 && bytesToFree <= 0)) return;
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(RESPONSE_STORE, 'readwrite');
    const index = transaction.objectStore(RESPONSE_STORE).index('lastAccessedAt');
    let removed = 0;
    let freed = 0;
    const request = index.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || (removed >= amount && freed >= bytesToFree)) return;
      freed += Number(cursor.value?.size || 0);
      cursor.delete();
      removed += 1;
      cursor.continue();
    };
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB prune failed'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB prune aborted'));
  });
}

async function pruneIfNeeded() {
  writesSincePrune += 1;
  if (writesSincePrune < 20) return;
  writesSincePrune = 0;
  const database = await openDatabase();
  if (!database) {
    let bytes = [...memoryResponses.values()].reduce((sum, record) => sum + Number(record.size || 0), 0);
    const oldest = [...memoryResponses.values()].sort((left, right) => left.lastAccessedAt - right.lastAccessedAt);
    while (oldest.length && (memoryResponses.size > MAX_CACHE_ENTRIES || bytes > MAX_CACHE_BYTES)) {
      const record = oldest.shift();
      memoryResponses.delete(record.path);
      bytes -= Number(record.size || 0);
    }
    return;
  }
  const usage = await new Promise((resolve, reject) => {
    const transaction = database.transaction(RESPONSE_STORE, 'readonly');
    const request = transaction.objectStore(RESPONSE_STORE).openCursor();
    let entries = 0;
    let bytes = 0;
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      entries += 1;
      bytes += Number(cursor.value?.size || 0);
      cursor.continue();
    };
    transaction.oncomplete = () => resolve({ entries, bytes });
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB usage check failed'));
  });
  await pruneOldest(
    database,
    Math.max(0, usage.entries - MAX_CACHE_ENTRIES),
    Math.max(0, usage.bytes - MAX_CACHE_BYTES),
  );
}

function byteLength(value) {
  if (globalThis.TextEncoder) return new TextEncoder().encode(value).byteLength;
  return String(value || '').length * 2;
}

export async function rememberLocalFirstRead(path, response, transformBody) {
  if (!path || !response?.ok || response.headers.get('X-OurHome-Cache') === 'stale') return false;
  const contentType = response.headers.get('Content-Type') || 'application/json';
  if (!/(?:application\/json|text\/)/i.test(contentType)) return false;

  try {
    const rawBody = await response.clone().text();
    const body = transformBody ? transformBody(rawBody) : rawBody;
    const size = byteLength(body);
    if (size > MAX_ENTRY_BYTES) return false;
    const now = Date.now();
    const record = { path, body, contentType, size, savedAt: now, lastAccessedAt: now };
    try {
      await putRecord(record);
    } catch (error) {
      if (error?.name !== 'QuotaExceededError') throw error;
      const database = await openDatabase();
      await pruneOldest(database, 32);
      await putRecord(record);
    }
    await pruneIfNeeded();
    emitLocalFirstUpdate();
    return true;
  } catch {
    return false;
  }
}

export async function readLocalFirstResponse(path) {
  if (!path) return null;
  try {
    const record = await readRecord(path);
    if (!record || typeof record.body !== 'string' || !record.savedAt) return null;
    touchRecord(record);
    return new Response(record.body, {
      status: 200,
      headers: {
        'Content-Type': record.contentType || 'application/json',
        'X-OurHome-Cache': 'stale',
        'X-OurHome-Local-First': '1',
        'X-OurHome-Cached-At': String(record.savedAt),
      },
    });
  } catch {
    return null;
  }
}

export async function getLocalFirstStats() {
  const database = await openDatabase();
  if (!database) {
    const records = [...memoryResponses.values()];
    return {
      entries: records.length,
      bytes: records.reduce((sum, record) => sum + Number(record.size || 0), 0),
      newestAt: Math.max(0, ...records.map(record => Number(record.savedAt || 0))),
      pendingMutations: memoryOutbox.size,
      replayableMutations: [...memoryOutbox.values()].filter(record => record.replayable).length,
    };
  }
  const responseStats = await new Promise((resolve, reject) => {
    const transaction = database.transaction(RESPONSE_STORE, 'readonly');
    const request = transaction.objectStore(RESPONSE_STORE).openCursor();
    let entries = 0;
    let bytes = 0;
    let newestAt = 0;
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      entries += 1;
      bytes += Number(cursor.value?.size || 0);
      newestAt = Math.max(newestAt, Number(cursor.value?.savedAt || 0));
      cursor.continue();
    };
    transaction.oncomplete = () => resolve({ entries, bytes, newestAt });
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB stats failed'));
  }).catch(() => ({ entries: 0, bytes: 0, newestAt: 0 }));
  const pending = await listPendingMutations();
  return {
    ...responseStats,
    pendingMutations: pending.length,
    replayableMutations: pending.filter(record => record.replayable).length,
  };
}

export async function clearLocalFirstData() {
  memoryResponses.clear();
  memoryOutbox.clear();
  const database = await openDatabase();
  if (database) {
    const transaction = database.transaction([RESPONSE_STORE, OUTBOX_STORE], 'readwrite');
    await Promise.all([
      requestValue(transaction.objectStore(RESPONSE_STORE).clear()),
      requestValue(transaction.objectStore(OUTBOX_STORE).clear()),
    ]).catch(() => {});
  }
  emitLocalFirstUpdate();
}

export async function requestPersistentLocalStorage() {
  try {
    if (!globalThis.navigator?.storage?.persist) return false;
    if (await globalThis.navigator.storage.persisted?.()) return true;
    return Boolean(await globalThis.navigator.storage.persist());
  } catch {
    return false;
  }
}
