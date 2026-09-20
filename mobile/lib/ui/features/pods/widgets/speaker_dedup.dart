import '../../../../data/services/livekit_service.dart';

/// Pure helpers for collapsing "stage speakers" lists when the same
/// physical user shows up multiple times with different LiveKit
/// identities (e.g. one user joined from web, mobile, and desktop).
///
/// `PodRoomScreen` and `PodModerationSheet` both run their own dedup
/// pass over `LiveKitService.speakers` / `participants`. This class is
/// the single source of truth so the two views stay consistent and the
/// behaviour is easy to unit test.
class SpeakerDedup {
  SpeakerDedup._();

  /// Merge two `LiveKitSpeaker` entries that refer to the same physical
  /// user. Identity-bearing fields prefer the *incoming* speaker when it
  /// has a value, falling back to the existing one. Booleans are OR'd
  /// the obvious way (a live speaker wins over a silent one; a muted
  /// participant is treated as actually muted).
  static LiveKitSpeaker merge(LiveKitSpeaker existing, LiveKitSpeaker incoming) {
    final userId = incoming.userId.isNotEmpty ? incoming.userId : existing.userId;
    final username = incoming.username.isNotEmpty ? incoming.username : existing.username;
    final displayName =
        incoming.displayName.isNotEmpty ? incoming.displayName : existing.displayName;
    final avatarUrl = incoming.avatarUrl ?? existing.avatarUrl;
    return LiveKitSpeaker(
      userId: userId,
      username: username,
      displayName: displayName,
      avatarUrl: avatarUrl,
      isSpeaking: incoming.isSpeaking || existing.isSpeaking,
      isMuted: incoming.isMuted && existing.isMuted,
    );
  }

  /// Return one [LiveKitSpeaker] per physical user from the input
  /// stream, keyed by both `userId` and `username.toLowerCase()` so
  /// cross-device duplicates of the same user collapse to a single
  /// entry. The order of the first occurrence is preserved.
  ///
  /// Implementation note: we keep *one* canonical entry per physical
  /// user (`_Entry`) and look it up through alias maps. Whenever a
  /// merge happens the canonical entry is mutated in place, so every
  /// alias (userId or username) stays in sync — no stale references.
  static List<LiveKitSpeaker> dedup(Iterable<LiveKitSpeaker> entries) {
    final Map<String, _Entry> byUserId = {};
    final Map<String, _Entry> byUsername = {};
    final canonicals = <_Entry>[]; // insertion order

    _Entry upsert(LiveKitSpeaker s) {
      final usernameKey = s.username.toLowerCase();

      // 1) Match by userId.
      if (s.userId.isNotEmpty && byUserId.containsKey(s.userId)) {
        final e = byUserId[s.userId]!;
        e.speaker = merge(e.speaker, s);
        // Re-register the (possibly-new) username as an alias of this
        // canonical entry so the next iteration can reach it.
        final newName = e.speaker.username.toLowerCase();
        if (newName.isNotEmpty) byUsername[newName] = e;
        return e;
      }

      // 2) Match by username.
      if (usernameKey.isNotEmpty && byUsername.containsKey(usernameKey)) {
        final e = byUsername[usernameKey]!;
        e.speaker = merge(e.speaker, s);
        // Re-register the (possibly-new) userId as an alias so
        // subsequent iterations can reach this canonical by userId.
        if (e.speaker.userId.isNotEmpty) {
          byUserId[e.speaker.userId] = e;
        }
        return e;
      }

      // 3) New entry.
      final e = _Entry(s);
      canonicals.add(e);
      if (s.userId.isNotEmpty) byUserId[s.userId] = e;
      if (usernameKey.isNotEmpty) byUsername[usernameKey] = e;
      return e;
    }

    for (final s in entries) {
      upsert(s);
    }

    return canonicals.map((e) => e.speaker).toList(growable: false);
  }
}

class _Entry {
  LiveKitSpeaker speaker;
  _Entry(this.speaker);
}
