import {
  localFirstReadPath,
  listPendingMutations,
  readLocalFirstResponse,
  rememberPendingMutation,
  rememberLocalFirstRead,
  removeMatchingPendingMutation,
  removePendingMutation,
} from './localFirstStore.js';

const configuredBackend = import.meta.env?.VITE_BACKEND_URL?.trim();
const configuredDirectBackend = import.meta.env?.VITE_DIRECT_BACKEND_URL?.trim();

export const BACKEND = (configuredBackend || '/api').replace(/\/$/, '');
export const DIRECT_BACKEND = (configuredDirectBackend || 'https://ourhome-backend.onrender.com').replace(/\/$/, '');
export const TOKEN_KEY = 'ourhome_token';

const RETRYABLE_READ_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const CLOUD_CACHE_FALLBACK_STATUS = new Set([402, ...RETRYABLE_READ_STATUS]);
const ROUTE_FALLBACK_STATUS = new Set([502, 504]);
const READ_RETRY_DELAY_MS = 280;
const CLOUD_CACHE_PREFIX = 'ourhome_cloud_read:';
const CLOUD_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SETTINGS_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const staleCloudReads = new Map();
let activeBackend = BACKEND;

const SAFE_SETTINGS_CACHE_KEYS = new Set([
  'dark_mode', 'my_avatar_url', 'partner_avatar_url',
  'bg_image_url', 'bg_color', 'home_bg_day_image_url', 'home_bg_night_image_url',
  'home_memo_bg_image_url', 'whisper_bg_image_url', 'whisper_bg_color',
  'my_bubble_color', 'partner_bubble_color',
  'calendar_day_colors',
]);

function compactResponseText(value, limit = 260) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function nonJsonResponseMessage(response, rawText) {
  const detail = compactResponseText(rawText);
  const status = response.status ? `HTTP ${response.status}` : '未知状态';
  const generic = `上游服务返回了无法识别的响应（${status}）`;

  if (!detail || /^(an error|error occurred|internal server error|bad gateway|gateway timeout)/i.test(detail)) {
    return `${generic}。图片和消息已经留在聊天里，可以直接重试；连续失败时换一个模型或 API 站点。`;
  }
  return `${generic}：${detail}`;
}

function requestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function requestMethod(options = {}) {
  return String(options.method || 'GET').toUpperCase();
}

function mayRetryRead(options = {}) {
  return requestMethod(options) === 'GET' && !options.signal;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parsedUrl(value) {
  try {
    return new URL(String(value || ''), globalThis.location?.origin || 'https://ourhome.local');
  } catch {
    return null;
  }
}

function isLogicalBackendUrl(value) {
  const text = String(value || '');
  return text === BACKEND || text.startsWith(`${BACKEND}/`);
}

function backendUrl(value, base = activeBackend) {
  const text = String(value || '');
  if (!isLogicalBackendUrl(text) || base === BACKEND) return text;
  return `${base}${text.slice(BACKEND.length)}`;
}

function alternateBackendBase() {
  return activeBackend === DIRECT_BACKEND ? BACKEND : DIRECT_BACKEND;
}

function mayTryAlternateRead(value, options = {}) {
  return BACKEND === '/api'
    && DIRECT_BACKEND
    && DIRECT_BACKEND !== BACKEND
    && mayRetryRead(options)
    && isLogicalBackendUrl(value);
}

function emitApiRoute(reason = '') {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent('ourhome-api-route', {
    detail: {
      mode: activeBackend === BACKEND ? 'same-origin' : 'direct-backend',
      backend: activeBackend,
      reason,
    },
  }));
}

function useBackend(base, reason) {
  if (!base || base === activeBackend) return;
  activeBackend = base;
  emitApiRoute(reason);
}

export function getApiRouteState() {
  return {
    mode: activeBackend === BACKEND ? 'same-origin' : 'direct-backend',
    backend: activeBackend,
  };
}

