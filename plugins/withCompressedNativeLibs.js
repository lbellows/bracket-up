/**
 * Stores the native libraries compressed inside the APK.
 *
 * Modern Android practice is the opposite — `expo.useLegacyPackaging=false`
 * leaves the .so files uncompressed so they can be mapped straight out of the
 * APK, which saves device storage and install time. But uncompressed is exactly
 * what it says: arm64-v8a's libraries are 19.3 MB in the APK, and with them the
 * arm64 APK measured 32.2 MB — over the 30 MB per-APK ceiling CI enforces,
 * which is a limit on the download, not on install size. Compressing them brings the
 * download to roughly 22 MB and leaves room for the app to grow.
 *
 * The cost is real and worth knowing: the libraries are extracted at install
 * time, so the app occupies more space on the device than the download suggests,
 * and installs are a little slower. For an app people download over the
 * network, the smaller download is the better trade.
 *
 * If the app ever ships to Google Play as an app bundle, revisit this: Play
 * splits per ABI itself and prefers uncompressed libraries.
 */
const { withGradleProperties } = require('expo/config-plugins');

const LEGACY_PACKAGING_KEY = 'expo.useLegacyPackaging';

module.exports = function withCompressedNativeLibs(config) {
  return withGradleProperties(config, (cfg) => {
    const property = cfg.modResults.find(
      (item) => item.type === 'property' && item.key === LEGACY_PACKAGING_KEY
    );
    if (!property) {
      throw new Error(
        `withCompressedNativeLibs: ${LEGACY_PACKAGING_KEY} is not in ` +
          'android/gradle.properties. The Expo template changed — update this plugin.'
      );
    }
    property.value = 'true';
    return cfg;
  });
};
