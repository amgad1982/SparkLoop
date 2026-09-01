# SparkLoop - Flutter Mobile Frontend Implementation Plan

This document outlines the architectural blueprint, technology stack, screen workflows, and implementation specifications for building the **SparkLoop Flutter Application** (`mobile/`).

---

## 1. Architectural Blueprint (Clean Architecture + MVVM)

The application follows the **Layered Clean Architecture + MVVM + Repository Pattern**:

```
mobile/lib/
├── data/
│   ├── models/                # JSON-serializable DTOs (Post, Spark, Chain, MoodPod, User, Follow)
│   ├── services/              # Stateless API clients & wrappers:
│   │   ├── api_service.dart   # Dio HTTP client with JWT interceptor & refresh token queue
│   │   ├── storage_service.dart # flutter_secure_storage for tokens & preferences
│   │   ├── centrifugo_service.dart # Real-time Centrifugo WebSocket connection & channels
│   │   └── livekit_voice_service.dart # LiveKit SFU audio engine & room controls
│   └── repositories/          # Repositories (Auth, Feed, Sparks, Chains, Pods, User, Follow)
├── domain/
│   ├── entities/              # Core immutable domain models
│   └── exceptions/            # App failure & exception types
├── ui/
│   ├── core/                  # Design system:
│   │   ├── theme/             # Dark Night (#0B0F17) / Light themes, glow gradients
│   │   ├── typography/        # Modern Google Fonts (Outfit / Tajawal for Arabic)
│   │   ├── widgets/           # GlassContainer, FollowButton, ReactionPicker, AvatarBadge
│   │   └── localization/      # ARB files (app_en.arb, app_ar.arb) & RTL support
│   ├── features/
│   │   ├── auth/              # Login, Register, OTP Verification, Persona Switcher
│   │   ├── feed/              # Posts stream, Reaction bar, Create Post drawer
│   │   ├── sparks/            # 24h Daily Challenge hero, Real-time Voting, Submissions
│   │   ├── chains/            # Pass-the-Mic interactive turns, Audio beat upload, Lock timer
│   │   ├── pods/              # Mood Pods grid, LiveKit Voice Stage, Emoji burst engine, Chat
│   │   ├── meme_canvas/       # Interactive meme creator (CustomPainter, text, stickers, brush)
│   │   ├── profile/           # XP / Rep Score, Badges, Following/Followers, Account settings
│   │   └── search/            # Unified search, Trending tags, Top Creators leaderboard
│   └── navigation/            # GoRouter with StatefulShellRoute for 5-tab bottom navigation
```

---

## 2. Key Dependencies (`pubspec.yaml`)

- **Routing**: `go_router` (Stateful nested bottom navigation & deep linking)
- **State Management**: `provider` (MVVM ViewModels with `ChangeNotifier`)
- **Networking & API**: `dio` (JWT Interceptors, automatic refresh token retry)
- **Secure Persistence**: `flutter_secure_storage` (Token & session cache), `shared_preferences`
- **Real-Time WebSockets**: `centrifuge` / `web_socket_channel` (Centrifugo channels)
- **WebRTC Voice Rooms**: `livekit_client` (Mood Pod audio stages, speakers, microphone)
- **Meme Studio Canvas**: `image_picker`, `screenshot`, `path_provider` (Layered drawing & WebP export)
- **Audio Playback & Recording**: `audioplayers`, `record` (Story chain voice beats & sound effects)
- **Visuals & Design**: `flutter_animate`, `google_fonts`, `lucide_icons`
- **Localization**: `flutter_localizations`, `intl` (Arabic RTL + English LTR)

---

## 3. Screen & Feature Specifications

### A. Adaptive Shell & Navigation
- **4-Tab Bottom Navigation Bar**:
  1. 📰 **Feed**: Micro-posts, hashtags, media gallery.
  2. 🎨 **Meme Lab**: Elevated center floating gradient button for quick creative canvas access.
  3. 🌿 **Story Chains**: Pass-the-mic turn-based co-creation.
  4. 🎙️ **Mood Pods**: Real-time audio stages with pulsing `Live` badge.
- **Top App Bar**:
  - SparkLoop logo with real-time status pulse indicator.
  - Search trigger icon.
  - Arabic / English toggle button.
  - User profile avatar with active glow ring when viewing the profile screen.

