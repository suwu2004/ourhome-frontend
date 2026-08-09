import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [manifestText, install, native, config, androidManifest] = await Promise.all([
  readFile(new URL('../public/manifest.json', import.meta.url), 'utf8'),
  readFile(new URL('../src/appInstall.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/nativeApp.js', import.meta.url), 'utf8'),
  readFile(new URL('../capacitor.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8'),
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
