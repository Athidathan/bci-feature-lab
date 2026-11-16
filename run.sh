#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
backend_pid=""

cleanup() {
    if [[ -n "$backend_pid" ]] && kill -0 "$backend_pid" 2>/dev/null; then
        kill "$backend_pid" 2>/dev/null || true
        wait "$backend_pid" 2>/dev/null || true
    fi
}

trap cleanup EXIT INT TERM

command -v python3 >/dev/null 2>&1 || {
    echo "Python 3 is required but was not found." >&2
    exit 1
}
command -v npm >/dev/null 2>&1 || {
    echo "npm is required but was not found." >&2
    exit 1
}
command -v curl >/dev/null 2>&1 || {
    echo "curl is required but was not found." >&2
    exit 1
}

cd "$project_root"
python3 -m pip install -r backend/requirements.txt

(
    cd frontend
    npm install
)

python3 -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 &
backend_pid=$!

ready=false
for _ in {1..30}; do
    if curl --fail --silent --show-error http://127.0.0.1:8000/api/health >/dev/null; then
        ready=true
        break
    fi
    sleep 0.5
done

if [[ "$ready" != true ]]; then
    echo "The EEG backend did not start on port 8000." >&2
    exit 1
fi

cd frontend
npm run dev
