const configuredBackend = import.meta.env.VITE_BACKEND_URL?.trim();

export const BACKEND = (configuredBackend || '/api').replace(/\/$/, '');
export const TOKEN_KEY = 'ourhome_token';

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

export async function apiFetch(url, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY) || '';
  const headers = new Headers(options.headers || undefined);
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('X-OurHome-Request-Id')) headers.set('X-OurHome-Request-Id', requestId());

  const response = await fetch(url, {
    ...options,
    headers,
  });

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
