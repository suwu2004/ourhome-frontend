import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [manifestText, install, native, styles, finalHeaders, config, androidManifest, themeContext, root, vault, offline, installSettings, gradle] = await Promise.all([
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

test('native releases clear web-only caches and expose a distinguishable build', () => {
  assert.match(offline, /Capacitor\.isNativePlatform\(\)/);
  assert.match(offline, /registration => registration\.unregister/);
  assert.match(offline, /name\.startsWith\('ourhome-'\)/);
  assert.match(installSettings, /APP_VERSION = '1\.0\.2'/);
  assert.match(installSettings, /VITE_BUILD_SHA/);
  assert.match(gradle, /versionCode 3/);
  assert.match(gradle, /versionName "1\.0\.2"/);
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
