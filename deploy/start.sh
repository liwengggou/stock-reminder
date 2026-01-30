#!/bin/sh
# Start script for Fly.io deployment
# Runs both nginx (frontend) and Node.js (backend)

# Start Node.js backend in background
node /app/src/index.js &

# Start nginx in foreground
nginx -g 'daemon off;'
