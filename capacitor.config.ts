import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ourhome.app',
  appName: 'OurHome',
  webDir: 'dist',
  backgroundColor: '#FFF8F0',
  android: { backgroundColor: '#FFF8F0', allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, launchAutoHide: false, backgroundColor: '#FFF8F0', showSpinner: false },
    StatusBar: { overlaysWebView: false, backgroundColor: '#FFF8F0', style: 'LIGHT' },
  },
};

export default config;
