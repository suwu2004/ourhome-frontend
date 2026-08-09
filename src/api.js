const configuredBackend = import.meta.env?.VITE_BACKEND_URL?.trim();
const configuredDirectBackend = import.meta.env?.VITE_DIRECT_BACKEND_URL?.trim();

export const BACKEND = (configuredBackend || '/api').replace(/\/$/, '');
export const DIRECT_BACKEND = (configuredDirectBackend || 'https://ourhome-backend.onrender.com').replace(/\/$/, '');
export const TOKEN_KEY = 'ourhome_token';

const RETRYABLE_READ_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const ROUTE_FALLBACK_STATUS = new Set([502, 504]);
const READ_RETRY_DELAY_MS = 280;
const CLOUD_CACHE_PREFIX = 'ourhome_cloud_read:';
const CLOUD_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const staleCloudReads = new Map();
let activeBackend = BACKEND;

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

function emitCloudSyncState() {
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

function readCloudCache(path) {
  if (!path || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(cacheKey(path));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const savedAt = Number(parsed?.savedAt || 0);
    if (!savedAt || Date.now() - savedAt > CLOUD_CACHE_MAX_AGE_MS || typeof parsed?.body !== 'string') {
      localStorage.removeItem(cacheKey(path));
      return null;
    }
    const headers = new Headers({
      'Content-Type': parsed.contentType || 'application/json',
      'X-OurHome-Cache': 'stale',
      'X-OurHome-Cached-At': String(savedAt),
    });
    markCloudStale(path, savedAt);
    return new Response(parsed.body, { status: 200, headers });
  } catch {
    return null;
  }
}

async function rememberCloudRead(path, response) {
  if (!path || !response?.ok || response.headers.get('X-OurHome-Cache') === 'stale' || typeof localStorage === 'undefined') return;
  try {
    const body = await response.clone().text();
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
  const requestUrl = backendUrl(url);
  let response;
  let primaryError = null;
  try {
    // Only idempotent reads get one quiet retry. Writes, Chat sends and model calls
    // remain strictly single-shot so a network wobble can never duplicate data or cost.
    response = await fetchWithSafeReadRetry(requestUrl, options, headers);
  } catch (error) {
    primaryError = error;
  }

  // If the same-origin Vercel relay itself is unreachable, one idempotent GET may
  // probe the direct Render route. A successful alternate read pins the rest of
  // this page session to that route. POST/PATCH/DELETE never enter this branch.
  if (mayTryAlternateRead(url, options) && (primaryError || ROUTE_FALLBACK_STATUS.has(response?.status))) {
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
    const cached = cloudPath ? readCloudCache(cloudPath) : null;
    if (cached) response = cached;
    else throw primaryError || new Error('网络请求没有完成');
  }

  // Home-facing configuration is tiny and safe to show from the last successful
  // sync when the relay is briefly unavailable. Never mask authentication errors,
  // and never cache chat/session reads where stale data could target the wrong room.
  if (cloudPath && RETRYABLE_READ_STATUS.has(response.status)) {
    response = readCloudCache(cloudPath) || response;
  }

  if (response.status === 401 && token) {
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new Event('ourhome-auth-changed'));
  }

  if (cloudPath && response.ok) await rememberCloudRead(cloudPath, response);

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
