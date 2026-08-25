# SparkLoop: Live Audio Streaming Solutions (Rooms <= 50 Users)
## Technical Analysis, Comparison & Implementation Options

---

## Executive Summary

For live voice rooms (Mood Pods) with a maximum capacity of **50 concurrent users**, the typical room dynamic consists of **2 to 6 active speakers on stage** and **40+ passive listeners in the audience**.

Because the vast majority of participants only listen, high-cost enterprise streaming infrastructure is unnecessary. Below are the **3 practical solutions**, ordered by recommended priority.

---

## 🎯 Comparison of the 3 Solutions for <= 50 Users

| Feature | **Option 1: LiveKit SFU** *(Recommended Gold Standard)* | **Option 2: Stage-Mesh Hybrid** *(Zero New Infra)* | **Option 3: WebSocket Chunks** *(Firewall-Proof)* |
| :--- | :--- | :--- | :--- |
| **Additional Infrastructure** | 1 lightweight Docker container | **None** (Uses current setup) | **None** (Uses existing Centrifugo) |
| **Latency** | **< 50 ms** (Ultra-realtime) | **< 60 ms** (Ultra-realtime) | **~250 - 350 ms** (Radio/Podcast style) |
| **Speaker Bandwidth** | **Uploads to 1 server only** | Uploads to 5–6 peers on stage | Uploads 1 chunk stream |
| **Listener Bandwidth** | Downloads active speaker tracks only | Downloads active speaker streams | Downloads audio chunks |
| **NAT / Firewall Traversal**| **99%** (Built-in TURN/ICE) | ~85% (Requires public STUN) | **100%** (Standard WebSocket TCP/WSS) |
| **Echo & Noise Suppression**| **Automatic** (DSP / WebRTC engine) | Browser Default | Manual / None |
| **Mobile Battery Consumption**| **Very Low** (Single upstream/downstream)| Moderate (Multiple peer streams) | **Very Low** |
| **Setup Time** | ~15 minutes | Already in codebase | Already in codebase |

---

## 🥇 Option 1: LiveKit OSS SFU Server *(Recommended & Most Robust)*

LiveKit is a 100% Free & Open-Source (Apache 2.0) WebRTC Selective Forwarding Unit (SFU) written in Go. A single LiveKit instance running on a basic server easily manages **up to 1,000 active audio streams**.

### 1. Add LiveKit to `docker-compose.yml`
```yaml
  livekit:
    image: livekit/livekit-server:latest
    container_name: sparkloop-livekit
    restart: unless-stopped
    command: --dev --bind 0.0.0.0 --port 7880
    ports:
      - "7880:7880"                 # Signaling & HTTP API
      - "7881:7881/tcp"             # WebRTC over TCP fallback
      - "50000-50050:50000-50050/udp" # WebRTC Audio UDP Ports
    environment:
      LIVEKIT_KEYS: "devkey: secret32characterstringproductionkey"
```

### 2. Backend Token Generation (`TokenController.cs`)
Using NuGet package `LiveKit.Server.Sdk.Dotnet`:
```csharp
[HttpGet("pods/{podId}/voice-token")]
public IActionResult GetVoiceToken(string podId, [FromQuery] bool isOnStage)
{
    var user = GetCurrentUser();
    var token = new AccessToken("devkey", "secret32characterstringproductionkey")
        .WithIdentity(user.Username)
        .WithName(user.DisplayName)
        .WithGrants(new VideoGrants {
            RoomJoin = true,
            Room = $"pod-{podId}",
            CanPublish = isOnStage, // True for speakers on stage, False for audience listeners
            CanSubscribe = true
        });

    return Ok(new { token = token.ToJwt() });
}
```

### 3. Frontend Connection (`livekit-client`)
```ts
import { Room, RoomEvent } from 'livekit-client';

const room = new Room({
  adaptiveStream: true,
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
});

// Connect to room
await room.connect('ws://localhost:7880', token);

// If user is promoted to stage, enable microphone:
if (isOnStage) {
  await room.localParticipant.setMicrophoneEnabled(true);
}

// Automatically receive and play speaker tracks:
room.on(RoomEvent.TrackSubscribed, (track) => {
  if (track.kind === 'audio') {
    track.attach(); // Automatically attaches to DOM and plays
  }
});
```

---

## 🥈 Option 2: Stage vs. Audience Mesh *(Zero Server Changes)*

This approach uses browser-native WebRTC peer connections with strict role segregation, already supported in SparkLoop's codebase.

```
┌─────────────────────────────────────────────────────────┐
│              STAGE (Max 6 Active Speakers)              │
│                                                         │
│     Speaker A ◄────────────► Speaker B ◄──────────► C   │
│     (Only 5 peer connections per speaker)               │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼ (Downstream Only)
┌─────────────────────────────────────────────────────────┐
│                 AUDIENCE (44 Listeners)                 │
│  - Receives audio tracks from active speakers on stage  │
│  - Never sends/uploads audio (Zero upload bandwidth)    │
└─────────────────────────────────────────────────────────┘
```

### Key Rules for Success:
1. **Hard Cap on Stage**: Limit the "On Stage" speaker count to **maximum 6 users**.
2. **Audience is Receive-Only**: The remaining 44 users in the room do not create upload tracks.
3. **Bandwidth Footprint**: 6 speakers $\times 32\text{ kbps} \approx 192\text{ kbps}$ download per user, which is negligible even on 3G/4G mobile connections.

---

## 🥉 Option 3: WebSocket Chunk Streaming via Centrifugo *(Firewall-Proof)*

If participants are behind strict enterprise networks or mobile carriers where UDP/WebRTC traffic is blocked:

1. **Speakers on Stage**: Record 250ms Opus chunks via `MediaRecorder`:
   ```ts
   const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
   recorder.ondataavailable = (e) => {
     if (e.data.size > 0) {
       api.publishAudioChunk(podId, e.data);
     }
   };
   recorder.start(250); // Emit chunk every 250ms
   ```
2. **Centrifugo Relay**: Pushes chunks over WebSocket to channel `pod:{podId}:audio`.
3. **Audience Listeners**: Receive chunks, decode via `AudioContext.decodeAudioData()`, and queue playback sequentially.
4. **Latency**: ~250ms–350ms (walkie-talkie / live radio feel).

---

## 🏁 Summary & Recommendation

1. **Best Overall (Production-Ready)**: **Option 1 (LiveKit)**. Adding LiveKit to `docker-compose.yml` provides crystal-clear audio, automatic echo cancellation, and eliminates connection dropouts across different devices.
2. **Immediate / Zero Changes**: **Option 2 (Stage-Mesh)**. Enforce a max limit of 6 speakers on stage in the UI, allowing up to 44 listeners with the existing codebase.
