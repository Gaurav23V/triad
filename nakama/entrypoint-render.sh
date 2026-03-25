#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required"
  exit 1
fi

DB_URL="$DATABASE_URL"
case "$DB_URL" in
  postgresql://*) DB_URL="postgres://${DB_URL#postgresql://}" ;;
esac

echo "Running Nakama migrations..."
/nakama/nakama migrate up --database.address "$DB_URL"

SOCKET_PORT="${PORT:-7350}"
echo "Starting Nakama on port ${SOCKET_PORT}"
exec /nakama/nakama \
  --config /nakama/data/local.yml \
  --database.address "$DB_URL" \
  -socket.port "$SOCKET_PORT"
