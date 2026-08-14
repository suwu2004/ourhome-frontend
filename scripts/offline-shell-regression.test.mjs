import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [worker, registration, main] = await Promise.all([
  readFile(new URL('../public/ourhome-sw.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/offlineShell.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/main.jsx', import.meta.url), 'utf8'),
]);

test('offline shell registers one unified static service worker', () => {
  assert.match(registration, /serviceWorker\.register\('\/ourhome-sw\.js'/);
  assert.match(main, /registerOfflineShell\(\)/);
});

test('service worker never caches API or private cloud data', () => {
  assert.match(worker, /url\.pathname === '\/api'/);
  assert.match(worker, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.doesNotMatch(worker, /home-memos|messages|settings|milestones/);
});

test('offline shell caches navigation and built static assets only', () => {
  assert.match(worker, /request\.mode === 'navigate'/);
  assert.match(worker, /pathname\.startsWith\('\/assets\/'\)/);
  assert.match(worker, /caches\.match\('\/'\)/);
  assert.match(worker, /url\.origin !== self\.location\.origin/);
});

test('offline updates prune obsolete bundles and wait for the user before activation', () => {
  assert.match(worker, /CACHE_NAME = `\$\{CACHE_PREFIX\}v3`/);
  assert.match(worker, /pruneOldBuiltAssets/);
  assert.match(worker, /SKIP_WAITING/);
  assert.doesNotMatch(worker, /await self\.skipWaiting\(\)/);
  assert.match(registration, /ourhome-update-ready/);
  assert.match(main, /OfflineUpdateNotice/);
});

test('the same offline worker also owns proactive Web Push delivery', () => {
  assert.match(worker, /addEventListener\('push'/);
  assert.match(worker, /showNotification/);
  assert.match(worker, /pushsubscriptionchange/);
  assert.match(worker, /\/api\/push\/subscribe/);
});
