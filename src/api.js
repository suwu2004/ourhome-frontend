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

export async function apiFetch(url, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY) || '';
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  const fallbackBody = response.clone();
  const safeJson = async () => {
    try {
      return await response.json();
    } catch (cause) {
      const rawText = await fallbackBody.text().catch(() => '');
      const error = new Error(nonJsonResponseMessage(response, rawText));
      error.code = 'invalid_json_response';
      error.status = response.status;
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
