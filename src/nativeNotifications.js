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

export async function getNativeRemotePushStatus() {
  if (!isNativeAndroidApp()) return { configured: false, enabled: false, topic: '' };
  const result = await NativeNotifications.getRemotePushStatus();
  return {
    configured: Boolean(result?.configured),
    enabled: Boolean(result?.enabled),
    topic: String(result?.topic || ''),
    reason: String(result?.reason || ''),
  };
}

export async function registerNativeRemotePush() {
  if (!isNativeAndroidApp()) return { configured: false, enabled: false, topic: '' };
  const result = await NativeNotifications.registerRemotePush();
  return {
    configured: Boolean(result?.configured),
    enabled: Boolean(result?.enabled),
    topic: String(result?.topic || ''),
    reason: String(result?.reason || ''),
  };
}

export async function unregisterNativeRemotePush() {
  if (!isNativeAndroidApp()) return { configured: false, enabled: false, topic: '' };
  return NativeNotifications.unregisterRemotePush();
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
