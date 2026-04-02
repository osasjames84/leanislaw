#!/bin/bash
# Free stuck Metro ports, use full Xcode (fixes simctl 72 in some shells), then start Expo.
set -e
cd "$(dirname "$0")"

export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"

for port in 8081 8082 8083 8084; do
  pids=$(lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Freeing port $port (was busy)…"
    kill -9 $pids 2>/dev/null || true
  fi
done

sleep 0.7
unset CI
exec npx expo start "$@"
