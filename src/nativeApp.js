import { Capacitor } from '@capacitor/core';

export async function initializeNativeApp() {
  if (!Capacitor.isNativePlatform()) return;
  document.documentElement.dataset.nativeApp = 'true';
  const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import('@capacitor/app'), import('@capacitor/status-bar'), import('@capacitor/splash-screen'),
  ]);
  await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
  await StatusBar.setBackgroundColor({ color: '#FFF8F0' }).catch(() => {});
  await StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  const applyStatusBarInset = info => {
    const reportedHeight = Number(info?.height) || 0;
    const inset = info?.overlays ? Math.min(36, Math.max(24, reportedHeight)) : 0;
    document.documentElement.style.setProperty('--ourhome-status-bar-inset', `${inset}px`);
  };
  await StatusBar.getInfo().then(applyStatusBarInset).catch(() => {
    document.documentElement.style.setProperty('--ourhome-status-bar-inset', '24px');
  });
  await StatusBar.addListener('statusBarOverlayChanged', applyStatusBarInset).catch(() => {});
  await SplashScreen.hide({ fadeOutDuration: 260 }).catch(() => {});
  await App.addListener('backButton', () => {
    if (window.location.hash) {
      window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    }
    App.minimizeApp();
  });
}
