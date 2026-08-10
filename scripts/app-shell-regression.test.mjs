import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [manifestText, install, native, styles, finalHeaders, config, androidManifest, themeContext, root, vault, offline, installSettings, gradle, appUpdate, updaterPlugin, mainActivity, androidWorkflow, nativeNotifications, notificationsPlugin, reminderReceiver, appSource, settingsSource, chatRoomSource, failoverRecovery] = await Promise.all([
  readFile(new URL('../public/manifest.json', import.meta.url), 'utf8'),
  readFile(new URL('../src/appInstall.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/nativeApp.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/RoomHeaderFinal.css', import.meta.url), 'utf8'),
  readFile(new URL('../capacitor.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8'),
  readFile(new URL('../src/ThemeContext.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/Root.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/VaultPage.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/offlineShell.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/AppInstallSettings.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../android/app/build.gradle', import.meta.url), 'utf8'),
  readFile(new URL('../src/appUpdate.js', import.meta.url), 'utf8'),
  readFile(new URL('../android/app/src/main/java/com/ourhome/app/OurHomeUpdaterPlugin.java', import.meta.url), 'utf8'),
  readFile(new URL('../android/app/src/main/java/com/ourhome/app/MainActivity.java', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/android-apk.yml', import.meta.url), 'utf8'),
  readFile(new URL('../src/nativeNotifications.js', import.meta.url), 'utf8'),
  readFile(new URL('../android/app/src/main/java/com/ourhome/app/OurHomeNotificationsPlugin.java', import.meta.url), 'utf8'),
  readFile(new URL('../android/app/src/main/java/com/ourhome/app/OurHomeReminderReceiver.java', import.meta.url), 'utf8'),
  readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/SettingsRoom.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/ChatRoom.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/FailoverRecoverySettings.jsx', import.meta.url), 'utf8'),
]);

test('manifest is installable on vivo phones and Huawei tablets', () => {
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'any');
  assert.equal(manifest.scope, '/');
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512' && /maskable/.test(icon.purpose || '')));
});

test('install prompt is retained until settings asks for it', () => {
  assert.match(install, /beforeinstallprompt/);
  assert.match(install, /deferredPrompt/);
  assert.match(install, /appinstalled/);
});

test('native shell handles status bar splash and Android back button', () => {
  assert.match(native, /StatusBar\.setOverlaysWebView/);
  assert.match(native, /StatusBar\.getInfo/);
  assert.match(native, /--ourhome-status-bar-inset/);
  assert.match(native, /androidMajor >= 15/);
  assert.match(finalHeaders, /--ourhome-status-bar-inset/);
  assert.match(finalHeaders, /grid-template-columns:\s*44px minmax\(0, 1fr\) 44px/);
  assert.match(finalHeaders, /padding-top:\s*var\(--ourhome-status-bar-inset, 0px\)/);
  assert.match(finalHeaders, /position:\s*static !important/);
  assert.doesNotMatch(styles, /ourhome-status-bar-inset, 24px\) \+ 33px/);
  assert.match(native, /SplashScreen\.hide/);
  assert.match(native, /backButton/);
  assert.match(native, /App\.minimizeApp/);
});

test('Android shell is bundled, HTTPS-only, and excludes device backups', () => {
  assert.match(config, /appId: 'com\.ourhome\.app'/);
  assert.match(config, /webDir: 'dist'/);
  assert.match(androidManifest, /android:allowBackup="false"/);
  assert.match(androidManifest, /android:usesCleartextTraffic="false"/);
});

test('native releases expose real build info and a resilient user-approved in-app updater', () => {
  assert.match(offline, /Capacitor\.isNativePlatform\(\)/);
  assert.match(offline, /registration => registration\.unregister/);
  assert.match(offline, /name\.startsWith\('ourhome-'\)/);
  assert.doesNotMatch(installSettings, /const APP_VERSION/);
  assert.match(installSettings, /checkForAndroidUpdate/);
  assert.match(installSettings, /installAndroidUpdate/);
  assert.match(installSettings, /更新到最新版/);
  assert.match(installSettings, /断点续传/);
  assert.match(appUpdate, /App\.getInfo\(\)/);
  assert.match(appUpdate, /releases\/latest/);
  assert.match(appUpdate, /latest\.build > Number\(current\?\.build/);
  assert.match(appUpdate, /expectedBytes/);
  assert.match(appUpdate, /apkSha256/);
  assert.match(gradle, /OURHOME_VERSION_CODE/);
  assert.match(gradle, /OURHOME_VERSION_NAME/);
  assert.match(gradle, /\?: "5"/);
  assert.match(gradle, /\?: "1\.0\.4"/);
  assert.match(androidManifest, /android\.permission\.REQUEST_INSTALL_PACKAGES/);
  assert.match(mainActivity, /registerPlugin\(OurHomeUpdaterPlugin\.class\)/);
  assert.match(updaterPlugin, /canRequestPackageInstalls/);
  assert.match(updaterPlugin, /ACTION_MANAGE_UNKNOWN_APP_SOURCES/);
  assert.match(updaterPlugin, /FileProvider\.getUriForFile/);
  assert.match(updaterPlugin, /suwu2004\/ourhome-frontend\/releases\/download/);
  assert.match(updaterPlugin, /MAX_DOWNLOAD_ATTEMPTS/);
  assert.match(updaterPlugin, /OurHome-latest\.apk\.part/);
  assert.match(updaterPlugin, /Range/);
  assert.match(updaterPlugin, /SHA-256/);
  assert.match(androidWorkflow, /contents: write/);
  assert.match(androidWorkflow, /100000 \+ GITHUB_RUN_NUMBER/);
  assert.match(androidWorkflow, /VERSION_NAME="1\.0\.4"/);
  assert.match(androidWorkflow, /gh release create/);
  assert.match(androidWorkflow, /--latest/);
});

test('Android App console exposes guarded one-tap Supabase recovery', () => {
  assert.match(installSettings, /FailoverRecoverySettings/);
  assert.match(failoverRecovery, /failover\/status/);
  assert.match(failoverRecovery, /failover\/replay/);
  assert.match(failoverRecovery, /primary_ready/);
  assert.match(failoverRecovery, /supabase-restored/);
  assert.match(failoverRecovery, /安全回灌/);
  assert.match(failoverRecovery, /pending_objects/);
});

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

test('Chat session switching rejects stale responses and scopes attachments', () => {
  assert.match(appSource, /const targetSessionId = String\(id\)/);
  assert.match(appSource, /String\(sessionIdRef\.current\) !== targetSessionId/);
  assert.match(appSource, /setSessionSummary\(null\)/);
  assert.match(appSource, /loadMessagesFor\(id\)\.catch/);
  assert.match(appSource, /const uploadSessionId = sessionIdRef\.current/);
  assert.match(appSource, /String\(sessionIdRef\.current\) === String\(uploadSessionId\)/);
  assert.match(appSource, /switchSession\(r\.session_id\)/);
  assert.match(appSource, /ourhome_chat_draft:\$\{id\}/);
  assert.match(chatRoomSource, /MAX_CHAT_SESSION_CACHE = 12/);
  assert.match(chatRoomSource, /pendingAttachmentCache/);
  assert.match(chatRoomSource, /setBoundedSessionCache\(conversationCache/);
  assert.match(chatRoomSource, /pendingAttachmentCache\.delete\(String\(sessionId\)\)/);
});

test('expired private backgrounds recover without an upload loop', () => {
  assert.match(themeContext, /X-OurHome-Refresh-Assets/);
  assert.match(themeContext, /ASSET_RECOVERY_COOLDOWN_MS/);
  assert.match(themeContext, /visibilitychange/);
});

test('home shelf uses one DOM observer for all injected room entries', () => {
  assert.equal((root.match(/useHomeShelfTarget\(\)/g) || []).length, 2);
  assert.match(root, /function HomeShelfEntries/);
});

test('vault fallback never presents demo money as real data', () => {
  assert.match(vault, /const EMPTY_DATA/);
  assert.match(vault, /isUntouchedLegacyDemo/);
  assert.doesNotMatch(vault, /name: '午饭'/);
  assert.doesNotMatch(vault, /name: '旅行基金'/);
});