### B. Authentication & Persona Management
- JWT Authentication with silent background refresh token queuing.
- 6-digit OTP email verification with countdown resend timer.
- Guest Explorer mode allowing unauthenticated read access with interactive login modals when attempting to post, react, vote, or join audio stages.
- Multi-persona switcher allowing instant persona testing.

### C. Posts Feed & Interactions (`/feed`)
- Infinite scroll feed with pull-to-refresh.
- Hashtags (`#`) and Mentions (`@`) parser with tap-to-filter navigation.
- 5 Quick Reaction buttons (🔥 😂 💡 🚀 💖) with optimistic state updates and haptic feedback.
- Media attachment viewer with zoom and full-screen preview.
- Globally synchronized `FollowButton` that updates across all posts by that author in real-time.
- Create Post sheet with character countdown (<= 280 chars), hashtag autocomplete, and media upload.

### D. Pass-the-Mic Story Chains (`/chains`)
- Active and completed story chains list.
- Turn sequence timeline showing locked contributors and countdown timers.
- "Pass the Mic" turn submission drawer with voice audio recording and text beat upload.
- Create Chain modal with custom turn limit and timeout configuration.

### E. Ephemeral Mood Pods & Live Voice Stage (`/pods`)
- 24h ephemeral rooms categorized by vibe (Party, Chill, Deep Talk, Meme Storm, Late Night).
- **LiveKit SFU Voice Engine**:
  - WebRTC room connection with speaking indicators and audio wave visualizers.
  - Stage Speakers vs. Audience separation.
  - Hand-raising queue and host moderation controls (Mute, Kick, Promote to Stage).
  - Floating emoji burst particle animations.
  - In-pod live chat stream via Centrifugo.

### F. Interactive Meme Studio / Canvas Editor (`/create`)
- Custom Flutter gesture-driven canvas:
  - Drag, pinch-to-zoom, and rotate text with Impact font and outline strokes.
  - Sticker / emoji layer placement.
  - Freehand drawing brush with color and stroke-width pickers.
  - Preloaded meme templates and custom gallery image picker.
- Image export to WebP/PNG and 1-tap submission to Feed or Daily Spark challenge.

### G. User Profile, XP Portfolio & Search
- Profile header with Rep Score, XP level badge, bio, and social links.
- Interactive Followers and Following list modals.
- Unified multi-category search (All, Posts, Creators, Hashtags, Pods).
- Account settings (Privacy public/private toggle, Dark/Light mode, Arabic/English RTL toggle).

---

## 4. Endpoints & Server Integration

| Service | Target URL | Protocol |
|---|---|:---:|
| **Backend REST API** | `https://sloopapi.mydev-lab.com/api` | HTTPS |
| **Centrifugo WebSockets** | `wss://sloopws.mydev-lab.com/connection/websocket` | WSS |
| **LiveKit SFU Voice** | `wss://slooplive.mydev-lab.com` | WSS / WebRTC |
| **MinIO Media Storage** | `https://sloopmedia.mydev-lab.com/sparkloop-media` | HTTPS |

---

## 5. Implementation Roadmap

1. **Bootstrap Project**: Initialize Flutter application in `mobile/` and configure `pubspec.yaml`.
2. **Core Layer**: Configure theme (Dark/Light), typography (Outfit/Tajawal), ARB localization (English/Arabic RTL), and base reusable widgets.
3. **Data Layer**: Implement `ApiService`, `StorageService`, `CentrifugoService`, `LivekitService`, and feature Repositories.
4. **Navigation & Shell**: Set up `GoRouter` with `StatefulShellRoute` for the 5-tab bottom navigation and top header.
5. **Feature Modules**:
   - `auth`: Login, Register, OTP Verification, Persona Switcher.
   - `feed`: Posts feed, Reactions, Create Post sheet, Follow synchronization.
   - `sparks`: Daily Spark challenge card, Voting, Submissions grid, History archive.
   - `chains`: Story chain timeline, Pass-the-mic turn submission, Audio recording.
   - `pods`: Mood Pods grid, LiveKit voice stage, Audio visualizer, Emoji bursts, Chat.
   - `meme_canvas`: Gesture canvas, Text/Sticker layers, Brush drawing, Export & 1-tap share.
   - `profile` & `search`: User portfolio, Followers modal, Unified search.
6. **Testing & Quality Assurance**: Static analysis (`flutter analyze`), unit tests (`flutter test`), and build validation.
