#!/usr/bin/env bash
# Uso: ./unico.sh construir | iniciar | detener | logs | estado
set -e
cd "$(dirname "$0")"
case "${1:-}" in
  construir) docker build -f Dockerfile.unico -t goodtire:unico . ;;
  iniciar)
    [ -f .env.unico ] || { echo "Falta .env.unico (ver .env.unico.example)"; exit 1; }
    docker rm -f goodtire >/dev/null 2>&1 || true
    docker run -d --name goodtire --restart unless-stopped --env-file .env.unico \
      -e PORT=80 -p "${PUERTO:-8080}:80" -v goodtire_datos:/var/lib/postgresql/data goodtire:unico
    echo "Abre http://localhost:${PUERTO:-8080}" ;;
  detener) docker stop goodtire ;;
  logs) docker logs -f --tail 100 goodtire ;;
  estado) docker ps --filter name=goodtire; curl -s -o /dev/null -w "salud: %{http_code}\n" "http://localhost:${PUERTO:-8080}/api/salud" ;;
  *) echo "Uso: $0 construir|iniciar|detener|logs|estado"; exit 1 ;;
esac
