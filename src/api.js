const configuredBackend = import.meta.env.VITE_BACKEND_URL?.trim();

export const BACKEND = (configuredBackend || '/api').replace(/\/$/, '');
export const TOKEN_KEY = 'ourhome_token';

const RETRYABLE_READ_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const READ_RETRY_DELAY_MS = 280;

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

export async function apiFetch(url, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY) || '';
  const headers = new Headers(options.headers || undefined);
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('X-OurHome-Request-Id')) headers.set('X-OurHome-Request-Id', requestId());

  // Only idempotent reads get one quiet retry. Writes, Chat sends and model calls
  // remain strictly single-shot so a network wobble can never duplicate data or cost.
  const response = await fetchWithSafeReadRetry(url, options, headers);

  if (response.status === 401 && token) {
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new Event('ourhome-auth-changed'));
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
