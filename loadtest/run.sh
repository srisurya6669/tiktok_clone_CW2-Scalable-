#!/usr/bin/env bash
# Load test for the autoscaler demo. Logs in once (the auth endpoints are rate limited),
# then hammers the video feed with the token.
#   ./loadtest/run.sh                    # 100 connections for 120 s
#   CONNECTIONS=200 DURATION=180 ./loadtest/run.sh
set -euo pipefail

URL="${URL:-https://scaletok.polandcentral.cloudapp.azure.com}"
CONNECTIONS="${CONNECTIONS:-100}"
DURATION="${DURATION:-120}"
EMAIL="${LOAD_EMAIL:-loadtest@example.com}"
PASSWORD="${LOAD_PASSWORD:-LoadTest#12345}"

body() { printf '{"name":"loadtest","email":"%s","password":"%s"}' "$EMAIL" "$PASSWORD"; }
post() { curl -s -X POST -H 'Content-Type: application/json' -d "$(body)" "$URL/api/auth/$1"; }
token() { python3 -c 'import json,sys; print(json.load(sys.stdin).get("token",""))'; }

TOKEN=$(post login | token)
[ -n "$TOKEN" ] || TOKEN=$(post register | token)
[ -n "$TOKEN" ] || { echo "Could not log in or register the load-test user" >&2; exit 1; }

echo "Load testing $URL/api/videos with $CONNECTIONS connections for ${DURATION}s"
echo "In another terminal run: kubectl -n scaletok get hpa -w"
npx --yes autocannon -c "$CONNECTIONS" -d "$DURATION" \
  -H "Authorization: Bearer $TOKEN" "$URL/api/videos?limit=20"
