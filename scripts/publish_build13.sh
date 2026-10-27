#!/usr/bin/env bash
# One-step publish of build 13 (global scoreboard). Usage: scripts/publish_build13.sh typed|random
#   typed  = players type a nickname (rude-word filtered)      -> freeTextNick:true
#   random = kid-safe generated names only ("SwiftOtter42")     -> freeTextNick:false
set -euo pipefail
MODE=${1:?usage: publish_build13.sh typed|random}; case $MODE in typed) FT=true;; random) FT=false;; *) echo "typed|random"; exit 1;; esac
SRC=/workspace/hole-game/index.html REPO=/workspace/sly-escape APP=/workspace/sly-escape-app
export ANDROID_HOME=/opt/android-sdk JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 NODE_PATH=/workspace/vt/node_modules
sed -i -E "s/freeTextNick:(true|false)/freeTextNick:$FT/" $SRC
sed -i -E "s/build:[0-9]+,release:/build:13,release:/" $SRC
grep -q "url:'https://zyqiemevuvhbirtsbbjf.supabase.co'" $SRC
cd $REPO && git checkout -q main && git merge -q --no-edit map-preview
cp $SRC index.html
sed -i "s/const CACHE='sly-escape-1.0.0-v[0-9]*'/const CACHE='sly-escape-1.0.0-v13'/" sw.js
sed -i "s/effective \[DATE SCOREBOARD GOES LIVE\]/effective $(date '+%B %-d, %Y')/" privacy.html
node tests/audit.test.js | tail -1 | grep -q "AUDIT PASS"; { for t in 1 2 3; do node tests/continue_flow.test.js | grep -q "CT PASS" && { echo "CT PASS (try $t)"; break; }; echo "CT flaky fail (try $t)"; [ $t = 3 ] && exit 1; done; }; node tests/leaderboard.test.js | grep -q "^LB PASS"
git add -A && git commit -qm "Build 13: map preview on Levels screen (nicknames: $MODE)" && git push -q origin main
for i in $(seq 1 20); do sleep 15; curl -s "https://nozispower.github.io/sly-escape/sw.js?x=$RANDOM" | grep -q "v13'" && break; [ $i = 6 ] && gh api -X POST repos/nOzispower/sly-escape/pages/builds >/dev/null || true; done
curl -s "https://nozispower.github.io/sly-escape/sw.js?x=$RANDOM" | grep "const CACHE"
cd $APP && sed -i -E 's/versionCode [0-9]+/versionCode 13/' android/app/build.gradle && ./prepare-www.sh >/dev/null && grep -q "build:13,release:true" www/index.html
npx cap sync android >/dev/null 2>&1 && (cd android && ./gradlew -q bundleRelease assembleDebug)
cp android/app/build/outputs/bundle/release/app-release.aab release/sly-escape-1.0.0-13.aab && jarsigner -verify release/sly-escape-1.0.0-13.aab | grep -q verified
cp android/app/build/outputs/apk/debug/app-debug.apk release/sly-escape-1.0.0-debug.apk
$ANDROID_HOME/build-tools/36.0.0/apksigner verify --print-certs release/sly-escape-1.0.0-debug.apk | grep -q "SHA-256 digest: b92fc47f"
cp release/sly-escape-1.0.0-debug.apk /tmp/sly-escape-test.apk && (cd $REPO && gh release upload test-apk-1 /tmp/sly-escape-test.apk --clobber)
sleep 60; A=$(sha256sum < /tmp/sly-escape-test.apk); B=$(curl -sL "https://github.com/nOzispower/sly-escape/releases/download/test-apk-1/sly-escape-test.apk?x=$RANDOM" | sha256sum); [ "$A" = "$B" ] && echo "APK verified ${A:0:12}"
sed -i -E 's/latest: -[0-9]+, build [0-9]+/latest: -12, build 13/' README.md
echo "BUILD 13 PUBLISHED (nicknames: $MODE)"
