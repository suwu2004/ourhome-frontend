import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [gradle, appUpdate, installSettings, androidManifest, updaterPlugin, mainActivity, androidWorkflow] = await Promise.all([
  readFile(new URL('../android/app/build.gradle', import.meta.url), 'utf8'),
  readFile(new URL('../src/appUpdate.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/AppInstallSettings.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8'),
  readFile(new URL('../android/app/src/main/java/com/ourhome/app/OurHomeUpdaterPlugin.java', import.meta.url), 'utf8'),
  readFile(new URL('../android/app/src/main/java/com/ourhome/app/MainActivity.java', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/android-apk.yml', import.meta.url), 'utf8'),
]);

test('native releases expose build identity and the current 1.0.5 updater build', () => {
  assert.match(gradle, /OURHOME_VERSION_CODE/);
  assert.match(gradle, /OURHOME_VERSION_NAME/);
  assert.match(gradle, /\?: "5"/);
  assert.match(gradle, /\?: "1\.0\.4"/);
  assert.match(androidWorkflow, /100000 \+ GITHUB_RUN_NUMBER/);
  assert.match(androidWorkflow, /VERSION_NAME="1\.0\.5"/);
  assert.match(androidWorkflow, /gh release create/);
  assert.match(androidWorkflow, /--latest/);
});

test('Android updater compares release build numbers and verifies downloaded APKs', () => {
  assert.match(appUpdate, /App\.getInfo\(\)/);
  assert.match(appUpdate, /releases\/latest/);
  assert.match(appUpdate, /latest\.build > Number\(current\?\.build/);
  assert.match(appUpdate, /expectedBytes/);
  assert.match(appUpdate, /apkSha256/);
  assert.match(installSettings, /checkForAndroidUpdate/);
  assert.match(installSettings, /installAndroidUpdate/);
  assert.match(installSettings, /更新到最新版/);
  assert.match(installSettings, /断点续传/);
});

test('Android updater is registered with the native shell and can request package installs', () => {
  assert.match(androidManifest, /android\.permission\.REQUEST_INSTALL_PACKAGES/);
  assert.match(mainActivity, /registerPlugin\(OurHomeUpdaterPlugin\.class\)/);
  assert.match(updaterPlugin, /canRequestPackageInstalls/);
  assert.match(updaterPlugin, /ACTION_MANAGE_UNKNOWN_APP_SOURCES/);
  assert.match(updaterPlugin, /FileProvider\.getUriForFile/);
  assert.match(updaterPlugin, /MAX_DOWNLOAD_ATTEMPTS/);
  assert.match(updaterPlugin, /Range/);
  assert.match(updaterPlugin, /SHA-256/);
});
