#!/bin/sh
# Lancia i test di durata (logica + browser) fino all'ora indicata (default 18:00) e tiene sveglio il Mac.
# Uso: sh tools/soak-run.sh [HH:MM]      Stop anticipato: sh tools/soak-run.sh stop
cd "$(dirname "$0")/.." || exit 1
mkdir -p soak
if [ "$1" = "stop" ]; then
  [ -f soak/pids ] && xargs kill < soak/pids 2>/dev/null
  pkill -f "http.server 8819" 2>/dev/null
  echo "fermati"; exit 0
fi
UNTIL="${1:-18:00}"
SECS=$(node -e "const [h,m]='$UNTIL'.split(':').map(Number);const d=new Date();d.setHours(h,m,0,0);console.log(Math.max(60,Math.round((d-Date.now())/1000)+120))")
nohup caffeinate -i -t "$SECS" >/dev/null 2>&1 &
echo $! > soak/pids
nohup nice -n 10 node tools/soak.js "$UNTIL" > soak/logic.out 2>&1 &
echo $! >> soak/pids
nohup nice -n 10 node tools/soak-browser.js "$UNTIL" > soak/browser.out 2>&1 &
echo $! >> soak/pids
echo "avviati fino alle $UNTIL (pid: $(tr '\n' ' ' < soak/pids))"
