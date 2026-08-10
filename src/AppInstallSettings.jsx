import { useEffect, useState } from 'react';
import { promptAppInstall, subscribeInstallState } from './appInstall.js';
import { checkForAndroidUpdate, installAndroidUpdate } from './appUpdate.js';

const BUILD_SHA = String(import.meta.env.VITE_BUILD_SHA || 'local').slice(0, 7);

export default function AppInstallSettings({ compact = false }) {
  const [state, setState] = useState({ native: false, installed: false, promptAvailable: false });
  const [notice, setNotice] = useState('');
  const [updateState, setUpdateState] = useState({ checking: false, current: null, latest: null, available: false });

  useEffect(() => subscribeInstallState(setState), []);

  useEffect(() => {
    let active = true;
    if (!state.native) return undefined;
    setUpdateState(current => ({ ...current, checking: true }));
    checkForAndroidUpdate()
      .then(result => {
        if (!active) return;
        setUpdateState({ checking: false, current: result.current, latest: result.latest, available: result.available });
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
      setUpdateState({ checking: false, current: result.current, latest: result.latest, available: result.available });
      setNotice(result.available ? `发现新版本 v${result.latest.version}。` : '已经是最新版啦。');
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
    setNotice('正在准备最新版安装包…');
    try {
      const result = await installAndroidUpdate(latest.apkUrl);
      if (result?.status === 'permission-required') {
        setNotice('请在系统页允许 OurHome 安装更新，回来后再点一次“更新到最新版”。');
      } else if (result?.status === 'installer-opened') {
        setNotice('安装包已经准备好，按系统提示确认更新就可以啦。');
      } else {
        setNotice('这台设备暂时不能直接安装更新。');
      }
    } catch {
      setNotice('更新包下载失败了，网络恢复后再点一次就好。');
    }
  };

  const currentVersion = updateState.current?.version;
  const currentBuild = updateState.current?.build;
  const status = state.native
    ? `Android App${currentVersion ? ` · v${currentVersion}` : ''}${currentBuild ? ` · build ${currentBuild}` : ''} · ${BUILD_SHA}`
    : state.installed ? '已安装到桌面' : '网页版';

  const nativeActionLabel = updateState.checking
    ? '检查中…'
    : updateState.available && updateState.latest
      ? `更新到 v${updateState.latest.version}`
      : '检查更新';

  if (compact) {
    return (
      <div className="app-device-summary">
        <span>当前形态：{status}</span>
        {state.native ? (
          <button type="button" onClick={updateState.available ? updateNow : checkUpdate} disabled={updateState.checking}>{nativeActionLabel}</button>
        ) : !state.installed && (
          <button type="button" onClick={install}>{state.promptAvailable ? '安装' : '安装方法'}</button>
        )}
        {notice && <small role="status">{notice}</small>}
      </div>
    );
  }

  return (
    <div className="app-install-settings">
      <div><strong>当前形态</strong><span>{status}</span></div>
      {state.native ? (
        <>
          <p>现在运行在 OurHome 的 Android 外壳里。以后有新版，可以直接从这里检查并交给系统更新，不用再去翻 GitHub Actions。</p>
          <button type="button" onClick={updateState.available ? updateNow : checkUpdate} disabled={updateState.checking}>{nativeActionLabel}</button>
        </>
      ) : state.installed ? <p>已经可以像普通 App 一样从桌面打开，更新仍会自动跟随我们的家。</p>
        : <><p>vivo 手机与华为平板都可以先安装桌面版；进入后没有浏览器地址栏。</p><button type="button" onClick={install}>{state.promptAvailable ? '安装 OurHome' : '查看安装方法'}</button></>}
      {notice && <small role="status">{notice}</small>}
    </div>
  );
}