function cacheableCloudRead(value, options = {}) {
  if (requestMethod(options) !== 'GET') return null;
  const url = parsedUrl(value);
  if (!url) return null;
  if (!/(?:^|\/api)\/(?:settings|home-memos|milestones)\/?$/.test(url.pathname)) return null;
  return `${url.pathname}${url.search}`;
}

function cacheKey(path) {
  return `${CLOUD_CACHE_PREFIX}${path}`;
}

function safeCachedBody(path, body) {
  if (!/(?:^|\/api)\/settings\/?(?:\?.*)?$/.test(path)) return body;
  try {
    const parsed = JSON.parse(body);
    const safe = Object.fromEntries(Object.entries(parsed || {}).filter(([key]) => SAFE_SETTINGS_CACHE_KEYS.has(key)));
    return JSON.stringify(safe);
  } catch {
    return '{}';
  }
}

function quotaIsKnown() {
  return [...staleCloudReads.values()].some(value => value?.reason === 'quota');
}

async function readBestAvailableCache(localPath, cloudPath, logicalUrl, reason) {
  const local = localPath ? await readLocalFirstResponse(localPath) : null;
  const response = local || (cloudPath ? readCloudCache(cloudPath, logicalUrl, reason) : null);
  if (!response) return null;
  const markerPath = cloudPath || localPath;
  const cachedAt = Number(response.headers.get('X-OurHome-Cached-At') || 0) || Date.now();
  markCloudStale(markerPath, cachedAt, logicalUrl, reason);
  return response;
}

export function clearOurHomePrivateCache() {
  staleCloudReads.clear();
  if (typeof localStorage !== 'undefined') {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(CLOUD_CACHE_PREFIX)) localStorage.removeItem(key);
    }
  }
  emitCloudSyncState();
}

