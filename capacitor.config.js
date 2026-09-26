module.exports = {
  appId: 'com.lussaldesign.tokokasirlussal',
  appName: 'TokoKasirLussal',
  webDir: 'mobile/www',
  bundledWebRuntime: false,
  // Android must use the bundled web files produced by build-apk.yml.
  // Do not point Capacitor at GitHub Pages, otherwise APK builds can keep
  // loading an older cached web application instead of the current source.
  android: {
    allowMixedContent: false
  }
};
