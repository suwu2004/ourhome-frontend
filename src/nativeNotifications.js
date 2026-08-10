import { Capacitor, registerPlugin } from '@capacitor/core';

// This bridge owns Android permission + local schedule reminders only.
// Remote proactive notifications stay on Web Push until the native FCM channel is configured.
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
