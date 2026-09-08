#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

DEVICE_ID="00008120-001A70510A90C01E"
MODE_FLAG="--release"

if [[ "$*" == *"--debug"* ]]; then
  MODE_FLAG=""
fi

echo "=========================================================="
echo "🚀 Running SparkLoop Mobile on iPhone (Production $MODE_FLAG)"
echo "   Target Device: $DEVICE_ID (Amgad's iPhone)"
echo "   API URL:       https://sloopapi.mydev-lab.com/api"
echo "   WebSocket:     wss://sloopws.mydev-lab.com/connection/websocket"
echo "   LiveKit (OCI): ws://92.4.162.183:7880"
echo "=========================================================="

flutter run $MODE_FLAG -d "$DEVICE_ID" \
  --dart-define=API_URL=https://sloopapi.mydev-lab.com/api \
  --dart-define=WS_URL=wss://sloopws.mydev-lab.com/connection/websocket \
  --dart-define=LIVEKIT_URL=ws://92.4.162.183:7880 \
  "$@"
