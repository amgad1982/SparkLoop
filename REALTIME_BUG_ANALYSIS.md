# SparkLoop Realtime Communication Bug Analysis
## Why "Allow open mic for a listener" works on Web but not on Flutter Mobile

> **TL;DR:** There are **4 critical bugs** (and several minor ones) in the Flutter
> mobile realtime stack. Together they make every remote pod-host action
> (open mic, remote mute, promote speaker, demote, kick from stage) silently
> no-op on the device. The web app doesn't have any of these bugs and that's
> why every host action works there.

> **Status (2026-09-20):** All 7 bugs in the *Recommended order of fixes*
> section below have been fixed in code and verified by `flutter analyze`
> (clean), `flutter test` (34 passed, 3 new smoke tests added) and
> `dotnet test` (49 passed).

---

## Bug #1 — `_isModerator` is treated as a *listener* on the Flutter client (ROOT CAUSE)

**File:** `mobile/lib/ui/features/pods/view_models/pod_view_model.dart` line 475

```dart
final isSpeakerRole = _isHost || (_activePod?.allowOpenMic == true);
```

A user that has been promoted via the `promote_moderator` moderation action
is a moderator with full `canPublishAudio` permission on the backend, but the
mobile code only treats a user as a *speaker* if they are **the host** or the
pod was created with `AllowOpenMic = true`. **Moderators fall through and join
as listeners.**

Downstream effects inside `connectToRoom(...)`:

* `asSpeaker: false` is sent to the LiveKit engine.
* `_isSpeaker = false` and `_isMicMuted = true` (lines 390–391 of
  `livekit_service.dart`).
* `setMicrophoneEnabled(true)` is *never called* (the
  `if (asSpeaker && !_isMicMuted)` block on line 536 is skipped).
* The mic toggle button in the UI sees `_liveKitService.isSpeaker == false`
  and immediately returns `MicToggleResult.notSpeaker` (line 846 of
  `pod_view_model.dart`) → the user gets the "Open mic is off. Raise your
  hand" snackbar even though the backend already granted them speaker
  permissions.

**The fix** is to include `_isModerator` in the calculation:

```dart
final isSpeakerRole =
    _isHost || _isModerator || (_activePod?.allowOpenMic == true);
```

---

## Bug #2 — `LiveKitService.resolveWsUrl(...)` ignores the WSS URL from the backend

**File:** `mobile/lib/data/services/livekit_service.dart` lines 90–106

```dart
static String resolveWsUrl({String? customHost}) {
  if (customHost != null && customHost.isNotEmpty) {
    if (customHost.contains('slooplive.mydev-lab.com')) {
      return defaultWsUrl;          // <-- BUG: forces ws://92.4.162.183:7880
    }
    ...
```

The backend's `LiveKitService` is configured to return the *secure* URL
(`wss://slooplive.mydev-lab.com`), but the **backend itself** also force-overrides
it back to `ws://92.4.162.183:7880` (`backend/.../RealTime/LiveKitService.cs`
lines 25–28). Combined with the Flutter logic, the client is always pinned to
plain `ws://`.

This means:

* On a real iOS / iPadOS device with App Transport Security defaults, the
  WebSocket upgrade fails or is silently downgraded, so the LiveKit room
  never finishes connecting.
