#!/bin/zsh
# The daily job for a machine without a server: starts the database if needed,
# runs every store, keeps a log per day (30 days). launchd calls this every
# morning — see "Scheduling the daily job" in README.md.
set -u
cd "${0:A:h}/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

mkdir -p logs
exec >> "logs/daily-$(date +%F).log" 2>&1
echo "== started $(date)"

# Docker Desktop may not be running after a restart.
if ! docker info >/dev/null 2>&1; then
  open -a Docker
  for _ in {1..36}; do docker info >/dev/null 2>&1 && break; sleep 5; done
fi

docker compose up -d --wait && npm run deals:run
echo "== finished $(date) (exit $?)"

find logs -name 'daily-*.log' -mtime +30 -delete
