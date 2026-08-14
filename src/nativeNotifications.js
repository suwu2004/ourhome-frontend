import { Capacitor, registerPlugin } from '@capacitor/core';

const NativeNotifications = registerPlugin('OurHomeNotifications');

export function isNativeAndroidApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function getNativeNotificationPermission() {
  if (!isNativeAndroidApp()) return 'unsupported';
  const result = await NativeNotifications.getPermissionStatus();
  return result?.status || 'default';
}

export async function requestNativeNotificationPermission() {
  if (!isNativeAndroidApp()) return 'unsupported';
  const result = await NativeNotifications.requestPermission();
  return result?.status || 'default';
}

export async function openNativeNotificationSettings() {
  if (!isNativeAndroidApp()) return;
  await NativeNotifications.openSettings();
}

function normalizeRemoteStatus(result) {
  return {
    configured: Boolean(result?.configured),
    enabled: Boolean(result?.enabled),
    token: String(result?.token || ''),
    reason: String(result?.reason || ''),
  };
}

export async function getNativeRemotePushStatus() {
  if (!isNativeAndroidApp()) return normalizeRemoteStatus(null);
  let status = normalizeRemoteStatus(await NativeNotifications.getRemotePushStatus());
  if (!status.configured || (status.enabled && status.token)) return status;

  // Notification permission can remain granted while the FCM token disappears
  // after an app update/restore, Play Services refresh, or a transient token
  // registration failure. Repair that state silently; never open a permission
  // prompt from this background status check.
  const permission = await getNativeNotificationPermission();
  if (permission !== 'granted') return status;
  try {
    status = normalizeRemoteStatus(await NativeNotifications.registerRemotePush());
  } catch (error) {
    console.warn('[native-notifications] FCM token repair failed:', error?.message || error);
  }
  return status;
}

export async function registerNativeRemotePush() {
  if (!isNativeAndroidApp()) return normalizeRemoteStatus(null);
  return normalizeRemoteStatus(await NativeNotifications.registerRemotePush());
}

export async function unregisterNativeRemotePush() {
  if (!isNativeAndroidApp()) return normalizeRemoteStatus(null);
  return normalizeRemoteStatus(await NativeNotifications.unregisterRemotePush());
}

export async function consumeNativeRemotePushRoute() {
  if (!isNativeAndroidApp()) return null;
  const payload = await NativeNotifications.consumeRemotePushRoute();
  return payload && payload.route ? payload : null;
}

export async function listenNativeRemotePushActions(handler) {
  if (!isNativeAndroidApp() || typeof handler !== 'function') return () => {};
  const handle = await NativeNotifications.addListener('remotePushAction', handler);
  return () => handle?.remove?.();
}

export async function listenNativeRemotePushTokens(handler) {
  if (!isNativeAndroidApp() || typeof handler !== 'function') return () => {};
  const handle = await NativeNotifications.addListener('remotePushTokenChanged', handler);
  return () => handle?.remove?.();
}

function normalizeReminder(event) {
  const at = Date.parse(event?.remind_at || event?.remindAt || '');
  if (!event?.id || !Number.isFinite(at)) return null;
  return {
    id: String(event.id),
    title: String(event.title || 'OurHome 提醒'),
    body: String(event.author ? `${event.author}留下的日程提醒` : '别忘了我们约好的事呀。'),
    at,
  };
}

export async function syncNativeScheduleReminders(events) {
  if (!isNativeAndroidApp()) return;
  const reminders = (Array.isArray(events) ? events : [])
    .map(normalizeReminder)
    .filter(Boolean)
    .filter(reminder => reminder.at > Date.now());
  await NativeNotifications.syncReminders({ reminders });
}

export async function cancelNativeScheduleReminder(id) {
  if (!isNativeAndroidApp() || id == null) return;
  await NativeNotifications.cancelReminder({ id: String(id) });
}
