import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [manifestText, install, native, styles, finalHeaders, config, androidManifest, themeContext, root, vault, offline, installSettings, gradle, appUpdate, updaterPlugin, mainActivity, androidWorkflow] = await Promise.all([
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

test('native releases expose real build info and a user-approved in-app updater', () => {
  assert.match(offline, /Capacitor\.isNativePlatform\(\)/);
  assert.match(offline, /registration => registration\.unregister/);
  assert.match(offline, /name\.startsWith\('ourhome-'\)/);
  assert.doesNotMatch(installSettings, /const APP_VERSION/);
  assert.match(installSettings, /checkForAndroidUpdate/);
  assert.match(installSettings, /installAndroidUpdate/);
  assert.match(installSettings, /更新到 v/);
  assert.match(appUpdate, /App\.getInfo\(\)/);
  assert.match(appUpdate, /releases\/latest/);
  assert.match(appUpdate, /latest\.build > Number\(current\?\.build/);
  assert.match(gradle, /OURHOME_VERSION_CODE/);
  assert.match(gradle, /OURHOME_VERSION_NAME/);
  assert.match(gradle, /\?: "4"/);
  assert.match(gradle, /\?: "1\.0\.3"/);
  assert.match(androidManifest, /android\.permission\.REQUEST_INSTALL_PACKAGES/);
  assert.match(mainActivity, /registerPlugin\(OurHomeUpdaterPlugin\.class\)/);
  assert.match(updaterPlugin, /canRequestPackageInstalls/);
  assert.match(updaterPlugin, /ACTION_MANAGE_UNKNOWN_APP_SOURCES/);
  assert.match(updaterPlugin, /FileProvider\.getUriForFile/);
  assert.match(updaterPlugin, /suwu2004\/ourhome-frontend\/releases\/download/);
  assert.match(androidWorkflow, /contents: write/);
  assert.match(androidWorkflow, /100000 \+ GITHUB_RUN_NUMBER/);
  assert.match(androidWorkflow, /VERSION_NAME="1\.0\.3"/);
  assert.match(androidWorkflow, /gh release create/);
  assert.match(androidWorkflow, /--latest/);
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
