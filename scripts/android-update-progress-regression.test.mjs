import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [settings, appUpdate, updater] = await Promise.all([
  readFile(new URL('../src/AppInstallSettings.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/appUpdate.js', import.meta.url), 'utf8'),
  readFile(new URL('../android/app/src/main/java/com/ourhome/app/OurHomeUpdaterPlugin.java', import.meta.url), 'utf8'),
]);

test('Android updater exposes a real byte-backed progress bar', () => {
  assert.match(settings, /role="progressbar"/);
  assert.match(settings, /OurHome 更新下载进度/);
  assert.match(settings, /formatUpdateBytes/);
  assert.match(settings, /正在校验安装包/);
  assert.match(settings, /progress => setUpdateProgress\(progress\)/);
});

test('Capacitor bridge subscribes to native download progress only for the active install', () => {
  assert.match(appUpdate, /addListener\('downloadProgress'/);
  assert.match(appUpdate, /downloadedBytes/);
  assert.match(appUpdate, /totalBytes/);
  assert.match(appUpdate, /progressHandle\?\.remove/);
});

test('native updater emits throttled download, verify, retry and installer phases', () => {
  assert.match(updater, /PROGRESS_EMIT_STEP_BYTES/);
  assert.match(updater, /notifyListeners\("downloadProgress"/);
  assert.match(updater, /emitProgress\("downloading"/);
  assert.match(updater, /emitProgress\("retrying"/);
  assert.match(updater, /emitProgress\("verifying"/);
  assert.match(updater, /emitProgress\("opening-installer"/);
});
