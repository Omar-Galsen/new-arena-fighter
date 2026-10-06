#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
printf 'Open http://localhost:8000 in your browser. Ctrl+C stops the game server.\n'
if command -v py >/dev/null 2>&1; then
  py -3 -m http.server 8000 --bind 127.0.0.1
elif command -v python3 >/dev/null 2>&1; then
  python3 -m http.server 8000 --bind 127.0.0.1
else
  python -m http.server 8000 --bind 127.0.0.1
fi
