import { useEffect, useState } from 'react';
import { promptAppInstall, subscribeInstallState } from './appInstall.js';

export default function AppInstallSettings({ compact = false }) {
  const [state, setState] = useState({ native: false, installed: false, promptAvailable: false });
  const [notice, setNotice] = useState('');
  useEffect(() => subscribeInstallState(setState), []);

  const install = async () => {
    const result = await promptAppInstall();
    if (result?.outcome === 'accepted') setNotice('已经交给系统安装啦。');
    else if (result?.outcome === 'dismissed') setNotice('先放在这里，想装的时候再点。');
    else setNotice('请打开浏览器菜单，选择“添加到主屏幕”或“安装应用”。');
  };

  const status = state.native ? 'Android App · v1.0.0' : state.installed ? '已安装到桌面' : '网页版';
  if (compact) {
    return (
      <div className="app-device-summary">
        <span>当前形态：{status}</span>
        {!state.native && !state.installed && (
          <button type="button" onClick={install}>{state.promptAvailable ? '安装' : '安装方法'}</button>
        )}
        {notice && <small role="status">{notice}</small>}
      </div>
    );
  }
  return (
    <div className="app-install-settings">
      <div><strong>当前形态</strong><span>{status}</span></div>
      {state.native ? <p>现在运行在 OurHome 的 Android 外壳里，返回键、状态栏和启动屏由手机接管。</p>
        : state.installed ? <p>已经可以像普通 App 一样从桌面打开，更新仍会自动跟随我们的家。</p>
          : <><p>vivo 手机与华为平板都可以先安装桌面版；进入后没有浏览器地址栏。</p><button type="button" onClick={install}>{state.promptAvailable ? '安装 OurHome' : '查看安装方法'}</button></>}
      {notice && <small role="status">{notice}</small>}
    </div>
  );
}
