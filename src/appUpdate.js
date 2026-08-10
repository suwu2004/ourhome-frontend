import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';

const RELEASE_API = 'https://api.github.com/repos/suwu2004/ourhome-frontend/releases/latest';
const AndroidUpdater = registerPlugin('OurHomeUpdater');

function parseReleaseBuild(tagName) {
  const match = String(tagName || '').match(/^android-v(.+)-b(\d+)$/i);
  if (!match) return null;
  return { version: match[1], build: Number(match[2]) || 0 };
}

function pickReleaseApk(release) {
  return (Array.isArray(release?.assets) ? release.assets : []).find(asset => {
    const name = String(asset?.name || '');
    const url = String(asset?.browser_download_url || '');
    return /^OurHome-.*\.apk$/i.test(name) && /^https:\/\/github\.com\/suwu2004\/ourhome-frontend\/releases\/download\//i.test(url);
  }) || null;
}

function normalizeSha256(value) {
  const match = String(value || '').trim().match(/^sha256:([a-f0-9]{64})$/i);
  return match ? match[1].toLowerCase() : '';
}

export async function getNativeAppInfo() {
  if (!Capacitor.isNativePlatform()) return null;
  const info = await App.getInfo();
  return {
    version: String(info?.version || ''),
    build: Number(info?.build) || 0,
  };
}

export async function checkForAndroidUpdate() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return { supported: false, available: false, current: null, latest: null };
  }

  const current = await getNativeAppInfo();
  const response = await fetch(RELEASE_API, {
    cache: 'no-store',
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) throw new Error(`检查更新失败（${response.status}）`);

  const release = await response.json();
  const parsed = parseReleaseBuild(release?.tag_name);
  const apk = pickReleaseApk(release);
  if (!parsed || !parsed.build || !apk?.browser_download_url) {
    throw new Error('最新版安装包还没有准备好。');
  }

  const latest = {
    version: parsed.version,
    build: parsed.build,
    apkUrl: apk.browser_download_url,
    apkSize: Number(apk.size) || 0,
    apkSha256: normalizeSha256(apk.digest),
    publishedAt: release?.published_at || release?.created_at || null,
  };

  return {
    supported: true,
    available: latest.build > Number(current?.build || 0),
    current,
    latest,
  };
}

export async function installAndroidUpdate(release, onProgress) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return { status: 'unsupported' };
  }
  const latest = typeof release === 'string' ? { apkUrl: release } : (release || {});
  let progressHandle = null;
  try {
    if (typeof onProgress === 'function') {
      progressHandle = await AndroidUpdater.addListener('downloadProgress', event => {
        onProgress({
          phase: String(event?.phase || 'downloading'),
          downloadedBytes: Math.max(0, Number(event?.downloadedBytes) || 0),
          totalBytes: Math.max(0, Number(event?.totalBytes) || 0),
          percent: Number.isFinite(Number(event?.percent)) ? Number(event.percent) : -1,
        });
      });
    }
    return await AndroidUpdater.downloadAndInstall({
      url: latest.apkUrl,
      expectedBytes: Number(latest.apkSize) || 0,
      sha256: normalizeSha256(latest.apkSha256 ? `sha256:${latest.apkSha256}` : ''),
    });
  } finally {
    try { await progressHandle?.remove?.(); } catch { /* progress cleanup must not affect updating */ }
  }
}

export const __appUpdateTest = { normalizeSha256, parseReleaseBuild, pickReleaseApk };