function cloudSyncSnapshot() {
  const entries = [...staleCloudReads.entries()];
  const quotaBlocked = entries.some(([, value]) => value?.reason === 'quota');
  return {
    state: entries.length ? 'stale' : 'online',
    reason: quotaBlocked ? 'quota' : entries.length ? 'unreachable' : null,
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

function markCloudStale(path, cachedAt, logicalUrl = '', reason = '') {
  const previous = staleCloudReads.get(path);
  const next = {
    cachedAt: cachedAt || previous?.cachedAt || Date.now(),
    logicalUrl: logicalUrl || previous?.logicalUrl || '',
    reason: reason || previous?.reason || 'unreachable',
  };
  if (previous?.cachedAt === next.cachedAt
    && previous?.logicalUrl === next.logicalUrl
    && previous?.reason === next.reason) return;
  staleCloudReads.set(path, next);
  emitCloudSyncState();
}

function markCloudFresh(path) {
  if (!path || !staleCloudReads.has(path)) return;
  staleCloudReads.delete(path);
  emitCloudSyncState();
}

function readCloudCache(path, logicalUrl = '', reason = '') {
  if (!path || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(cacheKey(path));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const savedAt = Number(parsed?.savedAt || 0);
    const maxAge = /(?:^|\/api)\/settings\/?(?:\?.*)?$/.test(path)
      ? SETTINGS_CACHE_MAX_AGE_MS
      : CLOUD_CACHE_MAX_AGE_MS;
    if (!savedAt || Date.now() - savedAt > maxAge || typeof parsed?.body !== 'string') {
      localStorage.removeItem(cacheKey(path));
      return null;
    }
    const headers = new Headers({
      'Content-Type': parsed.contentType || 'application/json',
      'X-OurHome-Cache': 'stale',
      'X-OurHome-Cached-At': String(savedAt),
    });
    markCloudStale(path, savedAt, logicalUrl, reason);
    return new Response(parsed.body, { status: 200, headers });
  } catch {
    return null;
  }
}

async function rememberCloudRead(path, response) {
  if (!path || !response?.ok || response.headers.get('X-OurHome-Cache') === 'stale' || typeof localStorage === 'undefined') return;
  try {
    const body = safeCachedBody(path, await response.clone().text());
    localStorage.setItem(cacheKey(path), JSON.stringify({
      savedAt: Date.now(),
      contentType: response.headers.get('Content-Type') || 'application/json',
      body,
    }));
    markCloudFresh(path);
  } catch {
    // Caching is only a visual resilience layer; a cache write must never break the real response.
  }
}

let cloudRecheckPromise = null;

export function recheckCloudSync() {
  if (cloudRecheckPromise) return cloudRecheckPromise;
  const logicalUrls = [...new Set(
    [...staleCloudReads.values()]
      .map(value => value?.logicalUrl)
      .filter(Boolean),
  )];
  if (!logicalUrls.length) return Promise.resolve(staleCloudReads.size === 0);

  cloudRecheckPromise = (async () => {
    try {
      const response = await apiFetch(logicalUrls[0], {
        headers: { 'X-OurHome-Cloud-Recheck': '1' },
      });
      if (response.headers.get('X-OurHome-Cache') === 'stale' || !response.ok) return false;
      // Quota restrictions are shared by the whole data plane. One real probe is
      // enough to reopen normal reads; room data refreshes only when it is viewed.
      staleCloudReads.clear();
      emitCloudSyncState();
      syncLocalFirstOutbox().catch(() => {});
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    cloudRecheckPromise = null;
  });

  return cloudRecheckPromise;
}

let outboxSyncPromise = null;

export function syncLocalFirstOutbox() {
  if (outboxSyncPromise) return outboxSyncPromise;
  outboxSyncPromise = (async () => {
    const token = localStorage.getItem(TOKEN_KEY) || '';
    if (!token) return { applied: 0, remaining: (await listPendingMutations()).length };
    const pending = await listPendingMutations({ replayableOnly: true });
    let applied = 0;
    for (const item of pending) {
      const headers = new Headers({
        'Content-Type': item.contentType || 'application/json',
        Authorization: `Bearer ${token}`,
        'X-OurHome-Request-Id': item.requestId,
        'X-OurHome-Local-Replay': '1',
      });
      let response;
      try {
        response = await fetch(backendUrl(`${BACKEND}${item.path}`), {
          method: item.method,
          headers,
          body: item.body || undefined,
        });
      } catch {
        break;
      }
      if (!response.ok && !(item.method === 'DELETE' && response.status === 404)) break;
      await removePendingMutation(item.id);
      applied += 1;
    }
    const remaining = (await listPendingMutations()).length;
    if (applied && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ourhome-global-sync', {
        detail: { source: 'local-first-replay', scope: 'all', requestedAt: new Date().toISOString() },
      }));
    }
    return { applied, remaining };
  })().finally(() => {
    outboxSyncPromise = null;
  });
  return outboxSyncPromise;
}

async function fetchWithSafeReadRetry(url, options, headers) {
  const retryable = mayRetryRead(options);
  const attempts = retryable ? 2 : 1;
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });
      const shouldRetry = retryable
        && attempt + 1 < attempts
        && RETRYABLE_READ_STATUS.has(response.status);
      if (!shouldRetry) return response;
    } catch (error) {
      lastError = error;
      const shouldRetry = retryable
        && attempt + 1 < attempts
        && error?.name !== 'AbortError';
      if (!shouldRetry) throw error;
    }

    await wait(READ_RETRY_DELAY_MS);
  }

  throw lastError || new Error('读取请求没有完成');
}

async function fetchAlternateRead(logicalUrl, options, headers) {
  const alternateBase = alternateBackendBase();
  const alternateUrl = backendUrl(logicalUrl, alternateBase);
  const response = await fetch(alternateUrl, {
    ...options,
    headers,
  });
  if (!ROUTE_FALLBACK_STATUS.has(response.status)) {
    useBackend(alternateBase, 'safe-read-fallback');
  }
  return response;
}

