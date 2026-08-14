import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const nativeBridge = readFileSync(new URL('../src/nativeNotifications.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const rootSource = readFileSync(new URL('../src/Root.jsx', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../src/SettingsRoom.jsx', import.meta.url), 'utf8');
const offlineShellSource = readFileSync(new URL('../src/offlineShell.js', import.meta.url), 'utf8');
const offlineWorkerSource = readFileSync(new URL('../public/ourhome-sw.js', import.meta.url), 'utf8');
const legacyPushWorkerSource = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const pluginSource = readFileSync(new URL('../android/app/src/main/java/com/ourhome/app/OurHomeNotificationsPlugin.java', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../android/app/src/main/java/com/ourhome/app/OurHomeFirebaseMessagingService.java', import.meta.url), 'utf8');
const activitySource = readFileSync(new URL('../android/app/src/main/java/com/ourhome/app/MainActivity.java', import.meta.url), 'utf8');
const manifestSource = readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
const appGradle = readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8');
const variablesGradle = readFileSync(new URL('../android/variables.gradle', import.meta.url), 'utf8');
const workflowSource = readFileSync(new URL('../.github/workflows/android-apk.yml', import.meta.url), 'utf8');
const gitignoreSource = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');

test('Android native notification bridge registers a private FCM device token without a shared topic', () => {
  assert.match(pluginSource, /FirebaseMessaging\.getInstance\(\)\.getToken\(\)/);
  assert.match(pluginSource, /PREF_REMOTE_TOKEN/);
  assert.match(pluginSource, /registerRemotePush\(PluginCall call\)/);
  assert.doesNotMatch(pluginSource, /subscribeToTopic/);
  assert.match(pluginSource, /FirebaseApp\.initializeApp/);
  assert.match(nativeBridge, /registerNativeRemotePush/);
  assert.match(nativeBridge, /getNativeRemotePushStatus/);
  assert.match(nativeBridge, /listenNativeRemotePushTokens/);
});

test('native FCM service receives data messages and routes notification taps back into OurHome', () => {
  assert.match(serviceSource, /extends FirebaseMessagingService/);
  assert.match(serviceSource, /onNewToken\(String token\)/);
  assert.match(serviceSource, /rememberRemoteToken\(this, token\)/);
  assert.match(serviceSource, /onMessageReceived\(RemoteMessage message\)/);
  assert.match(serviceSource, /EXTRA_PUSH_ROUTE/);
  assert.match(manifestSource, /com\.google\.firebase\.MESSAGING_EVENT/);
  assert.match(activitySource, /handleRemoteIntent\(getIntent\(\)\)/);
  assert.match(activitySource, /onNewIntent\(Intent intent\)/);
  assert.match(rootSource, /listenNativeRemotePushActions/);
  assert.match(rootSource, /consumeNativeRemotePushRoute/);
});

test('notification settings register the private FCM token with OurHome backend after permission is granted', () => {
  assert.match(appSource, /await registerNativeRemotePush\(\)/);
  assert.match(appSource, /\/push\/native\/register/);
  assert.match(appSource, /nativeRemotePushStatus\.configured && nativeRemotePushStatus\.enabled/);
  assert.match(settingsSource, /native-fcm/);
  assert.match(settingsSource, /FCM 远程主动通知已经接通/);
});

test('granted Android notification permission repairs a missing FCM token silently', () => {
  assert.match(nativeBridge, /permission !== 'granted'/);
  assert.match(nativeBridge, /NativeNotifications\.registerRemotePush\(\)/);
  assert.match(nativeBridge, /FCM token repair failed/);
  assert.match(nativeBridge, /listenNativeRemotePushActions/);
  assert.match(nativeBridge, /listenNativeRemotePushTokens/);
});

test('web offline shell and push notifications use one compatible service worker', () => {
  assert.match(offlineShellSource, /register\('\/ourhome-sw\.js'/);
  assert.match(offlineWorkerSource, /addEventListener\('push'/);
  assert.match(offlineWorkerSource, /showNotification/);
  assert.match(offlineWorkerSource, /notificationclick/);
  assert.match(offlineWorkerSource, /pushsubscriptionchange/);
  assert.match(offlineWorkerSource, /\/api\/push\/subscribe/);
  assert.match(legacyPushWorkerSource, /importScripts\('\/ourhome-sw\.js'\)/);
  assert.doesNotMatch(legacyPushWorkerSource, /addEventListener\('push'/);
});

test('Android build is FCM-capable but stays build-safe without Firebase secrets', () => {
  assert.match(variablesGradle, /firebaseMessagingVersion = '25\.0\.1'/);
  assert.match(appGradle, /firebase-messaging:\$firebaseMessagingVersion/);
  assert.match(workflowSource, /OURHOME_FIREBASE_GOOGLE_SERVICES_JSON_BASE64/);
  assert.match(workflowSource, /google-services\.json/);
  assert.match(gitignoreSource, /android\/app\/google-services\.json/);
});
