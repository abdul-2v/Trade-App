#!/usr/bin/env bash
set -u

cd "$(dirname "$0")/.."

echo "Tradarr auto-dev is starting..."
echo "Keep this Terminal window open while testing in Expo Go."
echo "Using Expo Go on the local Wi-Fi by default for a simple direct QR and fast refresh."
echo "Both Mac and iPhone must be on the same Wi-Fi for the default mode."
echo "If your network blocks LAN traffic, use npm run dev:auto:tunnel."
echo "GitHub main will be checked every 8 seconds."
echo "A physical iPhone must have Expo Go logged in to the same Expo account as this Mac."

git fetch origin main >/dev/null 2>&1 || true
git pull --ff-only origin main || true
npm install

(
  while true; do
    sleep 8

    if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
      echo "[auto-sync] Local tracked changes detected; skipping pull to avoid overwriting them."
      continue
    fi

    git fetch origin main >/dev/null 2>&1 || continue

    LOCAL="$(git rev-parse HEAD)"
    REMOTE="$(git rev-parse origin/main)"

    if [ "$LOCAL" != "$REMOTE" ]; then
      echo "[auto-sync] New Tradarr update found on GitHub..."
      BEFORE_PKG="$(git rev-parse HEAD:package.json 2>/dev/null || true)"

      if git pull --ff-only origin main; then
        AFTER_PKG="$(git rev-parse HEAD:package.json 2>/dev/null || true)"
        if [ "$BEFORE_PKG" != "$AFTER_PKG" ]; then
          echo "[auto-sync] Dependencies changed. Running npm install..."
          npm install
        fi
        echo "[auto-sync] Updated. Expo Go should Fast Refresh automatically."
      fi
    fi
  done
) &

PULL_PID=$!
trap 'kill "$PULL_PID" 2>/dev/null || true' EXIT INT TERM

# A local exp:// address is usually more reliable for phone camera scans than
# the hosted /_expo/loading chooser page seen with SDK 58+ and tunnel.
# Keep a named tunnel fallback for guest Wi-Fi or restrictive routers.
if [ "${TRADARR_EXPO_CONNECTION:-lan}" = "tunnel" ]; then
  echo "[auto-dev] Starting fallback Expo Go tunnel."
  npx expo start --tunnel --go
else
  echo "[auto-dev] Starting direct Wi-Fi Expo Go."
  npx expo start --lan --go
fi
