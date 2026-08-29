import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'data/repositories/auth_repository.dart';
import 'data/repositories/chain_repository.dart';
import 'data/repositories/feed_repository.dart';
import 'data/repositories/follow_repository.dart';
import 'data/repositories/pod_repository.dart';
import 'data/repositories/spark_repository.dart';
import 'data/repositories/user_repository.dart';
import 'data/services/api_service.dart';
import 'data/services/centrifugo_service.dart';
import 'data/services/livekit_service.dart';
import 'data/services/storage_service.dart';
import 'l10n/generated/app_localizations.dart';
import 'ui/core/theme/app_theme.dart';
import 'ui/features/auth/view_models/auth_view_model.dart';
import 'ui/features/chains/view_models/chain_view_model.dart';
import 'ui/features/feed/view_models/feed_view_model.dart';
import 'ui/features/follow/view_models/follow_view_model.dart';
import 'ui/features/meme_canvas/view_models/meme_canvas_view_model.dart';
import 'ui/features/pods/view_models/pod_view_model.dart';
import 'ui/features/profile/view_models/profile_view_model.dart';
import 'ui/features/search/view_models/search_view_model.dart';
import 'ui/features/sparks/view_models/spark_view_model.dart';
import 'ui/features/theme/theme_view_model.dart';
import 'ui/navigation/app_router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 1. Initialize Storage & Core Services
  final storageService = StorageService();
  await storageService.init();

  final apiService = ApiService(storage: storageService);
  final centrifugoService = CentrifugoService(apiService: apiService);
  final liveKitService = LiveKitService();

  // Connect to Centrifugo WebSocket
  centrifugoService.connect();

  // 2. Initialize Repositories
  final authRepository = AuthRepository(
    apiService: apiService,
    storageService: storageService,
  );
  final feedRepository = FeedRepository(apiService: apiService);
  final sparkRepository = SparkRepository(apiService: apiService);
  final chainRepository = ChainRepository(apiService: apiService);
  final podRepository = PodRepository(apiService: apiService);
  final userRepository = UserRepository(apiService: apiService);
  final followRepository = FollowRepository(apiService: apiService);

  runApp(
    MultiProvider(
      providers: [
        // Services
        Provider<StorageService>.value(value: storageService),
        Provider<ApiService>.value(value: apiService),
        ChangeNotifierProvider<LiveKitService>.value(value: liveKitService),
        ChangeNotifierProvider<CentrifugoService>.value(value: centrifugoService),

        // Repositories
        Provider<AuthRepository>.value(value: authRepository),
        Provider<FeedRepository>.value(value: feedRepository),
        Provider<SparkRepository>.value(value: sparkRepository),
        Provider<ChainRepository>.value(value: chainRepository),
        Provider<PodRepository>.value(value: podRepository),
        Provider<UserRepository>.value(value: userRepository),
        Provider<FollowRepository>.value(value: followRepository),

        // ViewModels
        ChangeNotifierProvider<ThemeViewModel>(
          create: (_) => ThemeViewModel(storageService: storageService),
        ),
        ChangeNotifierProvider<AuthViewModel>(
          create: (_) => AuthViewModel(authRepository: authRepository),
        ),
        ChangeNotifierProvider<FollowViewModel>(
          create: (_) => FollowViewModel(followRepository: followRepository),
        ),
        ChangeNotifierProvider<FeedViewModel>(
          create: (_) => FeedViewModel(
            feedRepository: feedRepository,
            centrifugoService: centrifugoService,
          ),
        ),
        ChangeNotifierProvider<SparkViewModel>(
          create: (_) => SparkViewModel(
            sparkRepository: sparkRepository,
            feedRepository: feedRepository,
            centrifugoService: centrifugoService,
          ),
        ),
        ChangeNotifierProvider<ChainViewModel>(
          create: (_) => ChainViewModel(
            chainRepository: chainRepository,
            feedRepository: feedRepository,
            centrifugoService: centrifugoService,
          ),
        ),
        ChangeNotifierProvider<PodViewModel>(
          create: (_) => PodViewModel(
            podRepository: podRepository,
            userRepository: userRepository,
            centrifugoService: centrifugoService,
            liveKitService: liveKitService,
          ),
        ),
        ChangeNotifierProvider<MemeCanvasViewModel>(
          create: (_) => MemeCanvasViewModel(),
        ),
        ChangeNotifierProvider<ProfileViewModel>(
          create: (_) => ProfileViewModel(
            userRepository: userRepository,
            followRepository: followRepository,
          ),
        ),
        ChangeNotifierProvider<SearchViewModel>(
          create: (_) => SearchViewModel(userRepository: userRepository),
        ),
      ],
      child: const SparkLoopMobileApp(),
    ),
  );
}

class SparkLoopMobileApp extends StatelessWidget {
  const SparkLoopMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    final themeVm = context.watch<ThemeViewModel>();

    return MaterialApp.router(
      title: 'SparkLoop',
      debugShowCheckedModeBanner: false,
      routerConfig: appRouter,
      themeMode: themeVm.themeMode,
      theme: AppTheme.lightTheme(context, isArabic: themeVm.isArabic),
      darkTheme: AppTheme.darkTheme(context, isArabic: themeVm.isArabic),
      locale: themeVm.locale,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
    );
  }
}
