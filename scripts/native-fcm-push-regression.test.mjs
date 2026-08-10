import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const nativeBridge = readFileSync(new URL('../src/nativeNotifications.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const rootSource = readFileSync(new URL('../src/Root.jsx', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../src/SettingsRoom.jsx', import.meta.url), 'utf8');
const pluginSource = readFileSync(new URL('../android/app/src/main/java/com/ourhome/app/OurHomeNotificationsPlugin.java', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../android/app/src/main/java/com/ourhome/app/OurHomeFirebaseMessagingService.java', import.meta.url), 'utf8');
const activitySource = readFileSync(new URL('../android/app/src/main/java/com/ourhome/app/MainActivity.java', import.meta.url), 'utf8');
const manifestSource = readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
const appGradle = readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8');
const variablesGradle = readFileSync(new URL('../android/variables.gradle', import.meta.url), 'utf8');
const workflowSource = readFileSync(new URL('../.github/workflows/android-apk.yml', import.meta.url), 'utf8');
const gitignoreSource = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');

test('Android native notification bridge owns FCM topic registration without a second Capacitor push plugin', () => {
  assert.match(pluginSource, /REMOTE_TOPIC = "ourhome-owner"/);
  assert.match(pluginSource, /registerRemotePush\(PluginCall call\)/);
  assert.match(pluginSource, /unsubscribeFromTopic\(REMOTE_TOPIC\)/);
  assert.match(pluginSource, /FirebaseApp\.initializeApp/);
  assert.match(nativeBridge, /registerNativeRemotePush/);
  assert.match(nativeBridge, /getNativeRemotePushStatus/);
});

test('native FCM service receives data messages and routes notification taps back into OurHome', () => {
  assert.match(serviceSource, /extends FirebaseMessagingService/);
  assert.match(serviceSource, /onMessageReceived\(RemoteMessage message\)/);
  assert.match(serviceSource, /EXTRA_PUSH_ROUTE/);
  assert.match(manifestSource, /com\.google\.firebase\.MESSAGING_EVENT/);
  assert.match(activitySource, /handleRemoteIntent\(getIntent\(\)\)/);
  assert.match(activitySource, /onNewIntent\(Intent intent\)/);
  assert.match(rootSource, /listenNativeRemotePushActions/);
  assert.match(rootSource, /consumeNativeRemotePushRoute/);
});

test('notification settings register FCM after Android notification permission is granted', () => {
  assert.match(appSource, /await registerNativeRemotePush\(\)/);
  assert.match(appSource, /nativeRemotePushStatus\.configured && nativeRemotePushStatus\.enabled/);
  assert.match(settingsSource, /native-fcm/);
  assert.match(settingsSource, /FCM 远程主动通知已经接通/);
});

test('Android build is FCM-capable but stays build-safe without Firebase secrets', () => {
  assert.match(variablesGradle, /firebaseMessagingVersion = '25\.0\.1'/);
  assert.match(appGradle, /firebase-messaging:\$firebaseMessagingVersion/);
  assert.match(workflowSource, /OURHOME_FIREBASE_GOOGLE_SERVICES_JSON_BASE64/);
  assert.match(workflowSource, /google-services\.json/);
  assert.match(gitignoreSource, /android\/app\/google-services\.json/);
});
