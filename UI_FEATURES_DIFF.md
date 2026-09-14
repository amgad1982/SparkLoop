# UI Features Diff: Flutter Mobile App vs React Frontend App

> Generated comparison of UI feature surfaces between `mobile/` (Flutter) and `frontend/` (React + Vite + Tailwind).

---

## Shared feature areas (present in both)

| Feature area | Flutter (`mobile/lib`) | Frontend (`frontend/src`) |
|---|---|---|
| **Auth** | `auth/views/{login_screen, register_screen, verify_email_screen}.dart` | `components/auth/AuthModal.tsx` (single modal covers login/register/verify) |
| **Feed / Posts** | `feed/views/{feed_screen, create_post_sheet, post_card_widget, post_comments_sheet}.dart` | `components/posts/{FeedView, CreatePostDrawer, PostCommentsDrawer}.tsx` |
| **Chains (Pass-the-Mic)** | `chains/views/{chains_screen, chain_detail_screen, create_chain_dialog, submit_turn_sheet}.dart` | `components/chains/{PassTheMicChainCard, CreateChainModal, TurnInputDrawer}.tsx` |
| **Mood Pods (rooms)** | `pods/views/{pods_screen, pod_room_screen, create_pod_dialog, pod_moderation_sheet, pod_bg_music_player, dj_lists_screen}.dart` + `pods/widgets/pod_audio_player_widget.dart` | `components/pods/{MoodPodsView, MoodPodRoom, CreateMoodPodModal, PodModerationDrawer, PodBgMusicPlayer, DjListsModal, PodAudioPlayer, PodAudioStage, FloatingReactions}.tsx` |
| **DJ Deck / Stations** | `dj_deck/views/{dj_deck_screen, dj_stations_screen}.dart` + `dj_deck/widgets/{dj_mini_player, music_copyright_dialog, track_library_selector_bottom_sheet, user_music_library_view}.dart` | `components/dj/{DjDeckModal, DjMiniPlayer, CopyrightAgreementModal, TrackLibrarySelectorModal, UserMusicLibraryView}.tsx` |
| **Meme Canvas** | `meme_canvas/views/{meme_canvas_screen, canvas_painter, template_picker_sheet, meme_share_sheet}.dart` | `components/meme-canvas/MemeCanvasEditor.tsx` |
| **Profile / Follow list / Settings** | `profile/views/{profile_screen, settings_screen, follow_list_dialog}.dart` + `follow/view_models/follow_view_model.dart` | `components/profile/{ProfileView, SettingsModal, FollowListModal, FollowRequestsDrawer}.tsx` |
| **Search** | `search/views/search_screen.dart` | `components/search/GlobalSearchModal.tsx` |
| **Bottom navigation shell** | `ui/features/shell/{mobile_app_shell, bottom_nav_bar, top_app_header}.dart` | `components/layout/{MobileAppShell, BottomNavBar, TopHeader}.tsx` |
| **Hashtag autocomplete / Tooltip / Follow button** | `ui/core/widgets/{hashtag_text, follow_button}.dart` | `components/common/HashtagAutocomplete.tsx`, `components/ui/{FollowButton, Tooltip}.tsx` |

---

## Present in Frontend but missing in Flutter

| Frontend-only feature | Notes |
|---|---|
| **`PersonaSwitcher`** (`layout/PersonaSwitcher.tsx`) | Multi-persona account switcher. |
| **`DesktopSidebar`** + **`DesktopHeader`** + **`RightWidgetPanel`** (`layout/*.tsx`) | Desktop-only layout chrome; mobile has no tablet/desktop layout. |
| **`FollowRequestsDrawer`** (`profile/FollowRequestsDrawer.tsx`) | Private follow-request inbox/accept UI. |
| **`FloatingReactions`** (`pods/FloatingReactions.tsx`) | Animated floating-emoji reaction overlay inside pods. |
| **`PodAudioStage`** (`pods/PodAudioStage.tsx`) | More elaborate audio-stage rendering than Flutter's `pod_audio_player_widget`. |
| **`ErrorBoundary`** (`common/ErrorBoundary.tsx`) | React error boundary; Flutter relies on default error widget. |
| **`RTLProvider`** (`layout/RTLProvider.tsx`) | Mobile relies on Flutter Material `Directionality` from localization. |
| **Inline hashtag filter** on `FeedView` | Web FeedView filters posts by clicked hashtag; Flutter feed is a single flat feed. |

