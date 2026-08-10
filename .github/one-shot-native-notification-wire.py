from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, got {count}')
    return text.replace(old, new, 1)


app_path = Path('src/App.jsx')
app = app_path.read_text()
app = replace_once(
    app,
    "import { MILESTONE_KINDS, milestoneDisplay } from './milestoneDates.js';\n",
    "import { MILESTONE_KINDS, milestoneDisplay } from './milestoneDates.js';\nimport {\n  cancelNativeScheduleReminder,\n  getNativeNotificationPermission,\n  isNativeAndroidApp,\n  openNativeNotificationSettings,\n  requestNativeNotificationPermission,\n  syncNativeScheduleReminders,\n} from './nativeNotifications.js';\n",
    'native notification imports',
)

app = replace_once(
    app,
    """  const fetchSchedule = () => {\n    apiFetch(`${BACKEND}/schedule`)\n      .then(r => r.json())\n      .then(data => setScheduleEvents(Array.isArray(data) ? data : []))\n      .catch(console.error);\n  };""",
    """  const fetchSchedule = () => {\n    return apiFetch(`${BACKEND}/schedule`)\n      .then(r => r.json())\n      .then(data => {\n        const events = Array.isArray(data) ? data : [];\n        setScheduleEvents(events);\n        return syncNativeScheduleReminders(events).then(() => events);\n      })\n      .catch(error => {\n        console.error(error);\n        return [];\n      });\n  };""",
    'fetch schedule native sync',
)

app = replace_once(
    app,
    """        setScheduleEvents(es => [...es, data].sort((a, b) => new Date(a.remind_at) - new Date(b.remind_at)));\n        setNewScheduleTitle(\"\");""",
    """        setScheduleEvents(es => {\n          const next = [...es, data].sort((a, b) => new Date(a.remind_at) - new Date(b.remind_at));\n          syncNativeScheduleReminders(next).catch(console.error);\n          return next;\n        });\n        setNewScheduleTitle(\"\");""",
    'create schedule native sync',
)

app = replace_once(
    app,
    """  const deleteScheduleEvent = (id) => {\n    apiFetch(`${BACKEND}/schedule/${id}`, { method: 'DELETE' })\n      .then(() => setScheduleEvents(es => es.filter(e => e.id !== id)))\n      .catch(console.error);\n  };""",
    """  const deleteScheduleEvent = (id) => {\n    apiFetch(`${BACKEND}/schedule/${id}`, { method: 'DELETE' })\n      .then(() => {\n        setScheduleEvents(es => es.filter(e => e.id !== id));\n        cancelNativeScheduleReminder(id).catch(console.error);\n      })\n      .catch(console.error);\n  };""",
    'delete schedule native cancellation',
)

app = replace_once(
    app,
    """  useEffect(() => {\n    if (typeof Notification !== 'undefined') setNotifStatus(Notification.permission);\n  }, []);""",
    """  useEffect(() => {\n    if (!isNativeAndroidApp()) {\n      if (typeof Notification !== 'undefined') setNotifStatus(Notification.permission);\n      return undefined;\n    }\n\n    const refreshNativePermission = () => {\n      getNativeNotificationPermission()\n        .then(status => setNotifStatus(status === 'prompt-with-rationale' ? 'default' : status))\n        .catch(() => setNotifStatus('default'));\n    };\n    const refreshWhenVisible = () => {\n      if (document.visibilityState === 'visible') refreshNativePermission();\n    };\n\n    refreshNativePermission();\n    window.addEventListener('focus', refreshNativePermission);\n    document.addEventListener('visibilitychange', refreshWhenVisible);\n    return () => {\n      window.removeEventListener('focus', refreshNativePermission);\n      document.removeEventListener('visibilitychange', refreshWhenVisible);\n    };\n  }, []);""",
    'native notification status effect',
)

