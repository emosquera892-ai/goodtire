#!/usr/bin/env bash
# Arranque del contenedor único: prepara la base de datos interna (si hace falta),
# genera la configuración de nginx y de supervisor y deja todo corriendo.
set -euo pipefail

: "${DJANGO_SECRET_KEY:?Falta DJANGO_SECRET_KEY (clave secreta de Django)}"
PUERTO="${PORT:-80}"
export POSTGRES_DB="${POSTGRES_DB:-goodtire}" POSTGRES_USER="${POSTGRES_USER:-goodtire}"
RAIZ="${GOODTIRE_RAIZ:-/srv}"
PGDATA="${PGDATA:-/var/lib/postgresql/data}"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
CONF_SUP="${SUPERVISOR_CONF:-/etc/supervisor/goodtire.conf}"
CONF_NGINX="${NGINX_CONF:-/etc/nginx/conf.d/default.conf}"

if [ -z "${POSTGRES_HOST:-}" ]; then
  INTERNA=1
  : "${POSTGRES_PASSWORD:?Falta POSTGRES_PASSWORD (clave de la base de datos interna)}"
  export POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=5432
  mkdir -p "$PGDATA"
  chown postgres:postgres "$PGDATA"
  chmod 700 "$PGDATA"
  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    echo "[unico] Primera vez: creando la base de datos interna..."
    runuser -u postgres -- "$PGBIN/initdb" -D "$PGDATA" -E UTF8 --locale=C.UTF-8 --auth-local=trust --auth-host=scram-sha-256 >/dev/null
    runuser -u postgres -- "$PGBIN/pg_ctl" -D "$PGDATA" -w -s -o "-c listen_addresses=127.0.0.1 -c unix_socket_directories=/tmp" start
    runuser -u postgres -- "$PGBIN/psql" -h /tmp -v ON_ERROR_STOP=1 -v usr="$POSTGRES_USER" -v pw="$POSTGRES_PASSWORD" -v db="$POSTGRES_DB" postgres >/dev/null <<'SQL'
CREATE ROLE :"usr" LOGIN PASSWORD :'pw';
CREATE DATABASE :"db" OWNER :"usr";
SQL
    runuser -u postgres -- "$PGBIN/pg_ctl" -D "$PGDATA" -m fast -w -s stop
  fi
else
  INTERNA=0
  export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
  echo "[unico] Usando la base de datos externa en $POSTGRES_HOST:$POSTGRES_PORT"
fi

mkdir -p "$(dirname "$CONF_NGINX")" "$(dirname "$CONF_SUP")"
cat > "$CONF_NGINX" <<NGINX
map \$http_x_forwarded_proto \$proto {
    default \$http_x_forwarded_proto;
    ""      \$scheme;
}

server {
    listen ${PUERTO};
    client_max_body_size 2m;
    proxy_read_timeout 300s;
    access_log /dev/stdout;

    proxy_set_header Host \$http_host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$proto;

    location ~ ^/(api|admin|static)/ {
        proxy_pass http://127.0.0.1:8000;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
    }
}
NGINX
rm -f /etc/nginx/sites-enabled/default

REG='stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
redirect_stderr=true
autorestart=true'
{
  cat <<SUP
[supervisord]
nodaemon=true
user=root
logfile=/dev/null
logfile_maxbytes=0
pidfile=/tmp/supervisord.pid

SUP
  if [ "$INTERNA" = 1 ]; then
    cat <<SUP
[program:postgres]
command=$PGBIN/postgres -D $PGDATA -c listen_addresses=127.0.0.1
user=postgres
priority=10
$REG

SUP
  fi
  cat <<SUP
[program:backend]
command=$RAIZ/arranque-backend.sh
user=app
priority=20
startsecs=5
$REG

[program:frontend]
command=node $RAIZ/frontend/node_modules/next/dist/bin/next start -p 3000 -H 127.0.0.1
directory=$RAIZ/frontend
user=app
environment=NODE_ENV="production",NEXT_TELEMETRY_DISABLED="1",HOME="/home/app"
priority=30
startsecs=5
$REG

[program:nginx]
command=nginx -g "daemon off; error_log /dev/stderr warn;"
priority=40
$REG
SUP
} > "$CONF_SUP"

echo "[unico] Listo. Atendiendo en el puerto ${PUERTO}."
exec supervisord -c "$CONF_SUP"
