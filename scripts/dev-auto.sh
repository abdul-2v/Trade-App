#!/usr/bin/env bash
set -u

cd "$(dirname "$0")/.."

echo "TradeHub auto-dev is starting..."
echo "Keep this Terminal window open while testing in Expo Go."
echo "GitHub main will be checked every 8 seconds."

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
      echo "[auto-sync] New TradeHub update found on GitHub..."
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

npx expo start --tunnel
