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
  const androidMajor = (() => {
    if (Capacitor.getPlatform() !== 'android') return 0;
    const match = navigator.userAgent.match(/Android\s+(\d+)/i);
    return Number(match?.[1]) || 0;
  })();
  const applyStatusBarInset = info => {
    const reportedHeight = Number(info?.height) || 0;
    // Android 15+ enforces edge-to-edge for this target SDK even when the
    // legacy plugin flag still reports overlays=false.  Treat that platform
    // behavior as authoritative and keep older Android/Huawei layouts on the
    // plugin-reported path.
    const edgeToEdge = Boolean(info?.overlays) || androidMajor >= 15;
    const inset = edgeToEdge ? Math.min(40, Math.max(24, reportedHeight)) : 0;
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
