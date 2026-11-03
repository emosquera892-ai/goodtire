#!/bin/bash
cd "$(dirname "$0")" || exit 1
source venv/bin/activate
docker compose up -d --wait db
cd backend
python manage.py migrate --noinput
python manage.py runserver 8001
