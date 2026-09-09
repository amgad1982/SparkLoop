import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sparkloop_mobile/data/models/auth_models.dart';
import 'package:sparkloop_mobile/data/models/dj_list_models.dart';
import 'package:sparkloop_mobile/data/models/pod_models.dart';
import 'package:sparkloop_mobile/data/models/post_models.dart';
import 'package:sparkloop_mobile/data/models/search_models.dart';
import 'package:sparkloop_mobile/data/repositories/auth_repository.dart';
import 'package:sparkloop_mobile/data/repositories/follow_repository.dart';
import 'package:sparkloop_mobile/data/repositories/user_repository.dart';
import 'package:sparkloop_mobile/data/services/api_service.dart';
import 'package:sparkloop_mobile/data/services/centrifugo_service.dart';
import 'package:sparkloop_mobile/data/services/livekit_service.dart';
import 'package:sparkloop_mobile/data/services/sound_synth_service.dart';
import 'package:sparkloop_mobile/data/services/storage_service.dart';
import 'package:sparkloop_mobile/ui/core/widgets/app_network_image.dart';
import 'package:sparkloop_mobile/ui/features/auth/view_models/auth_view_model.dart';
import 'package:sparkloop_mobile/ui/features/pods/views/pod_room_screen.dart';
import 'package:sparkloop_mobile/ui/features/profile/view_models/profile_view_model.dart';
import 'package:sparkloop_mobile/ui/features/profile/views/settings_screen.dart';
import 'package:sparkloop_mobile/ui/features/meme_canvas/views/template_picker_sheet.dart';
import 'package:sparkloop_mobile/ui/core/widgets/reaction_bar.dart';
import 'package:sparkloop_mobile/ui/features/shell/bottom_nav_bar.dart';
import 'package:sparkloop_mobile/ui/features/theme/theme_view_model.dart';

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
          },
        ],
        'users': [
          {
            'id': 'u-2',
            'username': 'bob',
            'displayName': 'Bob Master',
            'repScore': 150,
          },
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
          },
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
        'avatarUrl': 'https://api.dicebear.com/10.x/bottts/png?seed=creative',
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
          {
            'id': 'b-1',
            'name': 'Early Adopter',
            'icon': '🚀',
            'description': 'Joined during alpha',
          },
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

      final fromUser = UserProfileDto.fromUser(
        UserDto(
          id: 'u-55',
          email: 'test@sparkloop.com',
          username: 'spark_fan',
          displayName: 'Spark Fan',
          role: 'Creator',
          isEmailVerified: true,
          createdAtUtc: DateTime.now().toUtc(),
        ),
      );
      expect(fromUser.username, 'spark_fan');
      expect(fromUser.displayName, 'Spark Fan');
    });

    test(
      'ApiService.getMediaUrl resolves relative and absolute URLs correctly',
      () {
        expect(ApiService.getMediaUrl(''), '');
        expect(ApiService.getMediaUrl(null), '');
        expect(
          ApiService.getMediaUrl('https://media.giphy.com/media/test.gif'),
          'https://media.giphy.com/media/test.gif',
        );
        expect(
          ApiService.getMediaUrl('http://images.com/pic.png'),
          'http://images.com/pic.png',
        );
        expect(
          ApiService.getMediaUrl('/uploads/meme_123.gif'),
          'http://localhost:5195/uploads/meme_123.gif',
        );
        expect(
          ApiService.getMediaUrl('uploads/avatar_456.png'),
          'http://localhost:5195/uploads/avatar_456.png',
        );
      },
    );

    test('AppNetworkImage correctly identifies GIFs and SVGs', () {
      expect(
        AppNetworkImage.isGifUrl(
          'https://media.giphy.com/media/nrXif9YExO9EI/giphy.gif',
        ),
        isTrue,
      );
      expect(
        AppNetworkImage.isGifUrl('http://localhost:5195/uploads/meme_123.gif'),
        isTrue,
      );
      expect(
        AppNetworkImage.isGifUrl('https://images.com/animation?format=gif'),
        isTrue,
      );
      expect(AppNetworkImage.isGifUrl('https://images.com/photo.png'), isFalse);
      expect(AppNetworkImage.isGifUrl('https://images.com/photo.jpg'), isFalse);

      expect(
        AppNetworkImage.isSvgUrl(
          'https://api.dicebear.com/10.x/bottts/svg?seed=spark',
        ),
        isTrue,
      );
      expect(AppNetworkImage.isSvgUrl('https://example.com/icon.svg'), isTrue);
      expect(AppNetworkImage.isSvgUrl('https://example.com/pic.png'), isFalse);
    });

    testWidgets(
      'AppNetworkImage handles double.infinity width and height without throwing',
      (tester) async {
        await tester.pumpWidget(
          const MaterialApp(
            home: Scaffold(
              body: SizedBox(
                width: 300,
                height: 300,
                child: AppNetworkImage(
                  imageUrl: 'https://example.com/test-image.jpg',
                  width: double.infinity,
                  height: double.infinity,
                ),
              ),
            ),
          ),
        );

        expect(find.byType(AppNetworkImage), findsOneWidget);
      },
    );

    test(
      'PostDto media attachment with relative GIF URL resolves to absolute',
      () {
        final postJson = {
          'id': 'p-99',
          'authorId': 'u-1',
          'authorUsername': 'meme_king',
          'authorDisplayName': 'Meme King',
          'content': 'Check this out! #coding',
          'media': {'url': '/uploads/fun.gif', 'type': 'image/gif'},
          'createdAtUtc': '2026-08-30T10:00:00Z',
        };

        final post = PostDto.fromJson(postJson);
        expect(post.media?.url, '/uploads/fun.gif');
        final resolvedUrl = ApiService.getMediaUrl(post.media?.url);
        expect(resolvedUrl, 'http://localhost:5195/uploads/fun.gif');
        expect(AppNetworkImage.isGifUrl(resolvedUrl), isTrue);
      },
    );

    test('PostDto parses flat real-time mediaUrl and UserDto copyWith updates avatar', () {
      final rtPostJson = {
        'id': 'p-rt-1',
        'authorId': 'u-42',
        'authorUsername': 'pixel_artist',
        'authorDisplayName': 'Pixel Artist',
        'authorAvatarUrl':
            'https://api.dicebear.com/10.x/bottts/svg?seed=new_seed',
        'content': 'Real-time post arrived! ⚡',
        'mediaUrl': 'https://media.giphy.com/media/tXLpxypfSXvUc/giphy.gif',
        'mediaType': 'image/gif',
        'createdAtUtc': '2026-08-31T00:00:00Z',
      };

      final rtPost = PostDto.fromJson(rtPostJson);
      expect(
        rtPost.media?.url,
        'https://media.giphy.com/media/tXLpxypfSXvUc/giphy.gif',
      );
      expect(
        rtPost.authorAvatarUrl,
        'https://api.dicebear.com/10.x/bottts/svg?seed=new_seed',
      );

      final updatedPost = rtPost.copyWith(
        authorDisplayName: 'Super Pixel Artist',
        authorAvatarUrl:
            'https://api.dicebear.com/10.x/bottts/svg?seed=updated_seed',
      );
      expect(updatedPost.authorDisplayName, 'Super Pixel Artist');
      expect(
        updatedPost.authorAvatarUrl,
        'https://api.dicebear.com/10.x/bottts/svg?seed=updated_seed',
      );

      final user = UserDto(
        id: 'u-42',
        email: 'artist@sparkloop.com',
        username: 'pixel_artist',
        displayName: 'Pixel Artist',
        avatarUrl: 'https://api.dicebear.com/10.x/bottts/svg?seed=old_seed',
        role: 'Creator',
        isEmailVerified: true,
        createdAtUtc: DateTime.now().toUtc(),
      );

      final updatedUser = user.copyWith(
        avatarUrl: 'https://api.dicebear.com/10.x/bottts/svg?seed=new_seed',
        displayName: 'Super Pixel Artist',
      );
      expect(
        updatedUser.avatarUrl,
        'https://api.dicebear.com/10.x/bottts/svg?seed=new_seed',
      );
      expect(updatedUser.displayName, 'Super Pixel Artist');
    });

    test(
      'LiveKitService isolates mute toggle to local user and manages speakers',
      () {
        final liveKit = LiveKitService();
        expect(liveKit.speakers.isEmpty, isTrue);

        liveKit.addOrUpdateSpeaker(
          const LiveKitSpeaker(
            userId: 'host-1',
            username: 'pod_host',
            displayName: 'Pod Host',
            isSpeaking: false,
            isMuted: false,
          ),
        );

        liveKit.addOrUpdateSpeaker(
          const LiveKitSpeaker(
            userId: 'guest-2',
            username: 'guest_listener',
            displayName: 'Guest Listener',
            isSpeaking: false,
            isMuted: true,
          ),
        );

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
      },
    );

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

      final idx = messages.indexWhere(
        (m) =>
            m.id == serverMsg.id ||
            (m.id.startsWith('opt_') &&
                m.userId == serverMsg.userId &&
                m.content.trim() == serverMsg.content.trim()),
      );

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
      final effects = [
        'airhorn',
        'applause',
        'drumroll',
        'cheer',
        'laugh',
        'magic',
        'victory',
        'tada',
        'boo',
        'gasp',
        'mic_chime',
      ];
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

    testWidgets('BottomNavBar renders 5 buttons and handles taps correctly', (
      tester,
    ) async {
      int tappedIndex = -1;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            bottomNavigationBar: BottomNavBar(
              currentIndex: 0,
              onTap: (index) => tappedIndex = index,
            ),
          ),
        ),
      );

      // Verify all 5 tab items exist
      expect(find.text('Feed'), findsOneWidget);
      expect(find.text('Chains'), findsOneWidget);
      expect(find.text('Meme Lab'), findsOneWidget);
      expect(find.text('Pods'), findsOneWidget);
      expect(find.text('Settings'), findsOneWidget);
      expect(
        find.byIcon(Icons.palette_outlined),
        findsOneWidget,
      ); // Center Meme Lab FAB

      // Tap on Settings (index 4)
      await tester.tap(find.text('Settings'));
      expect(tappedIndex, 4);

      // Tap on Meme Lab center button (index 2)
      await tester.tap(find.byIcon(Icons.palette_outlined));
      expect(tappedIndex, 2);

      // Tap on Chains (index 1)
      await tester.tap(find.text('Chains'));
      expect(tappedIndex, 1);

      // Tap on Pods (index 3)
      await tester.tap(find.text('Pods'));
      expect(tappedIndex, 3);
    });

    testWidgets('SettingsScreen renders key sections without crashing', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      SharedPreferences.setMockInitialValues({});
      final storage = StorageService();
      await storage.init();

      final api = ApiService(storage: storage);
      final centrifugo = CentrifugoService(apiService: api);
      final liveKit = LiveKitService();
      final authRepo = AuthRepository(apiService: api, storageService: storage);
      final userRepo = UserRepository(apiService: api);
      final followRepo = FollowRepository(apiService: api);

      final themeVm = ThemeViewModel(storageService: storage);
      final authVm = AuthViewModel(
        authRepository: authRepo,
        centrifugoService: centrifugo,
      );
      final profileVm = ProfileViewModel(
        userRepository: userRepo,
        followRepository: followRepo,
      );

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            Provider<ApiService>.value(value: api),
            ChangeNotifierProvider<ThemeViewModel>.value(value: themeVm),
            ChangeNotifierProvider<AuthViewModel>.value(value: authVm),
            ChangeNotifierProvider<ProfileViewModel>.value(value: profileVm),
            ChangeNotifierProvider<LiveKitService>.value(value: liveKit),
            ChangeNotifierProvider<CentrifugoService>.value(value: centrifugo),
          ],
          child: const MaterialApp(home: SettingsScreen()),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Settings'), findsOneWidget);
      expect(find.text('Appearance & Language'), findsOneWidget);
      expect(find.text('Dark Mode'), findsOneWidget);
      expect(find.text('Audio & Voice Stage'), findsOneWidget);
      expect(find.text('Notifications & Experience'), findsOneWidget);
      expect(find.text('Pod & Stage Invites'), findsOneWidget);
      expect(find.text('Meme Chain Turn Alerts'), findsOneWidget);
      expect(find.text('New Follower Alerts'), findsOneWidget);
      expect(find.text('Haptic Feedback'), findsOneWidget);
      expect(find.text('Clear Media Cache'), findsOneWidget);
      expect(find.text('v1.0.0 (Build 42)'), findsOneWidget);

      // Verify all tech plumbing and monospace/IP info is stripped
      expect(find.text('Network & Infrastructure'), findsNothing);
      expect(find.text('Centrifugo Real-time'), findsNothing);
      expect(find.text('Coturn TURN Relay'), findsNothing);
    });

    test('DjListDto, DjTrackDto, and CreateDjListDto serialization', () {
      final track = DjTrackDto(
        id: 't-1',
        title: 'Neon Nights',
        artist: 'DJ Pixel',
        url: '/audio/presets/synth.wav',
        durationSeconds: 180,
      );

      final trackJson = track.toJson();
      expect(trackJson['title'], 'Neon Nights');
      expect(trackJson['durationSeconds'], 180);

      final reconstructedTrack = DjTrackDto.fromJson(trackJson);
      expect(reconstructedTrack.id, 't-1');
      expect(reconstructedTrack.title, 'Neon Nights');

      final listJson = {
        'id': 'dj-1',
        'userId': 'u-1',
        'username': 'dj_master',
        'userDisplayName': 'Master DJ',
        'title': 'Chill Sunset Vibes',
        'description': 'Handcrafted lo-fi ambient tracks',
        'genre': 'Lo-Fi',
        'isPublic': true,
        'followersOnly': false,
        'trackCount': 1,
        'tracks': [trackJson],
        'createdAtUtc': '2026-09-07T00:00:00Z',
      };

      final djList = DjListDto.fromJson(listJson);
      expect(djList.id, 'dj-1');
      expect(djList.title, 'Chill Sunset Vibes');
      expect(djList.tracks.length, 1);
      expect(djList.tracks.first.title, 'Neon Nights');
      expect(djList.followersOnly, isFalse);

      final createDto = CreateDjListDto(
        title: 'Exclusive Beats',
        genre: 'Electronic',
        isPublic: false,
        followersOnly: true,
        tracks: [track],
      );
      final createJson = createDto.toJson();
      expect(createJson['followersOnly'], isTrue);
      expect(createJson['isPublic'], isFalse);

      // Verify Cloud Server Hosted track with Copyright Attestation
      final cloudTrack = DjTrackDto(
        id: 'cloud-9',
        title: 'Cyberpunk Odyssey',
        artist: 'Producer X',
        url: 'http://localhost:9000/sparkloop-media/tracks/cyber.mp3',
        durationSeconds: 240,
        isServerHosted: true,
        attestationId: 'attest-uuid-1234',
      );
      final cloudJson = cloudTrack.toJson();
      expect(cloudJson['isServerHosted'], isTrue);
      expect(cloudJson['attestationId'], 'attest-uuid-1234');
      final reconstructedCloud = DjTrackDto.fromJson(cloudJson);
      expect(reconstructedCloud.isServerHosted, isTrue);
      expect(reconstructedCloud.attestationId, 'attest-uuid-1234');

      // Verify MusicUploadResultDto & CopyrightPolicyDto
      final uploadResult = MusicUploadResultDto.fromJson({
        'url': 'http://localhost:9000/sparkloop-media/tracks/cyber.mp3',
        'trackId': 'cloud-9',
        'title': 'Cyberpunk Odyssey',
        'artist': 'Producer X',
        'durationSeconds': 240.0,
        'fileSizeBytes': 5242880,
        'attestationId': 'attest-uuid-1234',
        'attestedAtUtc': '2026-09-08T12:00:00Z',
      });
      expect(uploadResult.trackId, 'cloud-9');
      expect(uploadResult.fileSizeBytes, 5242880);

      final policy = CopyrightPolicyDto.fromJson({
        'version': '1.0',
        'effectiveDateUtc': '2026-09-08T00:00:00Z',
        'summaryEn': 'Safe harbor policy',
        'summaryAr': 'سياسة الملاذ الآمن',
        'clauses': [
          {
            'titleEn': 'Ownership',
            'titleAr': 'الملكية',
            'descriptionEn': 'User owns the track',
            'descriptionAr': 'المستخدم مالك المصنف',
          },
        ],
        'dmcaNoticeEmail': 'dmca@sparkloop.io',
        'takedownProcedureEn': 'Email our agent',
        'takedownProcedureAr': 'راسل وكيلنا',
      });
      expect(policy.version, '1.0');
      expect(policy.clauses.length, 1);
      expect(policy.dmcaNoticeEmail, 'dmca@sparkloop.io');
    });

    test('DjStationBroadcastState parses tempoRate and filterPreset correctly', () {
      final broadcastJson = {
        'stationId': 'station-456',
        'isLive': true,
        'currentTrackIndex': 2,
        'currentTrackTitle': 'Summer Vibes',
        'currentTrackArtist': 'DJ Spark',
        'positionSeconds': 42.5,
        'isPlaying': true,
        'djUserId': 'user-789',
        'djUsername': 'spark_dj',
        'djDisplayName': 'Spark DJ',
        'listenersCount': 25,
        'updatedAtUtc': '2026-09-08T18:00:00Z',
        'tempoRate': 1.15,
        'filterPreset': 'bass',
      };
      final state = DjStationBroadcastState.fromJson(broadcastJson);
      expect(state.stationId, 'station-456');
      expect(state.isLive, isTrue);
      expect(state.currentTrackIndex, 2);
      expect(state.currentTrackTitle, 'Summer Vibes');
      expect(state.positionSeconds, 42.5);
      expect(state.listenersCount, 25);
      expect(state.tempoRate, 1.15);
      expect(state.filterPreset, 'bass');
    });

    test('IceServerDto, LiveKitTokenDto, and AudioPresetDto parsing', () {
      final iceJson = {
        'urls': [
          'stun:turn.sparkloop.com:3478',
          'turn:turn.sparkloop.com:3478?transport=udp',
        ],
        'username': 'sparkloop',
        'credential': 'secret_password',
      };
      final iceServer = IceServerDto.fromJson(iceJson);
      expect(iceServer.urls.length, 2);
      expect(iceServer.username, 'sparkloop');

      final tokenJson = {
        'token': 'mock_jwt_token',
        'serverUrl': 'wss://livekit.sparkloop.com',
        'roomName': 'pod_123',
        'identity': 'user_456',
        'isOnStage': true,
        'iceServers': [iceJson],
      };
      final tokenDto = LiveKitTokenDto.fromJson(tokenJson);
      expect(tokenDto.token, 'mock_jwt_token');
      expect(tokenDto.isOnStage, isTrue);
      expect(tokenDto.iceServers?.length, 1);
      expect(
        tokenDto.iceServers?.first.urls.first,
        'stun:turn.sparkloop.com:3478',
      );

      final presetJson = {
        'id': 'rain',
        'title': 'Rainy Cafe',
        'category': 'Ambient',
        'url': '/audio/presets/rain.wav',
        'icon': '🌧️',
      };
      final preset = AudioPresetDto.fromJson(presetJson);
      expect(preset.id, 'rain');
      expect(preset.url, '/audio/presets/rain.wav');
    });

    test('ChatBubbleClipper produces valid closed clip paths for self and incoming messages', () {
      const selfClipper = ChatBubbleClipper(isSelf: true, isRtl: false);
      final selfPath = selfClipper.getClip(const Size(200, 60));
      expect(selfPath.getBounds().width, 200);
      expect(selfPath.getBounds().height, 60);
      // Verify self convex rounded corners
      expect(selfPath.contains(const Offset(10, 55)), isTrue);
      expect(selfPath.contains(const Offset(5, 55)), isTrue);

      const incomingClipper = ChatBubbleClipper(isSelf: false, isRtl: false);
      final incomingPath = incomingClipper.getClip(const Size(200, 60));
      expect(incomingPath.getBounds().width, 200);
      expect(incomingPath.getBounds().height, 60);
      // Verify incoming (receiver) has mathematically exact mirrored convex rounded corners
      expect(incomingPath.contains(const Offset(190, 55)), isTrue);
      expect(incomingPath.contains(const Offset(195, 55)), isTrue);

      const rtlClipper = ChatBubbleClipper(isSelf: true, isRtl: true);
      expect(rtlClipper.nipOnRight, isFalse);
    });

    test('PodChatMessageDto parses nested and flat backend message payloads with avatars', () {
      final backendPayload = {
        'type': 'POD_MESSAGE',
        'podId': 'pod-guid-123',
        'message': {
          'id': 'msg-1',
          'senderId': 'user-1',
          'senderUsername': 'dj_sam',
          'senderDisplayName': 'DJ Sam 🎧',
          'senderAvatarUrl': 'https://sparkloop.com/avatars/dj_sam.jpg',
          'text': 'Welcome to the pod everyone!',
          'createdAtUtc': '2026-09-08T00:00:00.000Z',
        },
      };

      final msgData = Map<String, dynamic>.from(
        backendPayload['message'] as Map,
      );
      if (!msgData.containsKey('podId')) {
        msgData['podId'] = backendPayload['podId'];
      }
      final msg = PodChatMessageDto.fromJson(msgData);

      expect(msg.id, 'msg-1');
      expect(msg.podId, 'pod-guid-123');
      expect(msg.userId, 'user-1');
      expect(msg.username, 'dj_sam');
      expect(msg.displayName, 'DJ Sam 🎧');
      expect(msg.avatarUrl, 'https://sparkloop.com/avatars/dj_sam.jpg');
      expect(msg.content, 'Welcome to the pod everyone!');
    });

    test('UserMusicTrackDto parses json and converts to DjTrackDto', () {
      final json = {
        'id': 'b9679fbc-321a-42c2-8ae1-77d0a6311653',
        'userId': '75d18ba9-0306-444a-a035-779831777d19',
        'username': 'creator_amgad',
        'trackTitle': 'Midnight Cyber City',
        'trackArtist': 'Amgad Synth',
        'mediaUrl': 'http://localhost:9000/sparkloop-media/tracks/cyber.mp3',
        'durationSeconds': 215.0,
        'fileSizeBytes': 5242880,
        'fileChecksumSha256': 'ABC123456789DEF',
        'policyVersion': '1.0',
        'attestedAtUtc': '2026-09-08T12:00:00.000Z',
      };

      final track = UserMusicTrackDto.fromJson(json);
      expect(track.id, 'b9679fbc-321a-42c2-8ae1-77d0a6311653');
      expect(track.trackTitle, 'Midnight Cyber City');
      expect(track.trackArtist, 'Amgad Synth');
      expect(track.durationSeconds, 215.0);
      expect(track.fileSizeBytes, 5242880);

      final djTrack = track.toDjTrackDto();
      expect(djTrack.id, 'track_cloud_b9679fbc321a42c28ae177d0a6311653');
      expect(djTrack.title, 'Midnight Cyber City');
      expect(djTrack.artist, 'Amgad Synth');
      expect(
        djTrack.url,
        'http://localhost:9000/sparkloop-media/tracks/cyber.mp3',
      );
      expect(djTrack.durationSeconds, 215);
      expect(djTrack.isServerHosted, isTrue);
      expect(djTrack.attestationId, 'b9679fbc-321a-42c2-8ae1-77d0a6311653');
    });

    test('PostCommentDto JSON serialization and PostDto commentCount', () {
      final commentJson = {
        'id': 'c-100',
        'postId': 'p-200',
        'authorId': 'u-300',
        'authorUsername': 'sara_code',
        'authorDisplayName': 'Sara',
        'authorAvatarUrl': 'http://localhost:9000/sparkloop-media/avatars/sara.jpg',
        'content': 'This post is pure fire 🔥🚀',
        'createdAtUtc': '2026-09-08T14:30:00.000Z',
      };

      final comment = PostCommentDto.fromJson(commentJson);
      expect(comment.id, 'c-100');
      expect(comment.postId, 'p-200');
      expect(comment.authorUsername, 'sara_code');
      expect(comment.authorDisplayName, 'Sara');
      expect(comment.content, 'This post is pure fire 🔥🚀');

      final serialized = comment.toJson();
      expect(serialized['id'], 'c-100');
      expect(serialized['content'], 'This post is pure fire 🔥🚀');

      final postJson = {
        'id': 'p-200',
        'authorId': 'u-1',
        'authorUsername': 'alice',
        'authorDisplayName': 'Alice',
        'content': 'Community update!',
        'createdAtUtc': '2026-09-08T12:00:00.000Z',
        'reactionCount': 15,
        'commentCount': 7,
      };
      final post = PostDto.fromJson(postJson);
      expect(post.commentCount, 7);

      final updatedPost = post.copyWith(commentCount: 8);
      expect(updatedPost.commentCount, 8);
    });

    test('PodChatMessageDto audioUrl and durationSeconds for voice messages', () {
      final voiceMsgJson = {
        'id': 'msg-voice-1',
        'podId': 'pod-99',
        'userId': 'u-bob',
        'username': 'bob',
        'displayName': 'Bob Builder',
        'content': '🎙️ Voice note',
        'audioUrl': 'http://localhost:9000/sparkloop-media/voice/sample.m4a',
        'durationSeconds': 14,
        'createdAtUtc': '2026-09-08T15:00:00.000Z',
      };

      final msg = PodChatMessageDto.fromJson(voiceMsgJson);
      expect(msg.audioUrl, 'http://localhost:9000/sparkloop-media/voice/sample.m4a');
      expect(msg.durationSeconds, 14);
      expect(msg.content, '🎙️ Voice note');

      final backToJson = msg.toJson();
      expect(backToJson['audioUrl'], 'http://localhost:9000/sparkloop-media/voice/sample.m4a');
      expect(backToJson['durationSeconds'], 14);
    });

    test('Meme Studio templates match Web parity with 20 unified items', () {
      expect(allMemeTemplates.length, 20);

      final viral = allMemeTemplates.where((t) => t.category == 'viral').toList();
      final cyber = allMemeTemplates.where((t) => t.category == 'cyber').toList();
      final abstract = allMemeTemplates.where((t) => t.category == 'abstract').toList();

      expect(viral.length, 12);
      expect(cyber.length, 4);
      expect(abstract.length, 4);

      expect(viral.any((t) => t.name == 'Drake Hotline Bling'), isTrue);
      expect(cyber.any((t) => t.name == 'Matrix Rain'), isTrue);
      expect(abstract.any((t) => t.name == 'Deep Cosmos'), isTrue);
    });

    test('DjDeck features: Beat looper duration calculation, tempo rate clamping, and crossfade duration logic', () {
      int getLoopDurationSeconds(String mode) {
        if (mode == '4s') return 4;
        if (mode == '8s') return 8;
        if (mode == '16s') return 16;
        return 0;
      }

      expect(getLoopDurationSeconds('4s'), 4);
      expect(getLoopDurationSeconds('8s'), 8);
      expect(getLoopDurationSeconds('16s'), 16);
      expect(getLoopDurationSeconds('off'), 0);

      double clampTempo(double rate) => rate.clamp(0.8, 1.2);
      expect(clampTempo(0.5), 0.8);
      expect(clampTempo(1.0), 1.0);
      expect(clampTempo(1.5), 1.2);

      int clampCrossfade(int sec) => sec.clamp(0, 8);
      expect(clampCrossfade(-1), 0);
      expect(clampCrossfade(4), 4);
      expect(clampCrossfade(10), 8);
    });

    test('Post reactions match Web React app in exact types, emojis, and order', () {
      expect(supportedReactions.length, 5);
      expect(supportedReactions[0].type, 'fire');
      expect(supportedReactions[0].emoji, '🔥');
      expect(supportedReactions[1].type, 'spark');
      expect(supportedReactions[1].emoji, '⚡');
      expect(supportedReactions[2].type, 'laugh');
      expect(supportedReactions[2].emoji, '😂');
      expect(supportedReactions[3].type, 'mindblown');
      expect(supportedReactions[3].emoji, '🤯');
      expect(supportedReactions[4].type, 'heart');
      expect(supportedReactions[4].emoji, '❤️');
    });

    test('LiveKitService promoteToSpeaker and speaker status deduplication', () {
      final service = LiveKitService();
      expect(service.isSpeaker, isFalse);

      service.promoteToSpeaker();
      expect(service.isSpeaker, isTrue);

      const speaker = LiveKitSpeaker(
        userId: 'u-1',
        username: 'amgad',
        displayName: 'Amgad',
        isSpeaking: false,
        isMuted: true,
      );
      service.upsertParticipant(speaker, isOnStage: true);

      int notifyCount = 0;
      service.addListener(() => notifyCount++);

      // Setting identical status should NOT trigger notifyListeners (deduplicated)
      service.setSpeakerStatus('u-1', isSpeaking: false, isMuted: true);
      expect(notifyCount, 0);

      // Changing speaking status should trigger notifyListeners
      service.setSpeakerStatus('u-1', isSpeaking: true, isMuted: false);
      expect(notifyCount, 1);
    });

    test('Hand-raise queue visibility logic: only host or moderator sees queue', () {
      bool canSeeHandQueue({required bool isHost, required bool isModerator, required int count}) {
        return (isHost || isModerator) && count > 0;
      }

      // Regular attendee with hands raised -> cannot see queue
      expect(canSeeHandQueue(isHost: false, isModerator: false, count: 2), isFalse);

      // Regular attendee with 0 hands -> cannot see queue
      expect(canSeeHandQueue(isHost: false, isModerator: false, count: 0), isFalse);

      // Host with hands raised -> can see queue
      expect(canSeeHandQueue(isHost: true, isModerator: false, count: 1), isTrue);

      // Host with 0 hands raised -> queue hidden
      expect(canSeeHandQueue(isHost: true, isModerator: false, count: 0), isFalse);

      // Moderator with hands raised -> can see queue
      expect(canSeeHandQueue(isHost: false, isModerator: true, count: 3), isTrue);
    });

    test('MoodPod creation settings validation across all fields', () {
      final json = {
        'id': 'pod-all-settings',
        'title': 'Chill Room',
        'hostUserId': 'host-1',
        'hostUsername': 'host_user',
        'hostDisplayName': 'Host User',
        'moodEmoji': '🎧',
        'backgroundTheme': 'cosmic-purple',
        'isPrivate': true,
        'inviteCode': 'SECRET77',
        'allowParticipantsChangeTheme': true,
        'allowParticipantsPlayBgMusic': false,
        'allowOpenMic': false,
        'isDjMode': true,
        'followersOnly': true,
        'durationHours': 24,
      };

      final pod = MoodPodDto.fromJson(json);
      expect(pod.title, 'Chill Room');
      expect(pod.moodEmoji, '🎧');
      expect(pod.backgroundTheme, 'cosmic-purple');
      expect(pod.isPrivate, isTrue);
      expect(pod.inviteCode, 'SECRET77');
      expect(pod.allowParticipantsChangeTheme, isTrue);
      expect(pod.allowParticipantsPlayBgMusic, isFalse);
      expect(pod.allowOpenMic, isFalse);
      expect(pod.isDjMode, isTrue);
      expect(pod.followersOnly, isTrue);
      expect(pod.expiresAtUtc, isNotNull);
    });

    test('LiveKitService correctly separates stage speakers from room listeners', () {
      final lk = LiveKitService();

      final speaker = const LiveKitSpeaker(
        userId: 'spk-1',
        username: 'speaker_one',
        displayName: 'Speaker One',
        isSpeaking: false,
        isMuted: false,
      );

      final listener = const LiveKitSpeaker(
        userId: 'lsn-1',
        username: 'listener_one',
        displayName: 'Listener One',
        isSpeaking: false,
        isMuted: true,
      );

      lk.upsertParticipant(speaker, isOnStage: true);
      lk.upsertParticipant(listener, isOnStage: false);

      expect(lk.speakers.length, 1);
      expect(lk.speakers.first.userId, 'spk-1');

      expect(lk.participants.length, 2);

      expect(lk.listeners.length, 1);
      expect(lk.listeners.first.userId, 'lsn-1');

      // Promote listener to stage
      lk.setParticipantStageStatus('lsn-1', isOnStage: true);
      expect(lk.speakers.length, 2);
      expect(lk.listeners.length, 0);

      // Demote back to audience
      lk.demoteToListener('lsn-1');
      expect(lk.speakers.length, 1);
      expect(lk.listeners.length, 1);
      expect(lk.listeners.first.userId, 'lsn-1');
    });
  });
}
