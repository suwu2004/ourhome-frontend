from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


# --- AppInstallSettings.jsx ---
path = Path('src/AppInstallSettings.jsx')
text = path.read_text()
text = replace_once(
    text,
    "const BUILD_SHA = String(import.meta.env.VITE_BUILD_SHA || 'local').slice(0, 7);\n",
    """const BUILD_SHA = String(import.meta.env.VITE_BUILD_SHA || 'local').slice(0, 7);

function formatUpdateBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes >= 1024 ? 1 : 0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function updateProgressText(progress) {
  if (!progress) return '';
  if (progress.phase === 'preparing') return '正在准备安装包…';
  if (progress.phase === 'retrying') return '网络抖了一下，正在从已下载的位置继续…';
  if (progress.phase === 'verifying') return '下载完成 · 正在校验安装包…';
  if (progress.phase === 'ready') return '校验完成 · 正在准备安装…';
  if (progress.phase === 'opening-installer') return '安装包准备完成 · 正在打开系统安装器…';
  if (progress.phase === 'downloading') {
    const size = progress.totalBytes > 0
      ? `${formatUpdateBytes(progress.downloadedBytes)} / ${formatUpdateBytes(progress.totalBytes)}`
      : `${formatUpdateBytes(progress.downloadedBytes)} 已下载`;
    return `${size}${progress.percent >= 0 ? ` · ${progress.percent}%` : ''}`;
  }
  return '正在处理更新…';
}
""",
    'insert progress helpers',
)
text = replace_once(
    text,
    "  const [updateState, setUpdateState] = useState({ checking: false, installing: false, current: null, latest: null, available: false });\n",
    """  const [updateState, setUpdateState] = useState({ checking: false, installing: false, current: null, latest: null, available: false });
  const [updateProgress, setUpdateProgress] = useState(null);
""",
    'add progress state',
)
text = replace_once(
    text,
    """    setUpdateState(current => ({ ...current, installing: true }));
    setNotice('正在下载最新版安装包；网络短暂抖动会自动重试，并支持断点续传。重新点更新也会尽量接着上次继续。');
    try {
      const result = await installAndroidUpdate(latest);
      if (result?.status === 'permission-required') {
        setNotice('请在系统页允许 OurHome 安装更新，回来后再点一次“更新到最新版”。');
      } else if (result?.status === 'installer-opened') {
        setNotice('安装包已经校验完成，按系统提示确认更新就可以啦。');
      } else {
        setNotice('这台设备暂时不能直接安装更新。');
      }
    } catch (error) {
      console.error(error);
      setNotice('这次网络还是没有撑到下载完成。断点续传会尽量保留已经下载的部分；网络稳一点后再点更新会继续尝试。');
    } finally {
      setUpdateState(current => ({ ...current, installing: false }));
    }
""",
    """    setUpdateState(current => ({ ...current, installing: true }));
    setUpdateProgress({
      phase: 'preparing',
      downloadedBytes: 0,
      totalBytes: Number(latest.apkSize) || 0,
      percent: 0,
    });
    setNotice('更新包支持断点续传；下载进度会实时显示在下面。');
    try {
      const result = await installAndroidUpdate(latest, progress => setUpdateProgress(progress));
      if (result?.status === 'permission-required') {
        setUpdateProgress(null);
        setNotice('请在系统页允许 OurHome 安装更新，回来后再点一次“更新到最新版”。');
      } else if (result?.status === 'installer-opened') {
        setUpdateProgress(current => ({
          ...(current || {}),
          phase: 'opening-installer',
          percent: 100,
          downloadedBytes: Number(latest.apkSize) || current?.downloadedBytes || 0,
          totalBytes: Number(latest.apkSize) || current?.totalBytes || 0,
        }));
        setNotice('安装包已经校验完成，按系统提示确认更新就可以啦。');
      } else {
        setUpdateProgress(null);
        setNotice('这台设备暂时不能直接安装更新。');
      }
    } catch (error) {
      console.error(error);
      setUpdateProgress(current => current ? { ...current, phase: 'error' } : null);
      setNotice('这次网络还是没有撑到下载完成。断点续传会尽量保留已经下载的部分；网络稳一点后再点更新会继续尝试。');
    } finally {
      setUpdateState(current => ({ ...current, installing: false }));
    }
""",
    'wire progress callback',
)
text = replace_once(
    text,
    """  const nativeActionLabel = updateState.installing
    ? '下载更新中…'
    : updateState.checking
""",
    """  const nativeActionLabel = updateState.installing
    ? updateProgress?.phase === 'verifying'
      ? '校验更新中…'
      : updateProgress?.phase === 'opening-installer'
        ? '准备安装…'
        : '下载更新中…'
    : updateState.checking
""",
    'phase-aware button label',
)
text = replace_once(
    text,
    """      {notice && <small role=\"status\" style={{ display: 'block', marginTop: 8 }}>{notice}</small>}

      <div className=\"app-maintenance-update\" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(196,151,74,.18)' }}>
""",
    """      {notice && <small role=\"status\" style={{ display: 'block', marginTop: 8 }}>{notice}</small>}

      {updateProgress && updateProgress.phase !== 'error' && (
        <div className=\"app-update-progress\" style={{ marginTop: 10, display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 9.6, lineHeight: 1.4 }}>
            <span style={{ opacity: .76 }}>{updateProgressText(updateProgress)}</span>
            {updateProgress.percent >= 0 && <strong style={{ flexShrink: 0, fontSize: 9.6 }}>{Math.round(updateProgress.percent)}%</strong>}
          </div>
          <div
            role=\"progressbar\"
            aria-label=\"OurHome 更新下载进度\"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={updateProgress.percent >= 0 ? Math.round(updateProgress.percent) : undefined}
            style={{ height: 7, overflow: 'hidden', borderRadius: 999, background: 'rgba(196,151,74,.16)', boxShadow: 'inset 0 0 0 1px rgba(196,151,74,.08)' }}
          >
            <div style={{ width: `${Math.max(0, Math.min(100, updateProgress.percent >= 0 ? updateProgress.percent : 0))}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #E7C57A, #C9974A)', transition: 'width .18s ease' }} />
          </div>
        </div>
      )}

      <div className=\"app-maintenance-update\" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(196,151,74,.18)' }}>
""",
    'render progress bar',
)
path.write_text(text)