app = replace_once(
    app,
    """  const enablePushNotifications = async () => {\n    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {""",
    """  const enablePushNotifications = async () => {\n    if (isNativeAndroidApp()) {\n      const wasDenied = notifStatus === 'denied';\n      setSubscribing(true);\n      try {\n        const permission = await requestNativeNotificationPermission();\n        const normalizedPermission = permission === 'prompt-with-rationale' ? 'default' : permission;\n        setNotifStatus(normalizedPermission);\n        if (normalizedPermission === 'granted') {\n          await fetchSchedule();\n        } else if (normalizedPermission === 'denied' && wasDenied) {\n          await openNativeNotificationSettings();\n        }\n      } catch (err) {\n        console.error(err);\n      } finally {\n        setSubscribing(false);\n      }\n      return;\n    }\n\n    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {""",
    'native notification enable path',
)

app = replace_once(
    app,
    """        notifStatus={notifStatus}\n        dailyJournalEnabled={dailyJournalEnabled}""",
    """        notifStatus={notifStatus}\n        notificationMode={isNativeAndroidApp() ? 'native-local' : 'web-push'}\n        dailyJournalEnabled={dailyJournalEnabled}""",
    'notification mode prop',
)

app_path.write_text(app)

settings_path = Path('src/SettingsRoom.jsx')
settings = settings_path.read_text()
settings = replace_once(
    settings,
    """    selectedModel, modelsLoading, modelsError, notifStatus, dailyJournalEnabled,""",
    """    selectedModel, modelsLoading, modelsError, notifStatus, notificationMode, dailyJournalEnabled,""",
    'settings notification mode prop',
)
settings = replace_once(
    settings,
    """                <div style={{ marginTop: 3, fontSize: 10, color: C.muted, lineHeight: 1.5 }}>给日程提醒和陆泽主动敲门用；换设备后在这里重新登记。</div>""",
    """                <div style={{ marginTop: 3, fontSize: 10, color: C.muted, lineHeight: 1.5 }}>\n                  {notificationMode === 'native-local'\n                    ? 'App 里的日程会走 Android 系统通知；陆泽主动敲门的原生云推送还需要接 FCM。'\n                    : '给日程提醒和陆泽主动敲门用；换设备后在这里重新登记。'}\n                </div>""",
    'settings notification description',
)
settings = replace_once(
    settings,
    """              {notifStatus === 'granted' ? '这台设备已经允许通知。' : notifStatus === 'denied' ? '系统已经拒绝通知，需要先在浏览器或手机设置里打开 OurHome 通知。' : '点按钮后同意浏览器弹出的通知权限。'}""",
    """              {notifStatus === 'granted'\n                ? (notificationMode === 'native-local' ? '这台 Android 设备已经允许 OurHome 日程通知。' : '这台设备已经允许通知。')\n                : notifStatus === 'denied'\n                  ? (notificationMode === 'native-local' ? '系统没有允许通知；再次点“开启通知”会带你去手机设置。' : '系统已经拒绝通知，需要先在浏览器或手机设置里打开 OurHome 通知。')\n                  : (notificationMode === 'native-local' ? '点按钮后同意 Android 系统弹出的通知权限。' : '点按钮后同意浏览器弹出的通知权限。')}""",
    'settings notification status copy',
)
settings_path.write_text(settings)


