#!/usr/bin/env bash
# Guards the two things that silently break a release:
#   1. android/ drifting out of sync with app.json (the committed native project
#      is what CI compiles, so it must match the config)
#   2. a missing changelog for the current versionCode (an F-Droid repo names
#      changelog files after the versionCode, so a mismatch just yields an empty
#      changelog)
set -euo pipefail
cd "$(dirname "$0")/.."

fail=0

echo "==> Regenerating android/ from app.json"
npx expo prebuild --platform android --no-install --clean >/dev/null

if [ -n "$(git status --porcelain -- android)" ]; then
  echo "ERROR: android/ is out of sync with app.json."
  echo "       Run 'npm run prebuild' and commit the result."
  git status --porcelain -- android
  git --no-pager diff --stat -- android
  fail=1
else
  echo "    android/ matches app.json"
fi

VERSION_CODE=$(node -p "require('./app.json').expo.android.versionCode")
VERSION_NAME=$(node -p "require('./app.json').expo.version")
CHANGELOG_DIR=fastlane/metadata/android/en-US/changelogs
CHANGELOG="${CHANGELOG_DIR}/${VERSION_CODE}.txt"

echo "==> Checking changelogs for versionCode ${VERSION_CODE} (v${VERSION_NAME})"
if [ ! -s "$CHANGELOG" ]; then
  echo "ERROR: ${CHANGELOG} is missing or empty."
  echo "       The F-Droid repo reads release notes from that path."
  fail=1
else
  echo "    ${CHANGELOG} present"

  # The build produces one APK per ABI, each with its own versionCode, and each
  # store looks the changelog up by the versionCode of the APK it is serving.
  for offset in $(node -p "Object.values(require('./plugins/withAbiSplits.js').ABI_VERSION_CODE_OFFSETS).join(' ')"); do
    abi_changelog="${CHANGELOG_DIR}/$((VERSION_CODE * 10 + offset)).txt"
    if ! cmp -s "$CHANGELOG" "$abi_changelog"; then
      echo "ERROR: ${abi_changelog} is missing or differs from ${CHANGELOG}."
      echo "       Run 'npm run changelogs' to copy it to every per-ABI versionCode."
      fail=1
    else
      echo "    ${abi_changelog} matches"
    fi
  done
fi

exit $fail