export async function apiFetch(url, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY) || '';
  const headers = new Headers(options.headers || undefined);
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('X-OurHome-Request-Id')) headers.set('X-OurHome-Request-Id', requestId());

  const cloudPath = cacheableCloudRead(url, options);
  const localPath = localFirstReadPath(url, options);
  const markerPath = cloudPath || localPath;
  const recheckingCloud = headers.get('X-OurHome-Cloud-Recheck') === '1';
  const method = requestMethod(options);
  const mutationRequestId = headers.get('X-OurHome-Request-Id') || '';
  const requestUrl = backendUrl(url);
  let response;
  let primaryError = null;

  // Once a quota response is known, render the device copy immediately instead
  // of making every mounted room hit the same locked data plane again.
  if (localPath && quotaIsKnown() && !recheckingCloud) {
    response = await readBestAvailableCache(localPath, cloudPath, url, 'quota');
  }

  if (!response) {
    try {
      // Only idempotent reads get one quiet retry. Writes, Chat sends and model calls
      // remain strictly single-shot so a network wobble can never duplicate data or cost.
      response = await fetchWithSafeReadRetry(requestUrl, options, headers);
    } catch (error) {
      primaryError = error;
    }
  }

  // If the same-origin Vercel relay itself is unreachable, one idempotent GET may
  // probe the direct Render route. A successful alternate read pins the rest of
  // this page session to that route. POST/PATCH/DELETE never enter this branch.
  if (!response?.headers?.get('X-OurHome-Cache')
    && mayTryAlternateRead(url, options)
    && (primaryError || ROUTE_FALLBACK_STATUS.has(response?.status))) {
    try {
      const alternateResponse = await fetchAlternateRead(url, options, headers);
      if (!ROUTE_FALLBACK_STATUS.has(alternateResponse.status) || primaryError) {
        response = alternateResponse;
        primaryError = null;
      }
    } catch {
      // Keep the original relay failure below; the alternate route is only a safe read probe.
    }
  }

  if (!response) {
    if (primaryError?.name === 'AbortError') throw primaryError;
    const cached = await readBestAvailableCache(localPath, cloudPath, url, 'unreachable');
    if (cached) response = cached;
    else {
      if (method !== 'GET') await rememberPendingMutation(url, options, mutationRequestId, 0);
      throw primaryError || new Error('网络请求没有完成');
    }
  }

  // Household reads may use only their exact device snapshot when the data plane
  // is unavailable. Authentication errors are never masked by a cached response.
  if ((localPath || cloudPath) && CLOUD_CACHE_FALLBACK_STATUS.has(response.status)) {
    const reason = response.status === 402 ? 'quota' : 'unreachable';
    response = await readBestAvailableCache(localPath, cloudPath, url, reason) || response;
  }

  if (response.status === 401 && token) {
    localStorage.removeItem(TOKEN_KEY);
    clearOurHomePrivateCache();
    window.dispatchEvent(new Event('ourhome-auth-changed'));
  }

  if (method !== 'GET' && response.status === 402) {
    await rememberPendingMutation(url, options, mutationRequestId, 402);
  } else if (method !== 'GET' && response.ok) {
    await removeMatchingPendingMutation(url, options);
  }

  if (response.ok && response.headers.get('X-OurHome-Cache') !== 'stale') {
    const cacheWrites = [];
    if (cloudPath) cacheWrites.push(rememberCloudRead(cloudPath, response));
    if (localPath) cacheWrites.push(rememberLocalFirstRead(
      localPath,
      response,
      body => safeCachedBody(localPath, body),
    ));
    await Promise.all(cacheWrites);
    if (markerPath) markCloudFresh(markerPath);
  }

  const fallbackBody = response.clone();
  const safeJson = async () => {
    try {
      return await response.json();
    } catch (cause) {
      const rawText = await fallbackBody.text().catch(() => '');
      const error = new Error(nonJsonResponseMessage(response, rawText));
      error.code = 'invalid_json_response';
      error.status = response.status;
      error.requestId = response.headers.get('X-OurHome-Request-Id') || headers.get('X-OurHome-Request-Id') || '';
      error.cause = cause;
      throw error;
    }
  };

  return new Proxy(response, {
    get(target, property) {
      if (property === 'json') return safeJson;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
