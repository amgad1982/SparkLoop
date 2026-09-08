#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

DEVICE_ID="${1:-00008120-001A70510A90C01E}"

echo "=========================================================="
echo "🚀 Running SparkLoop Mobile on iPhone (Production Mode)"
echo "   Target Device: $DEVICE_ID (Amgad's iPhone)"
echo "   API URL:       https://sloopapi.mydev-lab.com/api"
echo "   WebSocket:     wss://sloopws.mydev-lab.com/connection/websocket"
echo "   LiveKit:       wss://slooplive.mydev-lab.com"
echo "=========================================================="

flutter run -d "$DEVICE_ID" \
  --dart-define=API_URL=https://sloopapi.mydev-lab.com/api \
  --dart-define=WS_URL=wss://sloopws.mydev-lab.com/connection/websocket \
  --dart-define=LIVEKIT_URL=wss://slooplive.mydev-lab.com \
  "${@:2}"
