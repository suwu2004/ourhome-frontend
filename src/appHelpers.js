'use strict';

export function normalizeModelOptions(models, preferredModel = '') {
  const list = Array.isArray(models) ? models : [];
  return [...new Set([preferredModel, ...list].map(model => String(model || '').trim()).filter(Boolean))];
}

export function normalizeCalendarDayColors(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([date, color]) => (
    /^\d{4}-\d{2}-\d{2}$/.test(date) && /^#[0-9a-f]{6}$/i.test(String(color || ''))
  )).map(([date, color]) => [date, String(color).toUpperCase()]));
}

export function newestFirst(items) {
  return [...items].sort((left, right) => {
    const timeDifference = Date.parse(right?.created_at || '') - Date.parse(left?.created_at || '');
    return Number.isNaN(timeDifference) ? 0 : timeDifference;
  });
}

export function oldestFirst(items) {
  return [...items].sort((left, right) => {
    const timeDifference = Date.parse(left?.created_at || '') - Date.parse(right?.created_at || '');
    return Number.isNaN(timeDifference) ? 0 : timeDifference;
  });
}

export function formatMsgTime(date) {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mi}`;
}

export function mapDbMessage(m) {
  return {
    id: m.id,
    role: m.role === "user" ? "me" : "ai",
    text: m.content,
    image: (m.attachment_url && (!m.attachment_type || m.attachment_type.startsWith('image/'))) ? m.attachment_url : null,
    file: (m.attachment_url && m.attachment_type && !m.attachment_type.startsWith('image/')) ? { url: m.attachment_url, name: m.attachment_name || '文件' } : null,
    thinking: m.reasoning_content || null,
    inputTokens: m.input_tokens || 0,
    outputTokens: m.output_tokens || 0,
    thinkingOpen: false,
    createdAt: m.created_at,
    time: formatMsgTime(m.created_at),
  };
}

export function shanghaiDateKey(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

export function createRequestError(data, fallback) {
  const error = new Error(data?.error || fallback);
  error.code = data?.code || '';
  error.model = data?.model || '';
  return error;
}

export function isModelUnavailableError(error) {
  const raw = `${error?.code || ''} ${error?.message || ''}`;
  return /model_unavailable|model_not_found|no available channel|unknown model|model[^\n]*not found/i.test(raw);
}

export function isVisionUnavailableError(error) {
  return error?.code === 'vision_unavailable';
}

export function isEmptyModelResponseError(error) {
  return error?.code === 'empty_model_response'
    || /模型返回了空正文/.test(String(error?.message || ''));
}

export function friendlyGenerationError(error, retryAction = '再试一次') {
  if (isEmptyModelResponseError(error)) {
    return `模型这次没有返回正文。消息还在，直接${retryAction}就好。`;
  }
  if (isModelUnavailableError(error)) {
    return `这个模型在当前 API 站点暂时没有可用线路。换一个模型后直接${retryAction}就好，刚才的内容还在。`;
  }
  if (isVisionUnavailableError(error)) {
    return error?.message || `这个模型暂时不能看图。换一个带视觉能力的模型后直接${retryAction}就好，图片和消息都还在。`;
  }
  return error?.message || '连接好像有点问题，请再试一次。';
}
