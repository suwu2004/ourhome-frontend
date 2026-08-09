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
