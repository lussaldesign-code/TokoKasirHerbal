import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.herbalinovasi.tokokasir',
  appName: 'TokoKasirHerbal',
  webDir: 'mobile/www',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false
  }
};

export default config;
