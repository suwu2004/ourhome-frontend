from pathlib import Path
import json

# App wiring
path = Path('src/App.jsx')
text = path.read_text()
old_import = """  cancelNativeScheduleReminder,
  getNativeNotificationPermission,
  isNativeAndroidApp,
  openNativeNotificationSettings,
  requestNativeNotificationPermission,
  syncNativeScheduleReminders,
"""
new_import = """  cancelNativeScheduleReminder,
  getNativeNotificationPermission,
  getNativeRemotePushStatus,
  isNativeAndroidApp,
  listenNativeRemotePushTokens,
  openNativeNotificationSettings,
  registerNativeRemotePush,
  requestNativeNotificationPermission,
  syncNativeScheduleReminders,
"""
if 'getNativeRemotePushStatus' not in text:
    if old_import not in text: raise SystemExit('App native notification import anchor missing')
    text = text.replace(old_import, new_import, 1)

state_anchor = """  const [notifStatus, setNotifStatus] = useState('default');
  const [subscribing, setSubscribing] = useState(false);
"""
state_replacement = """  const [notifStatus, setNotifStatus] = useState('default');
  const [subscribing, setSubscribing] = useState(false);
  const [nativeRemotePushStatus, setNativeRemotePushStatus] = useState({ configured: false, enabled: false, token: '', reason: '' });
"""
if 'nativeRemotePushStatus' not in text:
    if state_anchor not in text: raise SystemExit('App notification state anchor missing')
    text = text.replace(state_anchor, state_replacement, 1)

old_refresh = """    const refreshNativePermission = () => {
      getNativeNotificationPermission()
        .then(status => setNotifStatus(status === 'prompt-with-rationale' ? 'default' : status))
        .catch(() => setNotifStatus('default'));
    };
"""
new_refresh = """    const registerRemoteTokenWithBackend = async token => {
      const value = String(token || '').trim();
      if (!value) return;
      const response = await apiFetch(`${BACKEND}/push/native/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: value }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || '远程通知设备登记失败');
      }
    };

    const refreshNativePermission = () => {
      Promise.all([getNativeNotificationPermission(), getNativeRemotePushStatus()])
        .then(async ([status, remoteStatus]) => {
          setNotifStatus(status === 'prompt-with-rationale' ? 'default' : status);
          setNativeRemotePushStatus(remoteStatus);
          if (remoteStatus?.configured && remoteStatus?.enabled && remoteStatus?.token) {
            await registerRemoteTokenWithBackend(remoteStatus.token);
          }
        })
        .catch(() => setNotifStatus('default'));
    };
"""
if 'registerRemoteTokenWithBackend' not in text:
    if old_refresh not in text: raise SystemExit('App native permission refresh anchor missing')
    text = text.replace(old_refresh, new_refresh, 1)

visibility_cleanup = """    return () => {
      window.removeEventListener('focus', refreshNativePermission);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);
"""
visibility_replacement = """    let removeTokenListener = () => {};
    listenNativeRemotePushTokens(({ token }) => {
      registerRemoteTokenWithBackend(token).catch(error => console.error('FCM token 更新登记失败', error));
    }).then(remove => { removeTokenListener = remove; }).catch(() => {});

    return () => {
      window.removeEventListener('focus', refreshNativePermission);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      removeTokenListener();
    };
  }, []);
"""
if 'FCM token 更新登记失败' not in text:
    if visibility_cleanup not in text: raise SystemExit('App native permission cleanup anchor missing')
    text = text.replace(visibility_cleanup, visibility_replacement, 1)

grant_anchor = """        if (normalizedPermission === 'granted') {
          await fetchSchedule();
"""
grant_replacement = """        if (normalizedPermission === 'granted') {
          const remoteStatus = await registerNativeRemotePush();
          setNativeRemotePushStatus(remoteStatus);
          if (remoteStatus?.configured && remoteStatus?.enabled && remoteStatus?.token) {
            const response = await apiFetch(`${BACKEND}/push/native/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: remoteStatus.token }),
            });
            if (!response.ok) {
              const data = await response.json().catch(() => ({}));
              throw new Error(data?.error || '远程通知设备登记失败');
            }
          }
          await fetchSchedule();
"""
if 'const remoteStatus = await registerNativeRemotePush();' not in text:
    if grant_anchor not in text: raise SystemExit('App enable notifications anchor missing')
    text = text.replace(grant_anchor, grant_replacement, 1)

mode_anchor = "notificationMode={isNativeAndroidApp() ? 'native-local' : 'web-push'}"
mode_replacement = "notificationMode={isNativeAndroidApp() ? (nativeRemotePushStatus.configured && nativeRemotePushStatus.enabled ? 'native-fcm' : 'native-local') : 'web-push'}"
if mode_anchor in text:
    text = text.replace(mode_anchor, mode_replacement, 1)
path.write_text(text)

