#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

# Default to the currently booted iPhone 17 Pro Max simulator.
# Override by passing a UDID as the first argument, e.g.:
#   ./debug_prod_ios_simulator.sh <SIMULATOR_UDID>
DEFAULT_SIM_UDID="AA4041A7-3D05-43CB-AC86-F55ED05B10B7"

DEVICE_ID="${1:-$DEFAULT_SIM_UDID}"

# Try to detect the simulator name for the log banner.
SIM_NAME=$(xcrun simctl list devices | grep -F "$DEVICE_ID" | head -n1 | sed -E 's/^[[:space:]]+//; s/[[:space:]]+\([A-F0-9-]{36}\).*//')
SIM_NAME="${SIM_NAME:-iPhone Simulator}"

echo "=========================================================="
echo "🐞 Debugging SparkLoop Mobile on iOS Simulator (Prod API)"
echo "   Target Device: $DEVICE_ID ($SIM_NAME)"
echo "   Mode:          Debug (Hot Reload & DevTools enabled)"
echo "   API URL:       https://sloopapi.mydev-lab.com/api"
echo "   WebSocket:     wss://sloopws.mydev-lab.com/connection/websocket"
echo "   LiveKit (OCI): ws://92.4.162.183:7880"
echo "=========================================================="

flutter run --debug -d "$DEVICE_ID" \
  --dart-define=API_URL=https://sloopapi.mydev-lab.com/api \
  --dart-define=WS_URL=wss://sloopws.mydev-lab.com/connection/websocket \
  --dart-define=LIVEKIT_URL=ws://92.4.162.183:7880 \
  "${@:2}"