#!/bin/bash
# Starts everything for the smoke test in ONE window: the local Worker (port 8790) and the production-built site (port 5173).
# Ctrl+C stops both. Nothing paid happens here: the paid session only starts when you press the start button in the browser.
cd "$(dirname "$0")/.." || exit 1
WR="${WRANGLER_BIN:-npx wrangler@4.160.1}"
for p in 8790 5173; do
  if lsof -nP -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1; then
    echo "포트 $p 를 이미 다른 프로그램이 쓰고 있습니다. Terminal 앱을 완전히 종료(Cmd+Q)한 뒤 다시 열어 이 명령을 다시 실행해 주세요."
    exit 1
  fi
done
if [ ! -f server/tryon-worker/.dev.vars ]; then echo ".dev.vars 가 없습니다. node scripts/rt-smoke-setup.mjs 를 먼저 실행해 주세요."; exit 1; fi
if [ ! -d dist ]; then echo "dist 폴더가 없습니다. VITE_TRYON_API_URL=http://localhost:8790 npm run build 를 먼저 실행해 주세요."; exit 1; fi
LOG=/tmp/lagi-worker.log
: > "$LOG"
( cd server/tryon-worker && exec $WR dev --local --port 8790 >"$LOG" 2>&1 ) &
WPID=$!
cleanup() { kill "$WPID" 2>/dev/null; pkill -P "$WPID" 2>/dev/null; pkill -f "port 8790" 2>/dev/null; echo; echo "Worker 와 사이트를 모두 껐습니다."; }
trap cleanup EXIT INT TERM
echo "Worker 를 켜는 중입니다 (1~2분 걸릴 수 있습니다)..."
for i in $(seq 1 180); do
  grep -q "Ready on" "$LOG" 2>/dev/null && break
  if ! kill -0 "$WPID" 2>/dev/null; then echo "Worker 가 켜지지 못했습니다. 아래 마지막 글자를 캡처해 주세요:"; tail -15 "$LOG"; exit 1; fi
  sleep 1
done
grep -q "Ready on" "$LOG" || { echo "Worker 가 제 시간에 켜지지 않았습니다."; tail -15 "$LOG"; exit 1; }
echo "Worker 준비 완료 (8790)."
echo "사이트를 켭니다. 아래에 Local: http://localhost:5173/ 이 나오면 준비 완료입니다."
echo "이 창은 시험이 끝날 때까지 닫지 마세요. 끝낼 때는 Ctrl+C 를 누르세요."
npx vite preview --port 5173 --strictPort