# Root: notification tap routing
path = Path('src/Root.jsx')
text = path.read_text()
import_anchor = "import { emitGlobalSync } from './globalSync.js';\n"
import_replacement = """import { emitGlobalSync } from './globalSync.js';
import {
  consumeNativeRemotePushRoute,
  isNativeAndroidApp,
  listenNativeRemotePushActions,
} from './nativeNotifications.js';
"""
if 'consumeNativeRemotePushRoute' not in text:
    if import_anchor not in text: raise SystemExit('Root import anchor missing')
    text = text.replace(import_anchor, import_replacement, 1)

root_anchor = """  useEffect(() => {
    if (!persistentAppRoomKeys.has(room)) return;
    setPersistentAppMounted(true);
    setLastPersistentRoom(room);
  }, [room]);
"""
root_effect = """  useEffect(() => {
    if (!isNativeAndroidApp()) return undefined;
    let disposed = false;
    let removeListener = () => {};

    const openRemotePushTarget = payload => {
      if (disposed) return;
      const requested = String(payload?.route || 'home');
      const nextRoom = roomKeys.has(requested) ? requested : 'home';
      if (nextRoom === 'home') {
        window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
        setRoom('home');
        return;
      }
      if (persistentAppRoomKeys.has(nextRoom)) {
        setPersistentAppMounted(true);
        setLastPersistentRoom(nextRoom);
      }
      window.location.hash = nextRoom;
      setRoom(nextRoom);
    };

    (async () => {
      try {
        removeListener = await listenNativeRemotePushActions(openRemotePushTarget);
        const pending = await consumeNativeRemotePushRoute();
        if (pending) openRemotePushTarget(pending);
      } catch (error) {
        console.error('原生推送跳转没有接好', error);
      }
    })();

    return () => {
      disposed = true;
      removeListener();
    };
  }, []);

""" + root_anchor
if 'openRemotePushTarget' not in text:
    if root_anchor not in text: raise SystemExit('Root lifecycle anchor missing')
    text = text.replace(root_anchor, root_effect, 1)
path.write_text(text)

# Settings copy
path = Path('src/SettingsRoom.jsx')
text = path.read_text()
old_description = """                  {notificationMode === 'native-local'
                    ? 'App 里的日程会走 Android 系统通知；陆泽主动敲门的原生云推送还需要接 FCM。'
                    : '给日程提醒和陆泽主动敲门用；换设备后在这里重新登记。'}
"""
new_description = """                  {notificationMode === 'native-fcm'
                    ? 'Android 系统通知 + FCM 远程主动通知已经接通；陆泽主动消息、来信和远程提醒都能敲到这台手机。'
                    : notificationMode === 'native-local'
                      ? 'App 里的日程会走 Android 系统通知；这台 APK 还没有 Firebase 配置，所以远程主动通知暂未启用。'
                      : '给日程提醒和陆泽主动敲门用；换设备后在这里重新登记。'}
"""
if "FCM 远程主动通知已经接通" not in text:
    if old_description not in text: raise SystemExit('Settings notification description anchor missing')
    text = text.replace(old_description, new_description, 1)

old_granted = """              {notifStatus === 'granted'
                ? (notificationMode === 'native-local' ? '这台 Android 设备已经允许 OurHome 日程通知。' : '这台设备已经允许通知。')
"""
new_granted = """              {notifStatus === 'granted'
                ? (notificationMode === 'native-fcm'
                    ? '这台 Android 设备已经登记 FCM 远程主动通知。'
                    : notificationMode === 'native-local' ? '这台 Android 设备已经允许 OurHome 日程通知。' : '这台设备已经允许通知。')
"""
if '已经登记 FCM 远程主动通知' not in text:
    if old_granted not in text: raise SystemExit('Settings granted copy anchor missing')
    text = text.replace(old_granted, new_granted, 1)
path.write_text(text)

# CI: optionally restore Firebase config from encrypted secret
path = Path('.github/workflows/android-apk.yml')
text = path.read_text()
workflow_anchor = """      - run: npm run android:sync
      - name: Resolve Android release identity
"""
workflow_replacement = """      - run: npm run android:sync
      - name: Restore optional Firebase Android config
        env:
          GOOGLE_SERVICES_JSON_BASE64: ${{ secrets.OURHOME_FIREBASE_GOOGLE_SERVICES_JSON_BASE64 }}
        shell: bash
        run: |
          set -euo pipefail
          if [ -z \"$GOOGLE_SERVICES_JSON_BASE64\" ]; then
            echo \"Firebase Android config is not configured; building with local-only notifications.\"
            exit 0
          fi
          printf '%s' \"$GOOGLE_SERVICES_JSON_BASE64\" | base64 --decode > android/app/google-services.json
          echo \"Firebase Android config restored for FCM build.\"
      - name: Resolve Android release identity
"""
if 'OURHOME_FIREBASE_GOOGLE_SERVICES_JSON_BASE64' not in text:
    if workflow_anchor not in text: raise SystemExit('Android workflow anchor missing')
    text = text.replace(workflow_anchor, workflow_replacement, 1)
path.write_text(text)

# Register regression test
path = Path('package.json')
package = json.loads(path.read_text())
script = package['scripts']['test:app']
name = 'scripts/native-fcm-push-regression.test.mjs'
if name not in script:
    package['scripts']['test:app'] = script + ' ' + name
    path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n')
