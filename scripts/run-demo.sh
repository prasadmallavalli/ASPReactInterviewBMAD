#!/usr/bin/env bash
# Builds the SPA into the API's wwwroot, starts the API (same-origin, per
# Program.cs), and opens a free Cloudflare quick tunnel so it's reachable at
# a public HTTPS URL -- for sharing a live demo link ahead of/during an
# interview. No Azure/cloud account needed. Re-run this any time; each run
# gets a new random trycloudflare.com URL (Cloudflare's quick tunnels don't
# support a stable/reserved name without a paid domain in your account).
#
# Prereqs: docker compose (for SQL Server), dotnet, npm, cloudflared
# (https://github.com/cloudflare/cloudflared -- installed at
# ~/.local/bin/cloudflared if you don't have Homebrew).

set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Starting local SQL Server (docker compose)..."
docker compose up -d

echo "==> Building the React SPA..."
(cd client && npm run build)

echo "==> Copying the build into src/Api/wwwroot..."
rm -rf src/Api/wwwroot
mkdir -p src/Api/wwwroot
cp -r client/dist/. src/Api/wwwroot/
touch src/Api/wwwroot/.gitkeep

echo "==> Starting the API (https://localhost:7197)..."
lsof -ti:7197 | xargs -r kill -9 2>/dev/null || true
(dotnet run --project src/Api --launch-profile https > /tmp/aspfullstackbmad-api.log 2>&1 &)

echo "==> Waiting for the API to come up..."
for i in $(seq 1 20); do
  if curl -sk -o /dev/null https://localhost:7197/; then
    break
  fi
  sleep 1
done

echo "==> Starting the Cloudflare quick tunnel..."
echo "    (log: /tmp/aspfullstackbmad-tunnel.log)"
nohup cloudflared tunnel --url https://localhost:7197 --no-tls-verify \
  > /tmp/aspfullstackbmad-tunnel.log 2>&1 &

echo "==> Waiting for the public URL..."
for i in $(seq 1 15); do
  URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' /tmp/aspfullstackbmad-tunnel.log | head -1 || true)
  if [ -n "$URL" ]; then
    echo ""
    echo "=================================================================="
    echo "  Live demo URL: $URL"
    echo "=================================================================="
    echo ""
    exit 0
  fi
  sleep 1
done

echo "Tunnel URL not found after 15s -- check /tmp/aspfullstackbmad-tunnel.log"
exit 1
