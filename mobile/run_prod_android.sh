#!/usr/bin/env bash
#
# Mirrors `run_prod_ios.sh` for Android.
#
# Launches the SparkLoop Flutter app against the production backend on an
# Android emulator or a connected USB device. Defaults to Release mode
# (no hot-reload, optimised Dart) and supports a `--debug` override.
#
# Usage:
#   ./run_prod_android.sh                       # Release on first available device
#   ./run_prod_android.sh --debug               # Debug on first available device
#   ./run_prod_android.sh --device-id <ID>      # Target a specific adb device
#   ./run_prod_android.sh --emulator <NAME>     # Boot a named AVD then run
#
# If no Android device is connected, the script boots `flutter_emulator`
# (the default AVD created by Flutter) before launching the app.
set -e

cd "$(dirname "$0")"

MODE="Release"
MODE_FLAG="--release"
DEVICE_ID=""
EMULATOR_ID=""
FLUTTER_ARGS=()

# ----------------------------------------------------------------------
# Argument parsing — collect flags we care about and forward the rest.
# ----------------------------------------------------------------------
i=0
while [ $i -lt $# ]; do
  arg="${1:-}"
  case "$arg" in
    --debug)
      MODE="Debug"
      MODE_FLAG="--debug"
      ;;
    --release)
      MODE="Release"
      MODE_FLAG="--release"
      ;;
    --device-id)
      # Consume the next arg as the device id.
      i=$((i+1))
      DEVICE_ID="${!i:-}"
      ;;
    --device-id=*)
      DEVICE_ID="${arg#*=}"
      ;;
    --emulator)
      i=$((i+1))
      EMULATOR_ID="${!i:-}"
      ;;
    --emulator=*)
      EMULATOR_ID="${arg#*=}"
      ;;
    *)
      FLUTTER_ARGS+=("$arg")
      ;;
  esac
  i=$((i+1))
done

# ----------------------------------------------------------------------
# Resolve adb. Android SDK is normally at $LOCALAPPDATA/Android/Sdk on
# Windows or $HOME/Android/Sdk on macOS/Linux.
# ----------------------------------------------------------------------
ADB=""
if command -v adb >/dev/null 2>&1; then
  ADB="adb"
elif [ -n "$ANDROID_HOME" ] && [ -x "$ANDROID_HOME/platform-tools/adb" ]; then
  ADB="$ANDROID_HOME/platform-tools/adb"
elif [ -n "$ANDROID_SDK_ROOT" ] && [ -x "$ANDROID_SDK_ROOT/platform-tools/adb" ]; then
  ADB="$ANDROID_SDK_ROOT/platform-tools/adb"
elif [ -x "$HOME/Android/Sdk/platform-tools/adb" ]; then
  ADB="$HOME/Android/Sdk/platform-tools/adb"
elif [ -x "$HOME/Library/Android/sdk/platform-tools/adb" ]; then
  ADB="$HOME/Library/Android/sdk/platform-tools/adb"
elif [ -x "$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" ]; then
  ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
fi

if [ -z "$ADB" ]; then
  echo "❌ Could not locate 'adb'. Install the Android SDK or set ANDROID_HOME."
  exit 1
fi

# ----------------------------------------------------------------------
# Pick a device if the caller didn't override.
# ----------------------------------------------------------------------
if [ -z "$DEVICE_ID" ]; then
  # Take the first emulator-* (running) or device-* (USB) entry from
  # `adb devices`. The output format is:
  #   List of devices attached
  #   emulator-5554   device
  #   <serial>        device
  CONNECTED=$("$ADB" devices | awk 'NR>1 && $2=="device" {print $1}' | head -n1)
  if [ -z "$CONNECTED" ]; then
    if [ -n "$EMULATOR_ID" ]; then
      echo "ℹ️  No device connected — booting AVD '$EMULATOR_ID'..."
      flutter emulators --launch "$EMULATOR_ID"
    else
      echo "ℹ️  No device connected — booting default AVD 'flutter_emulator'..."
      flutter emulators --launch flutter_emulator
    fi
    # Wait for adb to see the device (max ~60s).
    for _ in $(seq 1 30); do
      CONNECTED=$("$ADB" devices | awk 'NR>1 && $2=="device" {print $1}' | head -n1)
      if [ -n "$CONNECTED" ]; then break; fi
      sleep 2
    done
  fi
  DEVICE_ID="$CONNECTED"
fi

if [ -z "$DEVICE_ID" ]; then
  echo "❌ No Android device or emulator is available. Plug a phone in with"
  echo "   USB debugging on, or run 'flutter emulators --launch <avd>' first."
  exit 1
fi

echo "=========================================================="
echo "🚀 Running SparkLoop Mobile on Android (Production $MODE)"
echo "   Target Device: $DEVICE_ID"
echo "   Mode:          $MODE"
echo "   API URL:       https://sloopapi.mydev-lab.com/api"
echo "   WebSocket:     wss://sloopws.mydev-lab.com/connection/websocket"
echo "   LiveKit (OCI): ws://92.4.162.183:7880"
echo "=========================================================="

flutter run $MODE_FLAG -d "$DEVICE_ID" \
  --dart-define=API_URL=https://sloopapi.mydev-lab.com/api \
  --dart-define=WS_URL=wss://sloopws.mydev-lab.com/connection/websocket \
  --dart-define=LIVEKIT_URL=ws://92.4.162.183:7880 \
  "${FLUTTER_ARGS[@]}"