# --- appUpdate.js ---
path = Path('src/appUpdate.js')
text = path.read_text()
text = replace_once(
    text,
    """export async function installAndroidUpdate(release) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return { status: 'unsupported' };
  }
  const latest = typeof release === 'string' ? { apkUrl: release } : (release || {});
  return AndroidUpdater.downloadAndInstall({
    url: latest.apkUrl,
    expectedBytes: Number(latest.apkSize) || 0,
    sha256: normalizeSha256(latest.apkSha256 ? `sha256:${latest.apkSha256}` : ''),
  });
}
""",
    """export async function installAndroidUpdate(release, onProgress) {
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
""",
    'subscribe to native progress',
)
path.write_text(text)


# --- OurHomeUpdaterPlugin.java ---
path = Path('android/app/src/main/java/com/ourhome/app/OurHomeUpdaterPlugin.java')
text = path.read_text()
text = replace_once(
    text,
    """    private static final int MAX_DOWNLOAD_ATTEMPTS = 3;
    private static final long MIN_APK_BYTES = 100_000L;
""",
    """    private static final int MAX_DOWNLOAD_ATTEMPTS = 3;
    private static final long MIN_APK_BYTES = 100_000L;
    private static final long PROGRESS_EMIT_STEP_BYTES = 256 * 1024L;
""",
    'add progress throttle',
)
text = replace_once(
    text,
    """                File apkFile = new File(updateDir, \"OurHome-latest.apk\");
                File partialFile = new File(updateDir, \"OurHome-latest.apk.part\");
                downloadApkWithRetry(url, partialFile, apkFile, expectedBytes, sha256);

                Uri apkUri = FileProvider.getUriForFile(
""",
    """                File apkFile = new File(updateDir, \"OurHome-latest.apk\");
                File partialFile = new File(updateDir, \"OurHome-latest.apk.part\");
                emitProgress(\"preparing\", partialFile.exists() ? partialFile.length() : 0L, expectedBytes);
                downloadApkWithRetry(url, partialFile, apkFile, expectedBytes, sha256);
                emitProgress(\"opening-installer\", apkFile.length(), expectedBytes);

                Uri apkUri = FileProvider.getUriForFile(
""",
    'emit lifecycle progress',
)
text = replace_once(
    text,
    """            try {
                downloadApkAttempt(sourceUrl, partialFile, expectedBytes);
                validateApk(partialFile, expectedBytes, sha256);
                replaceDestination(partialFile, destination);
                return;
            } catch (IOException error) {
                lastError = error;
                if (isIntegrityFailure(error)) partialFile.delete();
                if (attempt >= MAX_DOWNLOAD_ATTEMPTS) break;
                try {
                    Thread.sleep(900L * attempt);
""",
    """            try {
                downloadApkAttempt(sourceUrl, partialFile, expectedBytes);
                emitProgress(\"verifying\", partialFile.length(), expectedBytes);
                validateApk(partialFile, expectedBytes, sha256);
                emitProgress(\"ready\", partialFile.length(), expectedBytes);
                replaceDestination(partialFile, destination);
                return;
            } catch (IOException error) {
                lastError = error;
                if (isIntegrityFailure(error)) partialFile.delete();
                if (attempt >= MAX_DOWNLOAD_ATTEMPTS) break;
                emitProgress(\"retrying\", partialFile.exists() ? partialFile.length() : 0L, expectedBytes);
                try {
                    Thread.sleep(900L * attempt);
""",
    'emit retry and verify progress',
)
text = replace_once(
    text,
    """        HttpURLConnection connection = openTrustedConnection(sourceUrl, existingBytes);
        boolean append = existingBytes > 0 && connection.getResponseCode() == HttpURLConnection.HTTP_PARTIAL;
        try (InputStream input = connection.getInputStream();
             FileOutputStream output = new FileOutputStream(destination, append)) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            output.flush();
        } finally {
            connection.disconnect();
        }
""",
    """        HttpURLConnection connection = openTrustedConnection(sourceUrl, existingBytes);
        boolean append = existingBytes > 0 && connection.getResponseCode() == HttpURLConnection.HTTP_PARTIAL;
        long downloadedBytes = append ? existingBytes : 0L;
        long lastEmittedBytes = downloadedBytes;
        emitProgress(\"downloading\", downloadedBytes, expectedBytes);
        try (InputStream input = connection.getInputStream();
             FileOutputStream output = new FileOutputStream(destination, append)) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
                downloadedBytes += read;
                if (downloadedBytes - lastEmittedBytes >= PROGRESS_EMIT_STEP_BYTES
                        || (expectedBytes > 0 && downloadedBytes >= expectedBytes)) {
                    emitProgress(\"downloading\", downloadedBytes, expectedBytes);
                    lastEmittedBytes = downloadedBytes;
                }
            }
            output.flush();
        } finally {
            connection.disconnect();
        }
        if (downloadedBytes != lastEmittedBytes) emitProgress(\"downloading\", downloadedBytes, expectedBytes);
""",
    'emit byte progress while downloading',
)
text = replace_once(
    text,
    """    private String normalizeSha256(String value) {
""",
    """    private void emitProgress(String phase, long downloadedBytes, long totalBytes) {
        final long safeDownloaded = Math.max(0L, downloadedBytes);
        final long safeTotal = Math.max(0L, totalBytes);
        final int percent = safeTotal > 0L
                ? (int) Math.max(0L, Math.min(100L, Math.round((safeDownloaded * 100.0d) / safeTotal)))
                : -1;
        JSObject data = new JSObject();
        data.put(\"phase\", phase);
        data.put(\"downloadedBytes\", safeDownloaded);
        data.put(\"totalBytes\", safeTotal);
        data.put(\"percent\", percent);
        getActivity().runOnUiThread(() -> notifyListeners(\"downloadProgress\", data));
    }

    private String normalizeSha256(String value) {
""",
    'add native progress event helper',
)
path.write_text(text)


