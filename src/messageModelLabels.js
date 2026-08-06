const STORAGE_KEY = 'ourhome_message_models_v1';
const MAX_STORED_MODELS = 3000;
const LABEL_CLASS = 'ourhome-message-model-label';

let installed = false;
let renderFrame = 0;
let messageModels = loadStoredModels();

function loadStoredModels() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function persistModels() {
  try {
    const entries = Object.entries(messageModels);
    if (entries.length > MAX_STORED_MODELS) {
      messageModels = Object.fromEntries(entries.slice(-MAX_STORED_MODELS));
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messageModels));
  } catch {
    // 模型署名只是视觉辅助，存储失败时不影响聊天本身。
  }
}

function normalizeModel(value) {
  return String(value || '').trim().slice(0, 240);
}

function rememberModel(messageId, model) {
  const id = String(messageId || '').trim();
  const normalizedModel = normalizeModel(model);
  if (!id || !normalizedModel || messageModels[id] === normalizedModel) return;
  messageModels[id] = normalizedModel;
  persistModels();
  scheduleRender();
}

function rememberPayload(payload, pathname) {
  if (!payload) return;

  if (/\/sessions\/[^/]+\/messages\/?$/i.test(pathname) && Array.isArray(payload)) {
    payload.forEach(message => {
      if (message?.role !== 'assistant') return;
      rememberModel(message.id, message.model_name || message.requested_model);
    });
    return;
  }

  if (/\/chat(?:\/regenerate)?\/?$/i.test(pathname) && typeof payload === 'object') {
    const assistantId = payload.assistantMessage?.id || payload.id;
    rememberModel(assistantId, payload.model || payload.requestedModel);
  }
}

function requestPath(input) {
  try {
    const raw = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input?.url;
    return new URL(raw, window.location.href).pathname;
  } catch {
    return '';
  }
}

function installFetchObserver() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    const pathname = requestPath(args[0]);
    if (/\/(?:chat(?:\/regenerate)?|sessions\/[^/]+\/messages)\/?$/i.test(pathname)) {
      response.clone().json()
        .then(payload => rememberPayload(payload, pathname))
        .catch(() => {});
    }
    return response;
  };
}

function findMessageColumn(messageRoot) {
  return Array.from(messageRoot.children || []).find(child => {
    const maxWidth = String(child?.style?.maxWidth || '').replace(/\s/g, '');
    return maxWidth === '72%';
  }) || null;
}

function renderModelLabels() {
  document.querySelectorAll('[id^="msg-"]').forEach(messageRoot => {
    const messageId = messageRoot.id.slice(4);
    const model = messageModels[messageId];
    const column = findMessageColumn(messageRoot);
    if (!column) return;

    let label = column.querySelector(`:scope > .${LABEL_CLASS}`);
    if (!model) {
      label?.remove();
      return;
    }

    if (!label) {
      label = document.createElement('div');
      label.className = LABEL_CLASS;
      column.prepend(label);
    }
    if (label.textContent !== model) label.textContent = model;
    label.title = model;
  });
}

function scheduleRender() {
  cancelAnimationFrame(renderFrame);
  renderFrame = requestAnimationFrame(renderModelLabels);
}

function installStyles() {
  if (document.getElementById('ourhome-message-model-label-style')) return;
  const style = document.createElement('style');
  style.id = 'ourhome-message-model-label-style';
  style.textContent = `
    .${LABEL_CLASS} {
      max-width: 100%;
      box-sizing: border-box;
      padding: 0 3px;
      margin: 0 0 -1px;
      color: rgba(143, 105, 76, 0.62);
      font-size: 10.5px;
      font-style: italic;
      font-weight: 400;
      line-height: 1.35;
      letter-spacing: 0.035em;
      overflow-wrap: anywhere;
      user-select: text;
    }
  `;
  document.head.appendChild(style);
}

export function installMessageModelLabels() {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return;
  installed = true;
  installStyles();
  installFetchObserver();

  const observer = new MutationObserver(scheduleRender);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY) return;
    messageModels = loadStoredModels();
    scheduleRender();
  });
  scheduleRender();
}
