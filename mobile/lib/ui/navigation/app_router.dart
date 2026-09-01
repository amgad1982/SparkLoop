import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/views/login_screen.dart';
import '../features/auth/views/register_screen.dart';
import '../features/auth/views/verify_email_screen.dart';
import '../features/chains/views/chain_detail_screen.dart';
import '../features/chains/views/chains_screen.dart';
import '../features/feed/views/feed_screen.dart';
import '../features/meme_canvas/views/meme_canvas_screen.dart';
import '../features/pods/views/pod_room_screen.dart';
import '../features/pods/views/pods_screen.dart';
import '../features/profile/views/profile_screen.dart';
import '../features/profile/views/settings_screen.dart';
import '../features/search/views/search_screen.dart';
import '../features/shell/mobile_app_shell.dart';

final GlobalKey<NavigatorState> _rootNavigatorKey = GlobalKey<NavigatorState>();

final GoRouter appRouter = GoRouter(
  navigatorKey: _rootNavigatorKey,
  initialLocation: '/feed',
  routes: [
    // 4-Tab Navigation Shell
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) {
        return MobileAppShell(navigationShell: navigationShell);
      },
      branches: [
        // 0. Feed Branch
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/feed',
              builder: (context, state) => const FeedScreen(),
            ),
          ],
        ),

        // 1. Meme Lab / Canvas Studio Branch
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/create',
              builder: (context, state) => const MemeCanvasScreen(),
            ),
          ],
        ),

        // 2. Chains Branch
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/chains',
              builder: (context, state) => const ChainsScreen(),
            ),
          ],
        ),

        // 3. Pods Branch
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/pods',
              builder: (context, state) => const PodsScreen(),
            ),
          ],
        ),
      ],
    ),

    // Subscreens & Modals outside main shell
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/chains/:id',
      builder: (context, state) => ChainDetailScreen(
        chainId: state.pathParameters['id']!,
      ),
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/pods/:id',
      builder: (context, state) => PodRoomScreen(
        podId: state.pathParameters['id']!,
      ),
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/profile',
      builder: (context, state) => const ProfileScreen(),
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/settings',
      builder: (context, state) => const SettingsScreen(),
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/search',
      builder: (context, state) => const SearchScreen(),
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/register',
      builder: (context, state) => const RegisterScreen(),
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/verify-email',
      builder: (context, state) {
        final email = state.uri.queryParameters['email'] ?? '';
        return VerifyEmailScreen(email: email);
      },
    ),
  ],
);