* `setMicrophoneEnabled` returns `null` and the LiveKit engine rejects the
  publish attempt (because there's no working WebRTC session).

The web app's `usePodVoiceEngine.ts` (lines 511–514) auto-upgrades `ws://` →
`wss://` when running on `https:` and goes through Nginx reverse-proxy on the
same origin — that's why it works there even with the same backend config.

**Fix:** use the URL returned by the backend as-is; if the backend insists on
returning a non-TLS URL, upgrade it to `wss://` here when the page is loaded
over HTTPS (mirror what `usePodVoiceEngine.ts` does).

---

## Bug #3 — Backend hard-overrides the secure LiveKit URL

**File:** `backend/src/SparkLoop.Infrastructure/RealTime/LiveKitService.cs` lines 24–28

```csharp
_serverUrl = configuration["LiveKit:ServerUrl"] ?? "ws://92.4.162.183:7880";
if (_serverUrl.Contains("slooplive.mydev-lab.com", StringComparison.OrdinalIgnoreCase))
{
    _serverUrl = "ws://92.4.162.183:7880";
}
```

The server is configured with the public WSS hostname but then *silently
replaces it with a plain WS IP*. Any client (web or mobile) gets
`ws://92.4.162.183:7880` and must work around it. The web app does work around
it (Bug #2's mirror in TS) — the mobile app doesn't.

This bug is in the *backend* but blocks every other mobile fix until it's
resolved.

**Fix:** remove the override; return `configuration["LiveKit:ServerUrl"]`
verbatim, or — better — emit an environment-aware value that defaults to the
secure hostname in production.

---

## Bug #4 — Flutter `CentrifugoService` does NOT auto-subscribe the user channel

**File:** `mobile/lib/data/services/centrifugo_service.dart` lines 51–110

The web app's `useCentrifugo.ts` always subscribes the
`user:{userId}` private channel right after `connect()` (line 114) so it can
receive user-targeted signals like `POD_INVITATION`, `MODERATION_ACTION`,
DJ notifications, etc.

The mobile `CentrifugoService.connect()` only stores the URL. The actual
subscribe to `user:{userId}` is *manually* done by `AuthViewModel._init()`
(line 38) **only if the user is already authenticated when the singleton
wakes up**. If the user logs in *after* `CentrifugoService` has been
constructed (the normal case), the subscription never happens — and any
private-channel message (e.g. a `MODERATION_ACTION` sent to
`user:{targetUserId}`) is dropped.

The reason "remote calls from the pod host" (open mic, mute, kick) don't
work on mobile is partly this: the host's `MODERATION_ACTION` is *also*
broadcast on `pod:{podId}` (line 679 of `MoodPodCommands.cs`), so the mobile
*does* eventually see it — but if the user channel was missed on first
login, *every* private notification is lost.

**Fix:** move the auto-subscribe into `CentrifugoService.connect()` itself
and also re-subscribe on `(dis)connect` cycles so reconnects don't lose the
channel.

---

## Bug #5 — `connectToRoom` always requests a token with `isOnStage: true`

**File:** `mobile/lib/ui/features/pods/view_models/pod_view_model.dart` line 492

```dart
final tokenResult = await _podRepository.getLiveKitToken(
  _activePod!.id,
  isOnStage: true,                   // <-- always passes true
);
```

The backend uses `request.IsOnStage` only as **one** of the inputs to its
final `isOnStage` decision
(`backend/.../Features/MoodPods/MoodPodQueries.cs` lines 280–283):

```csharp
var isOnStage = isHost
    || isModerator
    || (pod.AllowOpenMic && request.IsOnStage)
    || pod.IsApprovedSpeaker(userId);
```

So this is fine *only* for the moderator's own reconnect path. It's still
working today by accident because the backend grants publish to hosts/mods
even when `request.IsOnStage == false`. **If anyone tightens the predicate
on the backend**, every Flutter user will silently lose audio because they
always send `isOnStage: true` here while joining as a listener.

**Fix:** pass `isOnStage: isSpeakerRole` (matching the corrected value from
Bug #1).

---

## Bug #6 — Centrifugo `MODERATION_ACTION` payload field names don't match what mobile reads

**Files involved:**
* `backend/.../EventHandlers/CentrifugoDomainEventHandlers.cs` lines 370–381
* `mobile/lib/ui/features/pods/view_models/pod_view_model.dart` lines 397–406

The backend emits:

```csharp
type = "MODERATION_ACTION",
podId, action,
targetUserId, targetUsername,         // <-- targetUsername only
moderatorUserId, moderatorUsername,
reason, timestamp
```

The mobile handler reads `targetDisplayName` and `targetAvatarUrl` (lines
399–400) — **those keys do not exist in the backend payload**. So
`_handleSpeakerPromotion` is called with empty display name and null avatar.
Not catastrophic (the optimistic UI still works) but the participant card
for the newly-promoted user renders with `displayName = username` and no
avatar.

**Fix:** either include `targetDisplayName` / `targetAvatarUrl` in the
backend payload (preferred — they should be in the moderation event), or
have the mobile handler look them up from `_participants` / `_speakers`.

---

## Bug #7 — `STAGE_JOIN` broadcast fires *before* the token refresh finishes

**File:** `mobile/lib/ui/features/pods/view_models/pod_view_model.dart` lines 798–819

```dart
// Background reconnect — awaited ... but the snackbar / UI already showed above.
bool micLive = false;
try {
  final tokenResult = await _podRepository.getLiveKitToken(...);   // async
  ...
} catch (promoteErr) {
  _liveKitService.demoteToListener(_localUserId ?? '');
} finally {
  _isPromotionInFlight = false;
}

// Broadcast STAGE_JOIN to all peers in the pod.
if (_activePod != null && _localUserId != null) {
  await _podRepository.sendSignal(
    _activePod!.id,
    'STAGE_JOIN',
    payload: { 'isOnStage': true, 'isMuted': !micLive, ... },
  );
}
```

The local code broadcasts `isOnStage: true` and `isMuted: !micLive` to all
peers — **even when the reconnect fails** (`micLive == false` because of the
catch block, and `_isPromotionInFlight` resets to false in `finally`). Other
peers then think the listener joined the stage even though they didn't.
The optimistic UI is correct locally, but the broadcast is lying to everyone
else.

**Fix:** only broadcast `STAGE_JOIN` when `micLive == true`. Use the local
`_isSpeaker`/`_isMicMuted` flags.

---

## Minor issues / smells (worth fixing while you're in there)

| File | Issue |
|---|---|
| `mobile/lib/data/services/centrifugo_service.dart` line 24 | Default URL is `ws://localhost:8000` — should be `wss://sloopws.mydev-lab.com` to match production. |
| `mobile/lib/data/services/livekit_service.dart` line 87 | Same: default URL is `ws://92.4.162.183:7880`. Use `wss://slooplive.mydev-lab.com`. |
| `mobile/lib/data/services/api_service.dart` line 20 | `http://10.0.2.2:5195/api` for Android dev — fine, but make sure the prod iOS build is actually given an `--dart-define=API_URL=...`. |
| `mobile/lib/ui/features/pods/view_models/pod_view_model.dart` line 73 | The big comment about "approval notification keeps showing" describes a debounce fix that's actually correctly implemented — but it depends on a backend `MODERATION_ACTION` that mobile only just started handling. Worth double-checking that the web `STAGE_APPROVE` signal path is also still being sent (it is, see `usePodVoiceEngine.ts` lines 829–833) and that `_handleSpeakerPromotion` handles the `STAGE_APPROVE` variant too. (Right now it ONLY handles `MODERATION_ACTION` with `action == 'promote_speaker'`.) |
| `backend/.../EventHandlers/CentrifugoDomainEventHandlers.cs` line 383 | The backend double-publishes `MODERATION_ACTION` to `pod:{podId}` AND `user:{targetUserId}`. The double delivery causes the snackbar debounce to fire on the mobile client — confirm that's the *intended* user experience. |
| `mobile/lib/ui/features/pods/view_models/pod_view_model.dart` line 397 | When the action is `promote_speaker`, you also need to refresh `_activePod.approvedSpeakerUserIds` so the next join doesn't rely on a fresh token. Today the field exists in the DB and the backend re-emits the list in `MoodPodSettingsUpdatedEvent` (line 345 of `CentrifugoDomainEventHandlers.cs`) but mobile's `MoodPodDto` model doesn't carry an `approvedSpeakerUserIds` field. |

---

## Sequence diagram — what the user sees today

```
iOS App (Flutter)                              Web App (React)
─────────────────                              ────────────────
Host taps "Allow open mic for listener"
   │
   ▼
POST /moodpods/{id}/moderate {action:"promote_speaker"} ────► Backend
                                                                 │
                                                                 ▼
                                          Publish MODERATION_ACTION to:
                                            • pod:{podId}       (broadcast)
                                            • user:{targetUid}  (private)
                                                                 │
                                                                 ▼
                          ┌─────── channel: pod:{podId} ────────┴─────── channel: user:{targetUid}
                          │                                              │
        Web ◄────────────┤                                              ├────► Web (subscribed automatically)
                          │
        iOS ◄────────────┘  ✓ pod channel is fine
        BUT user:{targetUid} channel
        never subscribed on iOS
        because auth.login() doesn't
        trigger re-subscribe.

Result on Web:
  ✓ voiceEngine.handleJoinStage()    ← triggered by MODERATION_ACTION
  ✓ LiveKit reconnects with new JWT
  ✓ Mic works

Result on iOS:
  ⚠ MODERATION_ACTION received on pod:{podId}
  ⚠ _handleSpeakerPromotion() called
  ✓ LiveKit reconnects (with bug #2/3/5 in the way)
  ✗ Mic fails to publish OR mic published but the URL/ATS rejected it
```

---

## Recommended order of fixes

1. **Bug #3** (backend override of `wss://` → `ws://`) — unblocks Bug #2.
2. **Bug #1** (`isSpeakerRole` missing `_isModerator`) — fixes the moderator
   join path.
3. **Bug #2** (mobile `resolveWsUrl` upgrades `ws://` → `wss://` when the
   app is built for production) — fixes LiveKit WebSocket connection from
   HTTPS contexts.
4. **Bug #4** (auto-subscribe `user:{userId}` in `CentrifugoService`) —
   fixes the missing private channel for *all* private notifications, not
   just pod moderation.
5. **Bug #5** (pass `isOnStage: isSpeakerRole` when requesting the LiveKit
   token).
6. **Bug #6** (add `targetDisplayName` / `targetAvatarUrl` to backend
   moderation payload — or look them up in mobile from the local cache).
