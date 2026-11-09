#!/bin/sh
# Espera la base de datos, aplica migraciones y levanta el backend (solo visible desde dentro del contenedor).
set -e
cd "${GOODTIRE_RAIZ:-/srv}/backend"
for i in $(seq 1 60); do
  pg_isready -q -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" && break
  [ "$i" = 60 ] && { echo "[backend] La base de datos no respondió a tiempo."; exit 1; }
  sleep 1
done
python manage.py migrate --noinput
exec gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers "${GUNICORN_WORKERS:-2}" --timeout 300 --access-logfile -
