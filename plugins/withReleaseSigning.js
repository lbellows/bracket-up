/**
 * Adds an opt-in `release` signing config to the generated Android project.
 *
 * F-Droid builds this app from source and signs the result with its own key, so
 * the release build must still succeed with no keystore present. This plugin
 * therefore wires signing to a keystore only when one is actually configured,
 * and otherwise leaves the release APK unsigned. It deliberately does NOT fall
 * back to the debug key, so no keystore of any kind needs to be committed.
 *
 * A keystore is configured either by `android/keystore.properties`:
 *
 *   storeFile=/absolute/path/to/bracketup-release.keystore
 *   storePassword=...
 *   keyAlias=bracketup
 *   keyPassword=...
 *
 * or, for CI, by the env vars BRACKETUP_STORE_FILE, BRACKETUP_STORE_PASSWORD,
 * BRACKETUP_KEY_ALIAS and BRACKETUP_KEY_PASSWORD.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const SIGNING_CONFIG = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            // Populated below only when a keystore is actually configured.
        }
    }
    // Resolve the release keystore from android/keystore.properties, falling back
    // to environment variables so CI can sign without writing the file to disk.
    def keystorePropertiesFile = rootProject.file("keystore.properties")
    def releaseStoreFile = System.getenv("BRACKETUP_STORE_FILE")
    def releaseStorePassword = System.getenv("BRACKETUP_STORE_PASSWORD")
    def releaseKeyAlias = System.getenv("BRACKETUP_KEY_ALIAS")
    def releaseKeyPassword = System.getenv("BRACKETUP_KEY_PASSWORD")
    if (keystorePropertiesFile.exists()) {
        def keystoreProperties = new Properties()
        keystorePropertiesFile.withInputStream { keystoreProperties.load(it) }
        releaseStoreFile = keystoreProperties.getProperty("storeFile") ?: releaseStoreFile
        releaseStorePassword = keystoreProperties.getProperty("storePassword") ?: releaseStorePassword
        releaseKeyAlias = keystoreProperties.getProperty("keyAlias") ?: releaseKeyAlias
        releaseKeyPassword = keystoreProperties.getProperty("keyPassword") ?: releaseKeyPassword
    }
    def hasReleaseKeystore = releaseStoreFile != null && !releaseStoreFile.isEmpty() && file(releaseStoreFile).exists()
    if (hasReleaseKeystore) {
        signingConfigs.release {
            storeFile file(releaseStoreFile)
            storePassword releaseStorePassword
            keyAlias releaseKeyAlias
            keyPassword releaseKeyPassword
        }
    }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    const debugOnlySigningConfigs = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;

    if (!contents.includes(debugOnlySigningConfigs)) {
      throw new Error(
        'withReleaseSigning: could not find the expected signingConfigs block in ' +
          'android/app/build.gradle. The Expo template changed — update this plugin.'
      );
    }
    contents = contents.replace(debugOnlySigningConfigs, SIGNING_CONFIG);

    // Point the release build type at the release keystore when there is one.
    const releaseSigningLine = `            signingConfig signingConfigs.debug
            def enableShrinkResources`;
    if (!contents.includes(releaseSigningLine)) {
      throw new Error(
        'withReleaseSigning: could not find the release buildType signingConfig line ' +
          'in android/app/build.gradle. The Expo template changed — update this plugin.'
      );
    }
    // No release keystore => leave the APK unsigned rather than falling back to
    // the debug key. F-Droid builds from source and signs with its own key, so an
    // unsigned artifact is what it wants, and this keeps the debug keystore out of
    // the repository entirely.
    contents = contents.replace(
      releaseSigningLine,
      `            signingConfig hasReleaseKeystore ? signingConfigs.release : null
            def enableShrinkResources`
    );

    cfg.modResults.contents = contents;
    return cfg;
  });
};
