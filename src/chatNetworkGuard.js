const RETRYABLE_CHAT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const RECOVERY_WINDOW_MS = 5 * 60 * 1000;
const PERSISTED_SEND_TTL_MS = 15 * 60 * 1000;
const PERSISTED_SEND_STORAGE_KEY = 'ourhome_chat_pending_sends:v1';
const MAX_PERSISTED_SENDS = 6;
const DIRECT_BACKEND = String(import.meta.env?.VITE_DIRECT_BACKEND_URL || 'https://ourhome-backend.onrender.com').replace(/\/$/, '');
const activeChatRequests = new Map();
const nativeFetch = globalThis.fetch?.bind(globalThis);

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function logicalFingerprint(value) {
  const text = String(value || '');
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, '0');
}

function chatRequestInfo(input, init = {}) {
  const method = String(init.method || input?.method || 'GET').toUpperCase();
  if (method !== 'POST') return null;
  let url;
  try {
    const raw = typeof input === 'string' || input instanceof URL ? String(input) : String(input?.url || '');
    url = new URL(raw, globalThis.location?.origin || 'https://ourhome.local');
  } catch {
    return null;
  }
  if (!/(?:^|\/api)\/chat\/?$/.test(url.pathname)) return null;

  let body;
  try {
    body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
  } catch {
    return null;
  }
  if (!body?.session_id) return null;

  const logical = {
    session_id: String(body.session_id),
    message: String(body.message || ''),
    model: String(body.model || ''),
    attachment_url: String(body.attachment_url || ''),
    attachment_type: String(body.attachment_type || ''),
    attachment_name: String(body.attachment_name || ''),
  };
  const key = JSON.stringify(logical);
  return {
    url,
    body,
    logical,
    key,
    fingerprint: logicalFingerprint(key),
    startedAt: Date.now(),
  };
}

function requestHeaders(input, init = {}) {
  return new Headers(init.headers || input?.headers || undefined);
}

function safeRequestId(headers) {
  const current = String(headers.get('X-OurHome-Request-Id') || '').trim();
  if (/^[A-Za-z0-9._:-]{8,160}$/.test(current)) return current;
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function browserStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function validPersistedSend(entry, now = Date.now()) {
  return Boolean(
    entry
    && /^[a-f0-9]{16}$/.test(String(entry.fingerprint || ''))
    && /^[A-Za-z0-9._:-]{8,160}$/.test(String(entry.requestId || ''))
    && Number.isFinite(Number(entry.startedAt))
    && Number(entry.startedAt) > 0
    && Number.isFinite(Number(entry.expiresAt))
    && Number(entry.expiresAt) > now,
  );
}

function readPersistedSends(now = Date.now()) {
  const storage = browserStorage();
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(PERSISTED_SEND_STORAGE_KEY) || '[]');
    const source = Array.isArray(parsed) ? parsed : [];
    const valid = source.filter(entry => validPersistedSend(entry, now)).slice(-MAX_PERSISTED_SENDS);
    if (valid.length !== source.length) {
      if (valid.length) storage.setItem(PERSISTED_SEND_STORAGE_KEY, JSON.stringify(valid));
      else storage.removeItem(PERSISTED_SEND_STORAGE_KEY);
    }
    return valid;
  } catch {
    try { storage.removeItem(PERSISTED_SEND_STORAGE_KEY); } catch { /* ignore local cleanup failures */ }
    return [];
  }
}

function pendingSendFor(info) {
  if (!info) return null;
  return readPersistedSends().find(entry => entry.fingerprint === info.fingerprint) || null;
}

function rememberPendingSend(info, requestId) {
  const storage = browserStorage();
  if (!storage || !info?.fingerprint || !requestId) return null;
  const startedAt = Number(info.startedAt) || Date.now();
  const entry = {
    fingerprint: info.fingerprint,
    requestId,
    startedAt,
    expiresAt: startedAt + PERSISTED_SEND_TTL_MS,
  };
  try {
    const next = readPersistedSends()
      .filter(item => item.fingerprint !== info.fingerprint)
      .concat(entry)
      .slice(-MAX_PERSISTED_SENDS);
    storage.setItem(PERSISTED_SEND_STORAGE_KEY, JSON.stringify(next));
    return entry;
  } catch {
    return null;
  }
}

