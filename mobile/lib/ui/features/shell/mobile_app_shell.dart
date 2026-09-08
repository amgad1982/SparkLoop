import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../dj_deck/widgets/dj_mini_player.dart';
import 'bottom_nav_bar.dart';
import 'top_app_header.dart';

class MobileAppShell extends StatelessWidget {
  const MobileAppShell({
    super.key,
    required this.navigationShell,
  });

  final StatefulNavigationShell navigationShell;

  void _onTabSelected(int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentRoute = GoRouterState.of(context).uri.toString();

    return Scaffold(
      appBar: TopAppHeader(currentRoute: currentRoute),
      body: Stack(
        children: [
          navigationShell,
          const Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: DjMiniPlayer(),
          ),
        ],
      ),
      bottomNavigationBar: BottomNavBar(
        currentIndex: navigationShell.currentIndex,
        onTap: _onTabSelected,
      ),
    );
  }
}
