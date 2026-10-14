#!/bin/bash
cd "$(dirname "$0")" || exit 1
source venv/bin/activate
uvicorn main:app --reload --port 8001
