#!/bin/bash
cd "$(dirname "$0")" || exit 1
source venv/bin/activate

echo "=== PostgreSQL ==="
docker compose up -d --wait db || exit 1

echo "=== Backend (http://127.0.0.1:8001) ==="
(cd backend && python manage.py migrate --noinput && exec python manage.py runserver 8001) &

# Al pulsar Ctrl+C se detiene todo
trap 'trap - EXIT INT TERM; kill 0' EXIT INT TERM

echo "=== Frontend (http://localhost:3100) ==="
cd frontend && npm run dev
