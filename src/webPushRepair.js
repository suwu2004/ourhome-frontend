import { apiFetch, BACKEND, TOKEN_KEY } from './api.js';
import { isNativeAndroidApp } from './nativeNotifications.js';

const ENDPOINT_KEY = 'ourhome_web_push_endpoint';
const VERIFIED_AT_KEY = 'ourhome_web_push_verified_at';
const VERIFY_INTERVAL_MS = 24 * 60 * 60 * 1000;

function base64UrlToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

function recentlyVerified(endpoint) {
  try {
    if (!endpoint || localStorage.getItem(ENDPOINT_KEY) !== endpoint) return false;
    const verifiedAt = Number(localStorage.getItem(VERIFIED_AT_KEY) || 0);
    return Number.isFinite(verifiedAt) && Date.now() - verifiedAt < VERIFY_INTERVAL_MS;
  } catch {
    return false;
  }
}

function rememberVerified(endpoint) {
  try {
    localStorage.setItem(ENDPOINT_KEY, endpoint);
    localStorage.setItem(VERIFIED_AT_KEY, String(Date.now()));
  } catch {
    // Push still works when browser storage is unavailable; only the lightweight
    // once-per-day verification cache is lost.
  }
}

async function subscribeWithServerKey(registration) {
  const keyResponse = await apiFetch(`${BACKEND}/push/public-key`, { cache: 'no-store' });
  if (!keyResponse.ok) throw new Error(`public key HTTP ${keyResponse.status}`);
  const payload = await keyResponse.json().catch(() => ({}));
  if (!payload.publicKey) throw new Error('push public key missing');
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(payload.publicKey),
  });
}

export async function repairWebPushRegistration({ force = false } = {}) {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (isNativeAndroidApp()) return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;

  let token = '';
  try { token = localStorage.getItem(TOKEN_KEY) || ''; } catch { return false; }
  if (!token) return false;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!force && subscription?.endpoint && recentlyVerified(subscription.endpoint)) return true;
  if (!subscription) subscription = await subscribeWithServerKey(registration);

  const json = subscription?.toJSON?.() || {};
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('push subscription incomplete');
  const response = await apiFetch(`${BACKEND}/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  if (!response.ok) throw new Error(`subscription HTTP ${response.status}`);
  rememberVerified(json.endpoint);
  return true;
}

export function initializeWebPushRepair() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {};

  const run = force => repairWebPushRegistration({ force }).catch(error => {
    console.warn('[web-push] background registration repair failed:', error?.message || error);
  });
  const runOnLoad = () => run(false);
  if (document.readyState === 'complete') queueMicrotask(runOnLoad);
  else window.addEventListener('load', runOnLoad, { once: true });

  const onWorkerMessage = event => {
    if (event.data?.type === 'ourhome-push-repair-needed') run(true);
  };
  navigator.serviceWorker.addEventListener('message', onWorkerMessage);

  return () => navigator.serviceWorker.removeEventListener('message', onWorkerMessage);
}
