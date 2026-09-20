<#
.SYNOPSIS
    Mirrors `run_prod_android.sh` for Windows (PowerShell).

.DESCRIPTION
    Launches the SparkLoop Flutter app against the production backend on an
    Android emulator or a connected USB device. Defaults to Release mode
    (no hot-reload, optimised Dart) and supports a --debug override.

.PARAMETER DebugMode
    Run in Debug mode (with hot-reload). Default is Release.

.PARAMETER ReleaseMode
    Explicitly select Release mode (the default).

.PARAMETER DeviceId
    Target a specific adb device id (serial or emulator-<port>).

.PARAMETER Emulator
    Boot a named AVD then run (used when no device is connected).

.EXAMPLE
    .\run_prod_android.ps1
.EXAMPLE
    .\run_prod_android.ps1 -DebugMode
.EXAMPLE
    .\run_prod_android.ps1 -DebugMode --debug     # bash-style flag also works
.EXAMPLE
    .\run_prod_android.ps1 -DeviceId emulator-5554
.EXAMPLE
    .\run_prod_android.ps1 -Emulator Pixel_API_34
#>

[CmdletBinding()]
param(
    [switch]$DebugMode,
    [switch]$ReleaseMode,
    [string]$DeviceId = "",
    [string]$Emulator = ""
)

# `set -e` equivalent -- fail fast on any uncaught error.
$ErrorActionPreference = 'Stop'

# `cd "$(dirname "$0")"` equivalent -- run relative to this script.
Set-Location -LiteralPath $PSScriptRoot

# ----------------------------------------------------------------------
# Argument parsing -- collect flags we care about and forward the rest.
# Mirrors the bash `while [ $i -lt $# ]` loop in run_prod_android.sh.
# ----------------------------------------------------------------------
$mode = "Release"
$modeFlag = "--release"
$flutterArgs = @()
$posArgs = @()

# Accept either PowerShell-native switches (-Debug, --debug) or the
# bash-style --flag <value> pairs. We do two passes:
#   1. Identify any `--device-id` / `--emulator` flag positions.
#   2. Build the final mode + forwarded-args list.
for ($i = 0; $i -lt $args.Count; $i++) {
    $a = [string]$args[$i]
    switch -Regex ($a) {
        '^--debug$' {
            $mode = "Debug"; $modeFlag = "--debug"; continue
        }
        '^--release$' {
            $mode = "Release"; $modeFlag = "--release"; continue
        }
        '^--device-id$' {
            if ($i + 1 -lt $args.Count) { $DeviceId = [string]$args[$i + 1]; $i++ }
            continue
        }
        '^--device-id=(.+)$' {
            $DeviceId = $Matches[1]; continue
        }
        '^--emulator$' {
            if ($i + 1 -lt $args.Count) { $Emulator = [string]$args[$i + 1]; $i++ }
            continue
        }
        '^--emulator=(.+)$' {
            $Emulator = $Matches[1]; continue
        }
        default {
            $posArgs += $a
        }
    }
}

# PowerShell named parameters (or `--debug` from the loop above) win.
# (Use $DebugMode/$ReleaseMode -- bare $Debug/$Release are reserved common
# parameter names in advanced functions and would clash on declaration.)
if ($DebugMode)   { $mode = "Debug";   $modeFlag = "--debug" }
if ($ReleaseMode) { $mode = "Release"; $modeFlag = "--release" }

# Anything that wasn't a recognised switch is forwarded to `flutter run`
# verbatim (e.g. --no-hot, --verbose, --no-pub).
$flutterArgs = $posArgs
# ----------------------------------------------------------------------
# Resolve adb. Mirrors the bash `command -v adb` / $ANDROID_HOME /
# $ANDROID_SDK_ROOT / $HOME / $LOCALAPPDATA fallback chain, adapted
# for Windows path conventions.
# ----------------------------------------------------------------------
function Resolve-Adb {
    $cmd = Get-Command adb -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidates = @()
    if ($env:ANDROID_HOME)     { $candidates += (Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe') }
    if ($env:ANDROID_SDK_ROOT) { $candidates += (Join-Path $env:ANDROID_SDK_ROOT 'platform-tools\adb.exe') }
    if ($env:USERPROFILE)      { $candidates += (Join-Path (Join-Path $env:USERPROFILE 'Android') 'Sdk\platform-tools\adb.exe') }
    if ($env:LOCALAPPDATA)     { $candidates += (Join-Path (Join-Path $env:LOCALAPPDATA 'Android') 'Sdk\platform-tools\adb.exe') }
    foreach ($p in $candidates) {
        if ($p -and (Test-Path -LiteralPath $p)) { return $p }
    }
    return $null
}

$adb = Resolve-Adb
if (-not $adb) {
    Write-Host "[ERR] Could not locate 'adb'. Install the Android SDK or set ANDROID_HOME." -ForegroundColor Red
    exit 1
}

# ----------------------------------------------------------------------
# Pick a device if the caller didn't override. Mirrors the bash
# `adb devices | awk 'NR>1 && $2=="device" {print $1}'` filter.
# ----------------------------------------------------------------------
function Get-FirstAdbDevice {
    param([Parameter(Mandatory)][string]$AdbExe)
    $lines = & $AdbExe devices
    foreach ($line in $lines) {
        if ($line -match '^(emulator-\d+|[A-Za-z0-9._:-]+)\s+device\s*$') {
            return $Matches[1]
        }
    }
    return $null
}

if (-not $DeviceId) {
    $connected = Get-FirstAdbDevice -AdbExe $adb
    if (-not $connected) {
        if ($Emulator) {
            Write-Host "[INFO] No device connected -- booting AVD '$Emulator'..."
            flutter emulators --launch $Emulator
        } else {
            Write-Host "[INFO] No device connected -- booting default AVD 'flutter_emulator'..."
            flutter emulators --launch flutter_emulator
        }
        # Wait for adb to see the device (max ~60s).
        for ($i = 0; $i -lt 30; $i++) {
            $connected = Get-FirstAdbDevice -AdbExe $adb
            if ($connected) { break }
            Start-Sleep -Seconds 2
        }
    }
    $DeviceId = $connected
}

if (-not $DeviceId) {
    Write-Host "[ERR] No Android device or emulator is available. Plug a phone in with" -ForegroundColor Red
    Write-Host "   USB debugging on, or run 'flutter emulators --launch <avd>' first." -ForegroundColor Red
    exit 1
}

Write-Host "=========================================================="
Write-Host "[RUN] Running SparkLoop Mobile on Android (Production $mode)"
Write-Host "   Target Device: $DeviceId"
Write-Host "   Mode:          $mode"
Write-Host "   API URL:       https://sloopapi.mydev-lab.com/api"
Write-Host "   WebSocket:     wss://sloopws.mydev-lab.com/connection/websocket"
Write-Host "   LiveKit (OCI): ws://92.4.162.183:7880"
Write-Host "=========================================================="

# Build the final flutter invocation with the same dart-define values the
# bash script passes. Extra forwarded args are appended verbatim.
& flutter run $modeFlag -d $DeviceId `
    --dart-define=API_URL=https://sloopapi.mydev-lab.com/api `
    --dart-define=WS_URL=wss://sloopws.mydev-lab.com/connection/websocket `
    --dart-define=LIVEKIT_URL=ws://92.4.162.183:7880 `
    @flutterArgs

