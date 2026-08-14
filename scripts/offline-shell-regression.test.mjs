import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [worker, registration, main, repair] = await Promise.all([
  readFile(new URL('../public/ourhome-sw.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/offlineShell.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/main.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/webPushRepair.js', import.meta.url), 'utf8'),
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

test('failed service-worker registration is handed back to an authenticated page', () => {
  assert.match(worker, /ourhome-push-repair-needed/);
  assert.match(worker, /requestClientPushRepair/);
  assert.match(repair, /apiFetch\(`\$\{BACKEND\}\/push\/subscribe`/);
  assert.match(repair, /TOKEN_KEY/);
  assert.match(main, /initializeWebPushRepair\(\)/);
});

test('web push self-heal never opens a notification permission prompt by itself', () => {
  assert.match(repair, /Notification\.permission !== 'granted'/);
  assert.match(repair, /pushManager\.getSubscription\(\)/);
  assert.doesNotMatch(repair, /requestPermission/);
});

test('healthy Web Push endpoints are reverified at most once per day', () => {
  assert.match(repair, /VERIFY_INTERVAL_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(repair, /recentlyVerified\(subscription\.endpoint\)/);
});
