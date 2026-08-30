/**
 * Turns R8 on for release builds, and adds the keep rules that need it.
 *
 * Expo's template sets `android.enableMinifyInReleaseBuilds` to false, so the
 * release APK shipped 38 MB of unminified dex — more than the entire 30 MB
 * per-APK budget on its own. R8 shrinks that to a fraction of the size.
 *
 * R8 is not free of risk for React Native: anything looked up reflectively from
 * C++ or by name from JavaScript has to be kept explicitly. React Native and
 * expo-modules-core ship consumer rules that cover themselves, and Expo's
 * template already keeps react-native-reanimated. react-native-worklets ships a
 * rules file too but never wires it up as consumer rules, so those keeps are
 * added here. The release workflow installs the minified APK on an emulator and
 * asserts the app actually renders, so a missing rule fails the build rather
 * than shipping.
 *
 * Resource shrinking is deliberately left off: it would save about a megabyte
 * and adds a second, independent way for a release build to break.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withGradleProperties } = require('expo/config-plugins');

const MINIFY_KEY = 'android.enableMinifyInReleaseBuilds';

const PROGUARD_RULES = `
# react-native-worklets ships these rules in its own package but does not declare
# them as consumer rules, so nothing applies them to this app. Copied verbatim
# from node_modules/react-native-worklets/android/proguard-rules.pro.
-keep class com.swmansion.worklets.** { *; }
-keep class com.facebook.react.fabric.** { *; }
`;

function withMinify(config) {
  return withGradleProperties(config, (cfg) => {
    const existing = cfg.modResults.find(
      (item) => item.type === 'property' && item.key === MINIFY_KEY
    );
    if (existing) {
      existing.value = 'true';
      return cfg;
    }
    cfg.modResults.push({
      type: 'comment',
      value: 'Run R8 over release builds. See plugins/withMinifiedRelease.js.',
    });
    cfg.modResults.push({ type: 'property', key: MINIFY_KEY, value: 'true' });
    return cfg;
  });
}

function withProguardRules(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const rulesPath = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro'
      );
      const contents = fs.readFileSync(rulesPath, 'utf8');
      if (contents.includes('com.swmansion.worklets')) {
        return cfg;
      }
      fs.writeFileSync(rulesPath, `${contents.trimEnd()}\n${PROGUARD_RULES}`);
      return cfg;
    },
  ]);
}

module.exports = function withMinifiedRelease(config) {
  return withProguardRules(withMinify(config));
};
