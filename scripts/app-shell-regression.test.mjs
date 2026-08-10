import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const chatRoomSource = readFileSync(new URL('../src/ChatRoom.jsx', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../src/SettingsRoom.jsx', import.meta.url), 'utf8');
const themeContext = readFileSync(new URL('../src/ThemeContext.jsx', import.meta.url), 'utf8');
const rootSource = readFileSync(new URL('../src/Root.jsx', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8');
const capacitorConfig = readFileSync(new URL('../capacitor.config.ts', import.meta.url), 'utf8');
const androidManifest = readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
const nativeShell = readFileSync(new URL('../src/nativeShell.js', import.meta.url), 'utf8');
const nativeNotifications = readFileSync(new URL('../src/nativeNotifications.js', import.meta.url), 'utf8');
const mainActivity = readFileSync(new URL('../android/app/src/main/java/com/ourhome/app/MainActivity.kt', import.meta.url), 'utf8');
const notificationsPlugin = readFileSync(new URL('../android/app/src/main/java/com/ourhome/app/OurHomeNotificationsPlugin.kt', import.meta.url), 'utf8');
const reminderReceiver = readFileSync(new URL('../android/app/src/main/java/com/ourhome/app/OurHomeReminderReceiver.kt', import.meta.url), 'utf8');
const updatePlugin = readFileSync(new URL('../android/app/src/main/java/com/ourhome/app/OurHomeUpdatePlugin.kt', import.meta.url), 'utf8');
const buildAndroid = readFileSync(new URL('../scripts/build-android.mjs', import.meta.url), 'utf8');
const androidWorkflow = readFileSync(new URL('../.github/workflows/android-apk.yml', import.meta.url), 'utf8');

test('manifest is installable on vivo phones and Huawei tablets', () => {
  const data = JSON.parse(manifest);
  assert.equal(data.display, 'standalone');
  assert.equal(data.start_url, '/');
  assert.ok(data.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(data.icons.some(icon => icon.sizes === '512x512'));
  assert.match(data.name, /OurHome/);
});

test('install prompt is retained until settings asks for it', () => {
  assert.match(rootSource, /beforeinstallprompt/);
  assert.match(rootSource, /ourhome-install-prompt-available/);
  assert.match(settingsSource, /ourhome-install-prompt-available/);
  assert.match(settingsSource, /promptInstall/);
});

test('native shell handles status bar splash and Android back button', () => {
  assert.match(nativeShell, /StatusBar\.setOverlaysWebView/);
  assert.match(nativeShell, /SplashScreen\.hide/);
  assert.match(nativeShell, /backButton/);
  assert.match(rootSource, /setupNativeShell/);
});

test('Android shell is bundled, HTTPS-only, and excludes device backups', () => {
  assert.match(capacitorConfig, /webDir:\s*['"]dist['"]/);
  assert.match(androidManifest, /android:usesCleartextTraffic="false"/);
  assert.match(androidManifest, /android:allowBackup="false"/);
  assert.match(androidManifest, /android:fullBackupContent="false"/);
});

test('native releases expose real build info and a resilient user-approved in-app updater', () => {
  assert.match(updatePlugin, /BuildConfig\.VERSION_NAME/);
  assert.match(updatePlugin, /BuildConfig\.VERSION_CODE/);
  assert.match(updatePlugin, /ACTION_INSTALL_PACKAGE/);
  assert.match(updatePlugin, /FileProvider\.getUriForFile/);
  assert.match(updatePlugin, /MessageDigest\.getInstance\("SHA-256"\)/);
  assert.match(updatePlugin, /setRequestProperty\("Range", "bytes=\$existingLength-"\)/);
  assert.match(updatePlugin, /HTTP_MOVED_PERM/);
  assert.match(updatePlugin, /HTTP_UNAVAILABLE/);
  assert.match(updatePlugin, /MAX_DOWNLOAD_ATTEMPTS/);
  assert.match(updatePlugin, /sha256 mismatch/);
  assert.match(androidManifest, /REQUEST_INSTALL_PACKAGES/);
  assert.match(androidManifest, /FileProvider/);
  assert.match(androidManifest, /ourhome_file_paths/);
  assert.match(buildAndroid, /OurHome-\$\{versionName\}-b\$\{versionCode\}\.apk/);
  assert.match(androidWorkflow, /VERSION_NAME="1\.0\.4"/);
  assert.match(androidWorkflow, /VERSION_CODE=\$\(\(100000 \+ GITHUB_RUN_NUMBER\)\)/);
  assert.match(androidWorkflow, /android-v\$\{VERSION_NAME\}-b\$\{VERSION_CODE\}/);
  assert.match(settingsSource, /当前版本/);
  assert.match(settingsSource, /buildLabel/);
  assert.match(settingsSource, /检查更新/);
  assert.match(settingsSource, /下载并安装/);
  assert.match(settingsSource, /latestBuildNumber > installedBuildNumber/);
  assert.match(settingsSource, /expectedSha256/);
});

test('Android update and Supabase recovery live under data management instead of the console card', () => {
  assert.match(settingsSource, /<DataManagementSettings/);
  assert.match(settingsSource, /<FailoverRecoverySettings/);
  assert.match(settingsSource, /<AppInstallSettings/);
  assert.doesNotMatch(settingsSource, /consoleGrid[\s\S]*<FailoverRecoverySettings/);
});

test('Android notifications use native permission and local alarms while web keeps Web Push', () => {
  assert.match(nativeNotifications, /OurHomeNotifications/);
  assert.match(nativeNotifications, /scheduleEvents/);
  assert.match(mainActivity, /OurHomeNotificationsPlugin/);
  assert.match(androidManifest, /POST_NOTIFICATIONS/);
  assert.match(androidManifest, /SCHEDULE_EXACT_ALARM/);
  assert.match(androidManifest, /OurHomeReminderReceiver/);
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
  assert.match(appSource, /loadMessagesFor\(id, \{ full \}\)\.catch/);
  assert.match(appSource, /const uploadSessionId = sessionIdRef\.current/);
  assert.match(appSource, /String\(sessionIdRef\.current\) === String\(uploadSessionId\)/);
  assert.match(appSource, /switchSession\(r\.session_id, \{ full: true \}\)/);
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
  assert.match(rootSource, /const injectedEntries = \[/);
  const observerCount = (rootSource.match(/new MutationObserver/g) || []).length;
  assert.equal(observerCount, 1);
});

test('vault fallback never presents demo money as real data', () => {
  assert.match(rootSource, /VaultPage/);
  assert.doesNotMatch(rootSource, /demo account|演示余额|假余额/i);
});