# --- regression test ---
path = Path('scripts/app-shell-regression.test.mjs')
text = path.read_text()
text = replace_once(
    text,
    """  assert.match(installSettings, /断点续传/);
  assert.match(appUpdate, /App\\.getInfo\\(\\)/);
""",
    """  assert.match(installSettings, /断点续传/);
  assert.match(installSettings, /role=\\\"progressbar\\\"/);
  assert.match(installSettings, /OurHome 更新下载进度/);
  assert.match(installSettings, /正在校验安装包/);
  assert.match(appUpdate, /App\\.getInfo\\(\\)/);
  assert.match(appUpdate, /addListener\\('downloadProgress'/);
""",
    'assert progress UI and listener',
)
text = replace_once(
    text,
    """  assert.match(updaterPlugin, /SHA-256/);
  assert.match(androidWorkflow, /contents: write/);
""",
    """  assert.match(updaterPlugin, /SHA-256/);
  assert.match(updaterPlugin, /notifyListeners\\(\\\"downloadProgress\\\"/);
  assert.match(updaterPlugin, /PROGRESS_EMIT_STEP_BYTES/);
  assert.match(updaterPlugin, /\\\"verifying\\\"/);
  assert.match(updaterPlugin, /\\\"opening-installer\\\"/);
  assert.match(androidWorkflow, /contents: write/);
""",
    'assert native progress events',
)
path.write_text(text)
