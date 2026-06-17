#!/bin/bash
set -e

echo "Starting Next.js on port 3000..."
cd /app/web
bun node_modules/.bin/next start -p 3000 &
NEXT_PID=$!

echo "Starting cron server..."
cd /app/cron-server
NEXTJS_URL="http://localhost:3000" bun src/index.ts &
CRON_PID=$!

# Exit container if either process dies
wait -n $NEXT_PID $CRON_PID
EXIT_CODE=$?
echo "A process exited with code $EXIT_CODE — shutting down"
kill $NEXT_PID $CRON_PID 2>/dev/null || true
exit $EXIT_CODE
