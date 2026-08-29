import 'package:flutter_test/flutter_test.dart';
import 'package:sparkloop_mobile/data/models/auth_models.dart';
import 'package:sparkloop_mobile/data/models/pod_models.dart';
import 'package:sparkloop_mobile/data/models/post_models.dart';
import 'package:sparkloop_mobile/data/models/search_models.dart';
import 'package:sparkloop_mobile/data/models/spark_models.dart';

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

    test('SparkDto voting calculation', () {
      final spark = SparkDto(
        id: 's-1',
        title: 'Tech Struggles 2026',
        description: 'Best meme about CI/CD pipelines',
        totalVotes: 10,
        totalSubmissions: 2,
        expiresAtUtc: DateTime.now().toUtc().add(const Duration(hours: 12)),
        createdAtUtc: DateTime.now().toUtc(),
      );

      expect(spark.totalVotes, 10);
      expect(spark.isActive, isTrue);
    });

    test('GlobalSearchResultDto JSON parsing and multi-category results', () {
      final json = {
        'query': 'spark',
        'totalCount': 5,
        'posts': [
          {
            'id': 'p-10',
            'authorId': 'u-1',
            'authorUsername': 'alice',
            'authorDisplayName': 'Alice',
            'content': 'Loving the daily spark challenges! #spark',
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
        'sparks': [
          {
            'id': 's-2',
            'title': 'Daily Spark Mania',
            'prompt': 'Create your best tech meme',
            'category': 'Meme',
            'activeFromUtc': '2026-08-28T00:00:00Z',
            'activeUntilUtc': '2026-08-29T00:00:00Z',
            'submissions': [],
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
          {'tag': 'spark', 'count': 5},
          {'tag': 'sparkloop', 'count': 2},
        ],
      };

      final result = GlobalSearchResultDto.fromJson(json);
      expect(result.query, 'spark');
      expect(result.posts.length, 1);
      expect(result.users.length, 1);
      expect(result.sparks.length, 1);
      expect(result.pods.length, 1);
      expect(result.hashtags, contains('spark'));
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
    });
  });
}
