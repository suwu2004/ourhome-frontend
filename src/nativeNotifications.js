import { Capacitor, registerPlugin } from '@capacitor/core';

const OurHomeNotifications = registerPlugin('OurHomeNotifications');

function isAndroidNative() {
  return typeof window !== 'undefined'
    && Capacitor.isNativePlatform()
    && Capacitor.getPlatform() === 'android';
}

async function callPlugin(method, fallback = null) {
  if (!isAndroidNative()) return fallback;
  try {
    return await OurHomeNotifications[method]();
  } catch (error) {
    console.warn(`[native-notifications] ${method} failed:`, error?.message || error);
    return fallback;
  }
}

export { isAndroidNative };

export async function getNativeNotificationPermissionStatus() {
  return callPlugin('getPermissionStatus', { status: 'unsupported' });
}

export async function requestNativeNotificationPermission() {
  return callPlugin('requestPermission', { status: 'unsupported' });
}

export async function openNativeNotificationSettings() {
  return callPlugin('openNotificationSettings', { opened: false });
}

export async function getNativeRemotePushStatus() {
  const status = await callPlugin('getRemotePushStatus', { configured: false, enabled: false, token: '' });
  if (!isAndroidNative() || !status?.configured || (status.enabled && status.token)) return status;

  // Android can keep notification permission while losing its FCM token after an
  // app update, reinstall/restore, Play Services refresh or an earlier transient
  // registration failure. Repair that state silently when permission is already
  // granted; never trigger a permission prompt from a background status check.
  const permission = await getNativeNotificationPermissionStatus();
  if (permission?.status !== 'granted') return status;
  const repaired = await callPlugin('registerRemotePush', null);
  return repaired || status;
}

export async function registerNativeRemotePush() {
  return callPlugin('registerRemotePush', { configured: false, enabled: false, token: '' });
}

export async function unregisterNativeRemotePush() {
  return callPlugin('unregisterRemotePush', { configured: false, enabled: false, token: '' });
}

export async function consumeNativeNotificationRoute() {
  return callPlugin('consumeNotificationRoute', { route: '', session_id: '', message_id: '' });
}

export function addNativeNotificationListener(eventName, listener) {
  if (!isAndroidNative()) return Promise.resolve({ remove: async () => {} });
  return OurHomeNotifications.addListener(eventName, listener);
}

export async function scheduleNativeReminder({ id, title, body, at, route = 'home' }) {
  if (!isAndroidNative()) return { scheduled: false, unsupported: true };
  try {
    return await OurHomeNotifications.scheduleReminder({
      id: String(id || ''),
      title: String(title || 'OurHome'),
      body: String(body || ''),
      at: new Date(at).getTime(),
      route: String(route || 'home'),
    });
  } catch (error) {
    console.warn('[native-notifications] scheduleReminder failed:', error?.message || error);
    return { scheduled: false, error: error?.message || String(error) };
  }
}

export async function cancelNativeReminder(id) {
  if (!isAndroidNative()) return { cancelled: false, unsupported: true };
  try {
    return await OurHomeNotifications.cancelReminder({ id: String(id || '') });
  } catch (error) {
    console.warn('[native-notifications] cancelReminder failed:', error?.message || error);
    return { cancelled: false, error: error?.message || String(error) };
  }
}
