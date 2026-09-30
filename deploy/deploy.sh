#!/bin/sh
# Деплой на сервере приложения: git pull → сборка образа → перезапуск → проверка здоровья.
#   sh /opt/smena/deploy/deploy.sh
set -e

APP_DIR="${APP_DIR:-/opt/smena}"
cd "$APP_DIR"

git fetch -q origin main
git reset -q --hard origin/main
echo "Commit: $(git log --oneline -1)"

docker compose build
docker compose up -d

for i in $(seq 1 40); do
  if curl -sf http://127.0.0.1:3000/api/health >/dev/null; then
    echo "OK: health check passed"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 3
done

echo "ERROR: health check failed" >&2
docker logs --tail 50 smena-crm >&2
exit 1