function forgetPendingSend(info, requestId = '') {
  const storage = browserStorage();
  if (!storage || !info?.fingerprint) return;
  try {
    const next = readPersistedSends().filter(entry => (
      entry.fingerprint !== info.fingerprint
      || (requestId && entry.requestId !== requestId)
    ));
    if (next.length) storage.setItem(PERSISTED_SEND_STORAGE_KEY, JSON.stringify(next));
    else storage.removeItem(PERSISTED_SEND_STORAGE_KEY);
  } catch {
    // This is a best-effort transport marker only. Never break Chat for storage cleanup.
  }
}

function clearPersistedSendsForTest() {
  const storage = browserStorage();
  try { storage?.removeItem(PERSISTED_SEND_STORAGE_KEY); } catch { /* ignore */ }
}

function sameRouteHistoryUrl(info) {
  const path = info.url.pathname.startsWith('/api/')
    ? `/api/sessions/${encodeURIComponent(info.logical.session_id)}/messages`
    : `/sessions/${encodeURIComponent(info.logical.session_id)}/messages`;
  return new URL(path, info.url.origin).toString();
}

function directHistoryUrl(info) {
  return `${DIRECT_BACKEND}/sessions/${encodeURIComponent(info.logical.session_id)}/messages`;
}

async function fetchJsonWithTimeout(url, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await nativeFetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`history HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRecoveryHistory(info, headers) {
  const primary = sameRouteHistoryUrl(info);
  try {
    return await fetchJsonWithTimeout(primary, headers);
  } catch (primaryError) {
    const primaryUrl = new URL(primary);
    const direct = directHistoryUrl(info);
    if (!DIRECT_BACKEND || primaryUrl.origin === new URL(DIRECT_BACKEND).origin) throw primaryError;
    return fetchJsonWithTimeout(direct, headers);
  }
}

function matchingRecoveredTurn(rows, info) {
  if (!Array.isArray(rows)) return null;
  const expectedMessage = info.logical.message.trim();
  const expectedAttachment = info.logical.attachment_url;
  const earliest = info.startedAt - 20_000;

  let userIndex = -1;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row?.role !== 'user') continue;
    const createdAt = Date.parse(row.created_at || '');
    if (Number.isFinite(createdAt) && createdAt < earliest) continue;
    if (String(row.content || '').trim() !== expectedMessage) continue;
    if (String(row.attachment_url || '') !== expectedAttachment) continue;
    userIndex = index;
    break;
  }
  if (userIndex < 0) return null;

  const user = rows[userIndex];
  const assistant = rows.slice(userIndex + 1).find(row => row?.role === 'assistant');
  if (!assistant) return { pending: true, user };

  return {
    pending: false,
    payload: {
      reply: String(assistant.content || ''),
      thinking: assistant.reasoning_content || null,
      id: assistant.id,
      createdAt: assistant.created_at,
      userMessage: { id: user.id, createdAt: user.created_at },
      assistantMessage: { id: assistant.id, createdAt: assistant.created_at },
      inputTokens: assistant.input_tokens || 0,
      outputTokens: assistant.output_tokens || 0,
      actions: [],
      requestedModel: assistant.requested_model || info.logical.model,
      model: assistant.model_name || assistant.requested_model || info.logical.model,
      recoveredAfterNetworkLoss: true,
    },
  };
}

function recoveredResponse(payload, requestId) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-OurHome-Request-Id': requestId,
      'X-OurHome-Chat-Recovered': '1',
    },
  });
}

async function recoverChatResponse(info, headers, requestId, originalError = null) {
  const deadline = Date.now() + RECOVERY_WINDOW_MS;
  let delay = 700;
  let sawPersistedUser = false;

  while (Date.now() < deadline) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await wait(1500);
      continue;
    }

    try {
      const rows = await fetchRecoveryHistory(info, headers);
      const recovered = matchingRecoveredTurn(rows, info);
      if (recovered?.payload) {
        forgetPendingSend(info, requestId);
        return recoveredResponse(recovered.payload, requestId);
      }
      if (recovered?.pending) sawPersistedUser = true;
    } catch {
      // A recovery read is intentionally cheap and retryable. Never POST Chat again here.
    }

    await wait(delay);
    delay = Math.min(7000, Math.round(delay * 1.55));
  }

  if (!sawPersistedUser) forgetPendingSend(info, requestId);
  const error = new Error(
    sawPersistedUser
      ? '这次消息已经送到 OurHome，但回复还没有确认回来。为了避免重复扣 API，我没有自动重发；网络稳定后重新打开这个对话就会从云端补回来。'
      : '这次发送没有确认送达。为了避免网络波动造成重复 API 调用，我没有自动重发。网络稳定后请手动再发送一次。',
  );
  error.code = sawPersistedUser ? 'chat_delivery_unconfirmed' : 'chat_not_confirmed';
  error.cause = originalError || undefined;
  throw error;
}

async function guardedChatFetch(input, init, info, headers, requestId) {
  headers.set('X-OurHome-Request-Id', requestId);
  let response;
  try {
    response = await nativeFetch(input, { ...init, headers });
  } catch (error) {
    return recoverChatResponse(info, headers, requestId, error);
  }

  let parsed = null;
  let jsonReadable = false;
  try {
    parsed = await response.clone().json();
    jsonReadable = true;
  } catch {
    jsonReadable = false;
  }

  if (response.ok && jsonReadable) {
    forgetPendingSend(info, requestId);
    return response;
  }

  // A structured backend generation error is final. It must not be hidden behind
  // a long delivery probe, and it must never trigger another model request.
  if (!response.ok && jsonReadable && parsed?.userMessage) {
    forgetPendingSend(info, requestId);
    return response;
  }

  if (!jsonReadable || RETRYABLE_CHAT_STATUS.has(response.status)) {
    return recoverChatResponse(info, headers, requestId);
  }

  forgetPendingSend(info, requestId);
  return response;
}

async function runTrackedPromise(info, requestId, promise) {
  activeChatRequests.set(info.key, { requestId, promise, startedAt: info.startedAt });
  try {
    const response = await promise;
    return response.clone();
  } finally {
    if (activeChatRequests.get(info.key)?.promise === promise) activeChatRequests.delete(info.key);
  }
}

if (nativeFetch) {
  globalThis.fetch = async function ourHomeSingleShotFetch(input, init = {}) {
    const info = chatRequestInfo(input, init);
    if (!info) return nativeFetch(input, init);

    const existing = activeChatRequests.get(info.key);
    if (existing) {
      const response = await existing.promise;
      return response.clone();
    }

    const headers = requestHeaders(input, init);
    const persisted = pendingSendFor(info);
    if (persisted) {
      const resumedInfo = { ...info, startedAt: persisted.startedAt };
      headers.set('X-OurHome-Request-Id', persisted.requestId);
      const promise = recoverChatResponse(resumedInfo, headers, persisted.requestId);
      return runTrackedPromise(resumedInfo, persisted.requestId, promise);
    }

    const requestId = safeRequestId(headers);
    rememberPendingSend(info, requestId);
    const promise = guardedChatFetch(input, init, info, headers, requestId);
    return runTrackedPromise(info, requestId, promise);
  };
}

export const __chatNetworkGuardTest = {
  chatRequestInfo,
  matchingRecoveredTurn,
  sameRouteHistoryUrl,
  logicalFingerprint,
  pendingSendFor,
  rememberPendingSend,
  forgetPendingSend,
  clearPersistedSendsForTest,
};
