export const OURHOME_GLOBAL_SYNC_EVENT = 'ourhome-global-sync';

export function emitGlobalSync(detail = {}) {
  const payload = {
    source: String(detail?.source || 'unknown'),
    scope: String(detail?.scope || 'all'),
    requestedAt: new Date().toISOString(),
  };
  window.dispatchEvent(new CustomEvent(OURHOME_GLOBAL_SYNC_EVENT, { detail: payload }));
  return payload;
}

export function subscribeGlobalSync(handler, { scope = 'all' } = {}) {
  if (typeof handler !== 'function') return () => {};
  const wantedScope = String(scope || 'all');
  const listener = event => {
    const detail = event?.detail || {};
    const eventScope = String(detail.scope || 'all');
    if (wantedScope !== 'all' && eventScope !== 'all' && eventScope !== wantedScope) return;
    handler(detail);
  };
  window.addEventListener(OURHOME_GLOBAL_SYNC_EVENT, listener);
  return () => window.removeEventListener(OURHOME_GLOBAL_SYNC_EVENT, listener);
}