test_path = Path('scripts/app-shell-regression.test.mjs')
tests = test_path.read_text()
tests = replace_once(
    tests,
    """const [manifestText, install, native, styles, finalHeaders, config, androidManifest, themeContext, root, vault, offline, installSettings, gradle, appUpdate, updaterPlugin, mainActivity, androidWorkflow] = await Promise.all([""",
    """const [manifestText, install, native, styles, finalHeaders, config, androidManifest, themeContext, root, vault, offline, installSettings, gradle, appUpdate, updaterPlugin, mainActivity, androidWorkflow, nativeNotifications, notificationsPlugin, reminderReceiver, appSource, settingsSource] = await Promise.all([""",
    'test resource declarations',
)
tests = replace_once(
    tests,
    """  readFile(new URL('../.github/workflows/android-apk.yml', import.meta.url), 'utf8'),\n]);""",
    """  readFile(new URL('../.github/workflows/android-apk.yml', import.meta.url), 'utf8'),\n  readFile(new URL('../src/nativeNotifications.js', import.meta.url), 'utf8'),\n  readFile(new URL('../android/app/src/main/java/com/ourhome/app/OurHomeNotificationsPlugin.java', import.meta.url), 'utf8'),\n  readFile(new URL('../android/app/src/main/java/com/ourhome/app/OurHomeReminderReceiver.java', import.meta.url), 'utf8'),\n  readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),\n  readFile(new URL('../src/SettingsRoom.jsx', import.meta.url), 'utf8'),\n]);""",
    'test resource reads',
)
insert_after = """test('native releases expose real build info and a user-approved in-app updater', () => {\n  assert.match(offline, /Capacitor\\.isNativePlatform\\(\\)/);\n  assert.match(offline, /registration => registration\\.unregister/);\n  assert.match(offline, /name\\.startsWith\\('ourhome-'\\)/);\n  assert.doesNotMatch(installSettings, /const APP_VERSION/);\n  assert.match(installSettings, /checkForAndroidUpdate/);\n  assert.match(installSettings, /installAndroidUpdate/);\n  assert.match(installSettings, /更新到最新版/);\n  assert.match(appUpdate, /App\\.getInfo\\(\\)/);\n  assert.match(appUpdate, /releases\\/latest/);\n  assert.match(appUpdate, /latest\\.build > Number\\(current\\?\\.build/);\n  assert.match(gradle, /OURHOME_VERSION_CODE/);\n  assert.match(gradle, /OURHOME_VERSION_NAME/);\n  assert.match(gradle, /\\?: \"4\"/);\n  assert.match(gradle, /\\?: \"1\\.0\\.3\"/);\n  assert.match(androidManifest, /android\\.permission\\.REQUEST_INSTALL_PACKAGES/);\n  assert.match(mainActivity, /registerPlugin\\(OurHomeUpdaterPlugin\\.class\\)/);\n  assert.match(updaterPlugin, /canRequestPackageInstalls/);\n  assert.match(updaterPlugin, /ACTION_MANAGE_UNKNOWN_APP_SOURCES/);\n  assert.match(updaterPlugin, /FileProvider\\.getUriForFile/);\n  assert.match(updaterPlugin, /suwu2004\\/ourhome-frontend\\/releases\\/download/);\n  assert.match(androidWorkflow, /contents: write/);\n  assert.match(androidWorkflow, /100000 \\+ GITHUB_RUN_NUMBER/);\n  assert.match(androidWorkflow, /VERSION_NAME=\"1\\.0\\.3\"/);\n  assert.match(androidWorkflow, /gh release create/);\n  assert.match(androidWorkflow, /--latest/);\n});\n"""
new_test = """

test('Android notifications use native permission and local alarms while web keeps Web Push', () => {
  assert.match(androidManifest, /android\.permission\.POST_NOTIFICATIONS/);
  assert.match(androidManifest, /OurHomeReminderReceiver/);
  assert.match(mainActivity, /registerPlugin\(OurHomeNotificationsPlugin\.class\)/);
  assert.match(nativeNotifications, /isNativeAndroidApp/);
  assert.match(nativeNotifications, /syncNativeScheduleReminders/);
  assert.match(notificationsPlugin, /requestPermissionForAlias/);
  assert.match(notificationsPlugin, /PermissionState\.PROMPT/);
  assert.match(notificationsPlugin, /setAndAllowWhileIdle/);
  assert.match(reminderReceiver, /NotificationCompat\.Builder/);
  assert.match(appSource, /if \(isNativeAndroidApp\(\)\)/);
  assert.match(appSource, /await fetchSchedule\(\)/);
  assert.match(appSource, /serviceWorker.*PushManager/s);
  assert.match(settingsSource, /Android 系统通知/);
  assert.match(settingsSource, /原生云推送还需要接 FCM/);
});
"""
tests = replace_once(tests, insert_after, insert_after + new_test, 'native notification regression test')
test_path.write_text(tests)