---

## Present in Flutter but missing / weaker in Frontend

| Flutter-only feature | Notes |
|---|---|
| **Dedicated `VerifyEmailScreen` route** (`/verify-email`) | Frontend has no dedicated verification screen. |
| **Deep-linkable routes** (`/profile`, `/search`, `/dj`, `/dj-lists`, `/dj/deck/:id`, `/verify-email`, `/register`, `/login`, `/chains/:id`, `/pods/:id`) | Frontend uses tab + modal state only; no browser history / shareable URLs. |
| **`MemeShareSheet`** | System share intent sheet. |
| **`TemplatePickerSheet`** | Templated meme picker as a separate sheet (embedded inside `MemeCanvasEditor` on web). |
| **`CanvasPainter` (CustomPainter)** | Native custom canvas painting logic. |
| **`ReactionBar` widget** (`ui/core/widgets/reaction_bar.dart`) | Shared reaction-bar widget. |
| **`AppNetworkImage` / `GlassContainer` / `AvatarBadge`** | Shared design-system primitives; web has no equivalent `components/ui/` design system beyond `FollowButton` + `Tooltip`. |
| **`StatefulShellRoute.indexedStack`** | Per-tab persistent state; web swaps components on `activeTab` change. |
| **5th tab = Settings** (vs Profile on web) | See "Tab-bar comparison" below. |
| **Dedicated `DjStationsScreen`** (`/dj` route) | Web opens DJ deck via modal only. |
| **DJ mini-player anchored to bottom of shell globally** | Flutter embeds `DjMiniPlayer` in `MobileAppShell`; web uses it only inside the DJ modal. |
| **Auth as full screens** (`/login`, `/register`) | Web uses a single `AuthModal`; no deep-linkable auth URLs. |

---

## Tab-bar comparison

| Slot | Flutter BottomNavBar | Frontend BottomNavBar |
|---|---|---|
| 0 | Feed | Feed |
| 1 | Chains | Chains |
| 2 | Create (Meme Lab) | Create (Meme Canvas Editor) |
| 3 | Pods | Pods |
| 4 | **Settings** | **Profile** |

Structural mismatch: Flutter's 5th tab is *Settings*, frontend's 5th tab is *Profile*. Mobile keeps Profile on a separate `/profile` route outside the bottom bar.

---

## Architectural / behavioral differences

1. **Tab state persistence** — Flutter preserves scroll/state per tab; React rebuilds the active view on every tab change.
2. **Routing model** — Flutter uses URL-based deep-linkable routes; the React app keeps everything in `App.tsx` component memory.
3. **Layout paradigm** — Flutter is mobile-only (single scaffold + bottom bar + top header); React has a responsive layout with `DesktopSidebar` + `DesktopHeader` + `RightWidgetPanel` for desktop viewports.
4. **Modals vs Routes** — Flutter promotes most secondary screens to real routes (chains detail, pod room, profile, search, DJ stations/deck, meme canvas); React keeps flows as overlays/drawers/modals on top of the current tab.
5. **Persona / multi-account** — Only on web.
6. **Follow requests** — Dedicated accept inbox only on web.
7. **Pod reactions** — `FloatingReactions` overlay only on web.
8. **Sharing** — System share sheet only on mobile.
9. **Custom canvas rendering** — Native `CustomPainter` on mobile vs. single `MemeCanvasEditor` component on web.
10. **Auth flow** — Mobile has dedicated login/register/verify-email screens; web has one combined `AuthModal`.

---

## TL;DR

- **Core feature set is fully shared**: Auth, Feed/Posts, Chains, Pods, DJ Deck, Meme Canvas, Profile, Search, Follow, Hashtag autocomplete.
- **Frontend-only**: persona switching, desktop layout chrome, follow-request drawer, floating pod reactions, error boundary, RTL provider, inline hashtag filtering of the feed.
- **Mobile-only**: deep-linkable routes for every resource, system share sheet, meme template picker, dedicated DJ stations screen, per-tab state persistence, dedicated auth screens with email-verification route, mini DJ player pinned to shell bottom, dedicated design-system primitives (glass container, avatar badge, network image, reaction bar).
- **One structural tab mismatch**: Flutter's 5th tab is *Settings*; frontend's 5th tab is *Profile*.