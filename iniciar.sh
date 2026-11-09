cd ~/IO/goodtire && cat > unico.sh <<'EOF'
#!/usr/bin/env bash
# Uso: ./unico.sh construir | iniciar | detener | logs | estado | respaldar | actualizar
set -e
cd "$(dirname "$0")"
PUERTO="${PUERTO:-8080}"
case "${1:-}" in
  construir) docker build -f Dockerfile.unico -t goodtire:unico . ;;
  iniciar)
    [ -f .env.unico ] || { echo "Falta .env.unico (ver .env.unico.example)"; exit 1; }
    docker rm -f goodtire >/dev/null 2>&1 || true
    docker run -d --name goodtire --restart unless-stopped --env-file .env.unico \
      -e PORT=80 -p "$PUERTO:80" -v goodtire_datos:/var/lib/postgresql/data goodtire:unico
    echo "Abre http://localhost:$PUERTO" ;;
  detener) docker stop goodtire ;;
  logs) docker logs -f --tail 100 goodtire ;;
  estado) docker ps --filter name=goodtire; curl -s -o /dev/null -w "salud: %{http_code}\n" "http://localhost:$PUERTO/api/salud" ;;
  respaldar)
    mkdir -p respaldos
    ARCH="respaldos/goodtire_$(date +%F_%H%M).sql.gz"
    docker exec goodtire sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h "${POSTGRES_HOST:-127.0.0.1}" -U "${POSTGRES_USER:-goodtire}" "${POSTGRES_DB:-goodtire}"' | gzip > "$ARCH"
    [ -s "$ARCH" ] && echo "Respaldo guardado en $ARCH" || { echo "El respaldo falló"; rm -f "$ARCH"; exit 1; } ;;
  actualizar)
    if docker ps -q --filter name=^goodtire$ | grep -q .; then ./unico.sh respaldar; fi
    ./unico.sh construir
    ./unico.sh iniciar
    echo "Esperando que arranque..."; sleep 30
    ./unico.sh estado ;;
  *) echo "Uso: $0 construir|iniciar|detener|logs|estado|respaldar|actualizar"; exit 1 ;;
esac
EOF
chmod +x unico.sh && bash -n unico.sh && echo OK