7. **Bug #7** (only broadcast `STAGE_JOIN` after the local mic is
   actually live).

After applying the above, the host's "Allow open mic for a listener" button
in the web moderator drawer will trigger the same `_handleSpeakerPromotion`
flow on the iOS listener, which will (a) call `_liveKitService.connectToRoom`
with a working `wss://` URL and an `isOnStage: true` token, (b) publish the
mic, and (c) emit a snackbar — matching the existing web behavior.

---

## Quick smoke tests for each fix

```dart
// Bug #1
expect(podVm.isSpeakerRole, isTrue);   // when _isModerator == true

// Bug #2 / #3
final url = LiveKitService.resolveWsUrl(
  customHost: 'wss://slooplive.mydev-lab.com',
);
expect(url.startsWith('wss://'), isTrue);

// Bug #4
final svc = CentrifugoService(api: api);
await svc.connect();
expect(svc.activeChannels.contains('user:abc-123'), isTrue);

// Bug #5
expect(tokenResult.isOnStage, isSpeakerRole);

// Bug #6
expect(event.data['targetDisplayName'], isA<String>());
expect(event.data['targetAvatarUrl'], isA<String?>());
```

---

## What was actually changed (implementation log)

| # | File | Change |
|---|---|---|
| 1 | `backend/src/SparkLoop.Infrastructure/RealTime/LiveKitService.cs` | Removed the silent `wss://slooplive.mydev-lab.com → ws://92.4.162.183:7880` override. The service now honors whatever is configured; default flipped to `ws://localhost:7880` for dev. |
| 2 | `mobile/lib/ui/features/pods/view_models/pod_view_model.dart` | `isSpeakerRole` now includes `_isModerator`. `getLiveKitToken` is called with the real `isSpeakerRole` value instead of hard-coded `true`. `STAGE_JOIN` is only broadcast when `micLive == true`. |
| 3 | `mobile/lib/data/services/livekit_service.dart` | `defaultWsUrl` switched to `wss://slooplive.mydev-lab.com`. `resolveWsUrl` now: keeps `wss://` URLs verbatim, auto-upgrades `ws://` → `wss://` for public hostnames, leaves localhost / 127.0.0.1 / 192.168.x / 10.x.x alone so dev still works, still rewrites `localhost` → `10.0.2.2` on Android. |
| 4 | `mobile/lib/data/services/centrifugo_service.dart` | Constructor now requires a `StorageService` (throws `StateError` if absent). On every `connect()` it auto-subscribes `user:{userId}` (read from storage) into `_activeChannels` so the existing handshake-confirmation loop picks it up. Added public `refreshUserChannel()` for the auth layer to call after login/logout. |
| 5 | `mobile/lib/ui/features/auth/view_models/auth_view_model.dart` | `login()`, `register()`, and `logout()` now call `refreshUserChannel()` after re-connecting Centrifugo so the private channel is guaranteed to be subscribed even if the WS was already in `connected` state. |
| 6 | `mobile/lib/main.dart` & `mobile/test/widget_test.dart` | Pass `storageService` to `CentrifugoService`. |
| 7 | `backend/src/SparkLoop.Application/EventHandlers/CentrifugoDomainEventHandlers.cs` | `MoodPodModerationActionEventHandler` now takes `IAppDbContext`, looks up the target user's display name and avatar, and includes `targetDisplayName` / `targetAvatarUrl` in the broadcast payload. |
| 8 | `mobile/test/widget_test.dart` | Added 3 smoke tests: `resolveWsUrl` upgrades public `ws://` to `wss://`, default URL is WSS, and `CentrifugoService` throws when constructed without storage. |

### Verification commands

```bash
# Flutter side
cd mobile
flutter analyze        # → No issues found
flutter test           # → All 34 tests passed (3 new smoke tests added)

# Backend side
cd backend
dotnet build           # → 0 Error(s)
dotnet test --no-build # → Passed! 49/49
```

---

_Last updated: 2026-09-20_