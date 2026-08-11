import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { promptAppInstall, subscribeInstallState } from './appInstall.js';
import { checkForAndroidUpdate, installAndroidUpdate } from './appUpdate.js';
import FailoverRecoverySettings from './FailoverRecoverySettings.jsx';
import LocalFirstSettings from './LocalFirstSettings.jsx';
import { useSettingsGroupTarget } from './useSettingsGroupTarget.js';

const BUILD_SHA = String(import.meta.env.VITE_BUILD_SHA || 'local').slice(0, 7);

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

export default function AppInstallSettings({ compact = false }) {
  const [state, setState] = useState({ native: false, installed: false, promptAvailable: false });
  const [notice, setNotice] = useState('');
  const [updateState, setUpdateState] = useState({ checking: false, installing: false, current: null, latest: null, available: false });
  const [updateProgress, setUpdateProgress] = useState(null);
  const dataManagementTarget = useSettingsGroupTarget({
    key: 'data-device-recovery',
    title: '备份与导出',
    position: 'start',
  });

  useEffect(() => subscribeInstallState(setState), []);

  useEffect(() => {
    let active = true;
    if (!state.native) return undefined;
    setUpdateState(current => ({ ...current, checking: true }));
    checkForAndroidUpdate()
      .then(result => {
        if (!active) return;
        setUpdateState(current => ({ ...current, checking: false, current: result.current, latest: result.latest, available: result.available }));
      })
      .catch(() => {
        if (!active) return;
        setUpdateState(current => ({ ...current, checking: false }));
      });
    return () => { active = false; };
  }, [state.native]);

  const install = async () => {
    const result = await promptAppInstall();
    if (result?.outcome === 'accepted') setNotice('已经交给系统安装啦。');
    else if (result?.outcome === 'dismissed') setNotice('先放在这里，想装的时候再点。');
    else setNotice('请打开浏览器菜单，选择“添加到主屏幕”或“安装应用”。');
  };

  const checkUpdate = async () => {
    setNotice('');
    setUpdateState(current => ({ ...current, checking: true }));
    try {
      const result = await checkForAndroidUpdate();
      setUpdateState(current => ({ ...current, checking: false, current: result.current, latest: result.latest, available: result.available }));
      setNotice(result.available ? `发现新版 v${result.latest.version} · build ${result.latest.build}。` : '已经是最新版啦。');
      return result;
    } catch (error) {
      setUpdateState(current => ({ ...current, checking: false }));
      setNotice(error?.message || '暂时没检查到更新，过一会再试。');
      return null;
    }
  };

  const updateNow = async () => {
    let latest = updateState.latest;
    if (!latest?.apkUrl || !updateState.available) {
      const checked = await checkUpdate();
      if (!checked?.available) return;
      latest = checked.latest;
    }
    setUpdateState(current => ({ ...current, installing: true }));
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
  };

  const currentVersion = updateState.current?.version;
  const currentBuild = updateState.current?.build;
  const status = state.native
    ? `Android App${currentVersion ? ` · v${currentVersion}` : ''}${currentBuild ? ` · build ${currentBuild}` : ''} · ${BUILD_SHA}`
    : state.installed ? '已安装到桌面' : '网页版';

  const nativeBusy = updateState.checking || updateState.installing;
  const nativeActionLabel = updateState.installing
    ? updateProgress?.phase === 'verifying'
      ? '校验更新中…'
      : updateProgress?.phase === 'opening-installer'
        ? '准备安装…'
        : '下载更新中…'
    : updateState.checking
      ? '检查中…'
      : updateState.available && updateState.latest
        ? '更新到最新版'
        : '检查更新';

  const maintenancePanel = (
    <div className="app-install-settings app-data-maintenance-settings">
      {state.native && <FailoverRecoverySettings />}
      <LocalFirstSettings />

      <div className="app-device-status" style={{ display: 'grid', gap: 3, marginTop: 12 }}>
        <strong>设备与数据状态</strong>
        <span style={{ fontSize: 10, opacity: .7, lineHeight: 1.45 }}>{status}</span>
      </div>

      {notice && <small role="status" style={{ display: 'block', marginTop: 8 }}>{notice}</small>}

      {updateProgress && updateProgress.phase !== 'error' && (
        <div className="app-update-progress" style={{ marginTop: 10, display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 9.6, lineHeight: 1.4 }}>
            <span style={{ opacity: .76 }}>{updateProgressText(updateProgress)}</span>
            {updateProgress.percent >= 0 && <strong style={{ flexShrink: 0, fontSize: 9.6 }}>{Math.round(updateProgress.percent)}%</strong>}
          </div>
          <div
            role="progressbar"
            aria-label="OurHome 更新下载进度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={updateProgress.percent >= 0 ? Math.round(updateProgress.percent) : undefined}
            style={{ height: 7, overflow: 'hidden', borderRadius: 999, background: 'rgba(196,151,74,.16)', boxShadow: 'inset 0 0 0 1px rgba(196,151,74,.08)' }}
          >
            <div style={{ width: `${Math.max(0, Math.min(100, updateProgress.percent >= 0 ? updateProgress.percent : 0))}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #E7C57A, #C9974A)', transition: 'width .18s ease' }} />
          </div>
        </div>
      )}

      <div className="app-maintenance-update" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(196,151,74,.18)' }}>
        {state.native ? (
          <button type="button" onClick={updateState.available ? updateNow : checkUpdate} disabled={nativeBusy}>{nativeActionLabel}</button>
        ) : state.installed ? null : (
          <button type="button" onClick={install}>{state.promptAvailable ? '安装 OurHome' : '查看安装方法'}</button>
        )}
      </div>
    </div>
  );

  if (compact) {
    return dataManagementTarget ? createPortal(maintenancePanel, dataManagementTarget) : null;
  }

  return maintenancePanel;
}
