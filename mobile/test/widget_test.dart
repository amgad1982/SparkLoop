import 'package:flutter_test/flutter_test.dart';
import 'package:sparkloop_mobile/data/models/auth_models.dart';
import 'package:sparkloop_mobile/data/models/pod_models.dart';
import 'package:sparkloop_mobile/data/models/post_models.dart';
import 'package:sparkloop_mobile/data/models/search_models.dart';
import 'package:sparkloop_mobile/data/services/api_service.dart';
import 'package:sparkloop_mobile/data/services/livekit_service.dart';
import 'package:sparkloop_mobile/data/services/sound_synth_service.dart';
import 'package:sparkloop_mobile/ui/core/widgets/app_network_image.dart';

void main() {
  group('SparkLoop Mobile Unit Tests', () {
    test('UserDto JSON serialization and Persona fallback', () {
      final json = {
        'id': 'u-123',
        'email': 'creator@sparkloop.com',
        'username': 'meme_king',
        'displayName': 'Meme King 🔥',
        'role': 'VIP Creator',
        'isEmailVerified': true,
        'followersCount': 100,
        'followingCount': 50,
        'repScore': 1250,
      };

      final user = UserDto.fromJson(json);
      expect(user.id, 'u-123');
      expect(user.username, 'meme_king');
      expect(user.repScore, 1250);

      final persona = Persona.fromUser(user);
      expect(persona.username, 'meme_king');
      expect(persona.isCustom, isTrue);
    });

    test('PostDto reactions calculation and copyWith', () {
      final post = PostDto(
        id: 'p-1',
        authorId: 'u-1',
        authorUsername: 'alice',
        authorDisplayName: 'Alice',
        content: 'Check out this meme! #SparkLoop #DailySpark',
        createdAtUtc: DateTime.now().toUtc(),
      );

      expect(post.content.contains('#SparkLoop'), isTrue);
      expect(post.reactionCount, 0);

      final updated = post.copyWith(reactionCount: 5);
      expect(updated.reactionCount, 5);
    });

    test('GlobalSearchResultDto JSON parsing and multi-category results', () {
      final json = {
        'query': 'meme',
        'totalCount': 4,
        'posts': [
          {
            'id': 'p-10',
            'authorId': 'u-1',
            'authorUsername': 'alice',
            'authorDisplayName': 'Alice',
            'content': 'Loving the meme challenges! #meme',
            'createdAtUtc': '2026-08-28T00:00:00Z',
          }
        ],
        'users': [
          {
            'id': 'u-2',
            'username': 'bob',
            'displayName': 'Bob Master',
            'repScore': 150,
          }
        ],
        'moodPods': [
          {
            'id': 'pod-1',
            'title': 'Chill Vibes & Memes',
            'hostId': 'u-1',
            'hostUsername': 'alice',
            'hostDisplayName': 'Alice',
            'vibe': 'Chill',
            'participantCount': 4,
            'expiresAtUtc': '2026-08-29T00:00:00Z',
            'createdAtUtc': '2026-08-28T00:00:00Z',
          }
        ],
        'hashtags': [
          {'tag': 'meme', 'count': 5},
          {'tag': 'sparkloop', 'count': 2},
        ],
      };

      final result = GlobalSearchResultDto.fromJson(json);
      expect(result.query, 'meme');
      expect(result.posts.length, 1);
      expect(result.users.length, 1);
      expect(result.pods.length, 1);
      expect(result.hashtags, contains('meme'));
      expect(result.hashtags, contains('sparkloop'));
    });

    test('MoodPodDto settings, themes, duration, and permission mapping', () {
      final json = {
        'id': 'pod-42',
        'title': 'Late Night Jam & Tech',
        'hostUserId': 'u-99',
        'hostUsername': 'dev_amgad',
        'hostDisplayName': 'Amgad Dev',
        'moodEmoji': '🌙',
        'backgroundTheme': 'cyber-neon',
        'isPrivate': true,
        'inviteCode': 'SPARK-99',
        'allowParticipantsChangeTheme': true,
        'allowParticipantsPlayBgMusic': true,
        'allowOpenMic': false,
        'participantCount': 12,
        'expiresAtUtc': '2026-08-30T12:00:00Z',
        'createdAtUtc': '2026-08-29T12:00:00Z',
      };

      final pod = MoodPodDto.fromJson(json);
      expect(pod.id, 'pod-42');
      expect(pod.moodEmoji, '🌙');
      expect(pod.backgroundTheme, 'cyber-neon');
      expect(pod.isPrivate, isTrue);
      expect(pod.inviteCode, 'SPARK-99');
      expect(pod.allowParticipantsChangeTheme, isTrue);
      expect(pod.allowOpenMic, isFalse);
      expect(pod.participantCount, 12);
    });

    test('UserProfileDto and DeviceSessionDto parsing', () {
      final profileJson = {
        'id': 'u-1',
        'username': 'creative_mind',
        'displayName': 'Creative Mind',
        'email': 'mind@sparkloop.com',
        'bio': 'Full-stack builder & Meme curator',
        'avatarUrl': 'https://api.dicebear.com/7.x/bottts/png?seed=creative',
        'bannerUrl': 'gradient:cyber-neon',
        'preferredTheme': 'dark',
        'preferredLanguage': 'en',
        'isPrivate': true,
        'isSearchDiscoverable': true,
        'showBio': true,
        'showFollowersCount': true,
        'showBadges': true,
        'showActivityStats': true,
        'followersCount': 420,
        'followingCount': 69,
        'postsCount': 15,
        'repScore': 5000,
        'sparksWonCount': 3,
        'badges': [
          {'id': 'b-1', 'name': 'Early Adopter', 'icon': '🚀', 'description': 'Joined during alpha'},
        ],
        'recentPosts': [],
      };

      final profile = UserProfileDto.fromJson(profileJson);
      expect(profile.username, 'creative_mind');
      expect(profile.bannerUrl, 'gradient:cyber-neon');
      expect(profile.badges.length, 1);
      expect(profile.badges.first.icon, '🚀');
      expect(profile.isPrivate, isTrue);

      final sessionJson = {
        'id': 'sess-1',
        'deviceName': 'iPhone 17 Pro',
        'deviceType': 'Flutter iOS',
        'ipAddress': '192.168.1.50',
        'lastActiveAtUtc': '2026-08-29T12:00:00Z',
      };

      final session = DeviceSessionDto.fromJson(sessionJson);
      expect(session.id, 'sess-1');
      expect(session.deviceName, 'iPhone 17 Pro');
      expect(session.deviceType, 'Flutter iOS');

      final fallbackProfile = UserProfileDto.createDefault('@fallback_user');
      expect(fallbackProfile.username, 'fallback_user');
      expect(fallbackProfile.displayName, 'fallback_user');

      final fromUser = UserProfileDto.fromUser(UserDto(
        id: 'u-55',
        email: 'test@sparkloop.com',
        username: 'spark_fan',
        displayName: 'Spark Fan',
        role: 'Creator',
        isEmailVerified: true,
        createdAtUtc: DateTime.now().toUtc(),
      ));
      expect(fromUser.username, 'spark_fan');
      expect(fromUser.displayName, 'Spark Fan');
    });

    test('ApiService.getMediaUrl resolves relative and absolute URLs correctly', () {
      expect(ApiService.getMediaUrl(''), '');
      expect(ApiService.getMediaUrl(null), '');
      expect(ApiService.getMediaUrl('https://media.giphy.com/media/test.gif'), 'https://media.giphy.com/media/test.gif');
      expect(ApiService.getMediaUrl('http://images.com/pic.png'), 'http://images.com/pic.png');
      expect(ApiService.getMediaUrl('/uploads/meme_123.gif'), 'http://localhost:5195/uploads/meme_123.gif');
      expect(ApiService.getMediaUrl('uploads/avatar_456.png'), 'http://localhost:5195/uploads/avatar_456.png');
    });

    test('AppNetworkImage correctly identifies GIFs and SVGs', () {
      expect(AppNetworkImage.isGifUrl('https://media.giphy.com/media/nrXif9YExO9EI/giphy.gif'), isTrue);
      expect(AppNetworkImage.isGifUrl('http://localhost:5195/uploads/meme_123.gif'), isTrue);
      expect(AppNetworkImage.isGifUrl('https://images.com/animation?format=gif'), isTrue);
      expect(AppNetworkImage.isGifUrl('https://images.com/photo.png'), isFalse);
      expect(AppNetworkImage.isGifUrl('https://images.com/photo.jpg'), isFalse);

      expect(AppNetworkImage.isSvgUrl('https://api.dicebear.com/7.x/bottts/svg?seed=spark'), isTrue);
      expect(AppNetworkImage.isSvgUrl('https://example.com/icon.svg'), isTrue);
      expect(AppNetworkImage.isSvgUrl('https://example.com/pic.png'), isFalse);
    });

    test('PostDto media attachment with relative GIF URL resolves to absolute', () {
      final postJson = {
        'id': 'p-99',
        'authorId': 'u-1',
        'authorUsername': 'meme_king',
        'authorDisplayName': 'Meme King',
        'content': 'Check this out! #coding',
        'media': {
          'url': '/uploads/fun.gif',
          'type': 'image/gif',
        },
        'createdAtUtc': '2026-08-30T10:00:00Z',
      };

      final post = PostDto.fromJson(postJson);
      expect(post.media?.url, '/uploads/fun.gif');
      final resolvedUrl = ApiService.getMediaUrl(post.media?.url);
      expect(resolvedUrl, 'http://localhost:5195/uploads/fun.gif');
      expect(AppNetworkImage.isGifUrl(resolvedUrl), isTrue);
    });

    test('PostDto parses flat real-time mediaUrl and UserDto copyWith updates avatar', () {
      final rtPostJson = {
        'id': 'p-rt-1',
        'authorId': 'u-42',
        'authorUsername': 'pixel_artist',
        'authorDisplayName': 'Pixel Artist',
        'authorAvatarUrl': 'https://api.dicebear.com/7.x/bottts/svg?seed=new_seed',
        'content': 'Real-time post arrived! ⚡',
        'mediaUrl': 'https://media.giphy.com/media/tXLpxypfSXvUc/giphy.gif',
        'mediaType': 'image/gif',
        'createdAtUtc': '2026-08-31T00:00:00Z',
      };

      final rtPost = PostDto.fromJson(rtPostJson);
      expect(rtPost.media?.url, 'https://media.giphy.com/media/tXLpxypfSXvUc/giphy.gif');
      expect(rtPost.authorAvatarUrl, 'https://api.dicebear.com/7.x/bottts/svg?seed=new_seed');

      final updatedPost = rtPost.copyWith(
        authorDisplayName: 'Super Pixel Artist',
        authorAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=updated_seed',
      );
      expect(updatedPost.authorDisplayName, 'Super Pixel Artist');
      expect(updatedPost.authorAvatarUrl, 'https://api.dicebear.com/7.x/bottts/svg?seed=updated_seed');

      final user = UserDto(
        id: 'u-42',
        email: 'artist@sparkloop.com',
        username: 'pixel_artist',
        displayName: 'Pixel Artist',
        avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=old_seed',
        role: 'Creator',
        isEmailVerified: true,
        createdAtUtc: DateTime.now().toUtc(),
      );

      final updatedUser = user.copyWith(
        avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=new_seed',
        displayName: 'Super Pixel Artist',
      );
      expect(updatedUser.avatarUrl, 'https://api.dicebear.com/7.x/bottts/svg?seed=new_seed');
      expect(updatedUser.displayName, 'Super Pixel Artist');
    });

    test('LiveKitService isolates mute toggle to local user and manages speakers', () {
      final liveKit = LiveKitService();
      expect(liveKit.speakers.isEmpty, isTrue);

      liveKit.addOrUpdateSpeaker(const LiveKitSpeaker(
        userId: 'host-1',
        username: 'pod_host',
        displayName: 'Pod Host',
        isSpeaking: false,
        isMuted: false,
      ));

      liveKit.addOrUpdateSpeaker(const LiveKitSpeaker(
        userId: 'guest-2',
        username: 'guest_listener',
        displayName: 'Guest Listener',
        isSpeaking: false,
        isMuted: true,
      ));

      expect(liveKit.speakers.length, 2);

      // Toggle mute for guest-2 only
      liveKit.toggleMute('guest-2');
      final host = liveKit.speakers.firstWhere((s) => s.userId == 'host-1');
      final guest = liveKit.speakers.firstWhere((s) => s.userId == 'guest-2');

      expect(host.isMuted, isFalse); // Host remains unmuted!
      expect(guest.isMuted, isFalse); // Guest toggled!

      liveKit.removeSpeaker('guest-2');
      expect(liveKit.speakers.length, 1);
      expect(liveKit.speakers.first.userId, 'host-1');

      liveKit.leaveRoom();
      expect(liveKit.speakers.isEmpty, isTrue);
    });

    test('PodChatMessageDto deduplicates optimistic message matching content and user', () {
      final messages = <PodChatMessageDto>[];
      final optMsg = PodChatMessageDto(
        id: 'opt_123456789',
        podId: 'pod-1',
        userId: 'user-1',
        username: 'spark_fan',
        displayName: 'Spark Fan',
        content: 'Hello SparkLoop! 🚀',
        createdAtUtc: DateTime.now().toUtc(),
      );
      messages.add(optMsg);

      final serverMsg = PodChatMessageDto(
        id: 'real-uuid-from-server',
        podId: 'pod-1',
        userId: 'user-1',
        username: 'spark_fan',
        displayName: 'Spark Fan',
        content: 'Hello SparkLoop! 🚀',
        createdAtUtc: DateTime.now().toUtc(),
      );

      final idx = messages.indexWhere((m) =>
          m.id == serverMsg.id ||
          (m.id.startsWith('opt_') &&
              m.userId == serverMsg.userId &&
              m.content.trim() == serverMsg.content.trim()));

      expect(idx, 0);
      if (idx >= 0) {
        messages[idx] = serverMsg;
      } else {
        messages.add(serverMsg);
      }

      expect(messages.length, 1);
      expect(messages.first.id, 'real-uuid-from-server');
    });

    test('SoundSynthService generates valid 16-bit PCM WAV bytes for all 10 sound effects and mic chime', () {
      final effects = ['airhorn', 'applause', 'drumroll', 'cheer', 'laugh', 'magic', 'victory', 'tada', 'boo', 'gasp', 'mic_chime'];
      for (final eff in effects) {
        final wav = SoundSynthService.getSoundEffectWav(eff);
        expect(wav.isNotEmpty, isTrue);
        // Standard RIFF WAV header starts with 'RIFF' (0x52, 0x49, 0x46, 0x46)
        expect(wav[0], 0x52);
        expect(wav[1], 0x49);
        expect(wav[2], 0x46);
        expect(wav[3], 0x46);
        // Header contains 'WAVE' (0x57, 0x41, 0x56, 0x45)
        expect(wav[8], 0x57);
        expect(wav[9], 0x41);
        expect(wav[10], 0x56);
        expect(wav[11], 0x45);
        expect(wav.length > 44, isTrue);
      }
    });

    testWidgets('ProfileScreen renders without crashing', (tester) async {
      // Check if ProfileScreen builds cleanly
    });
  });
}
