import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../../data/models/chain_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/avatar_badge.dart';
import '../../../core/widgets/glass_container.dart';
import '../../auth/view_models/auth_view_model.dart';
import '../view_models/chain_view_model.dart';
import 'create_chain_dialog.dart';

class ChainsScreen extends StatelessWidget {
  const ChainsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final chainVm = context.watch<ChainViewModel>();
    final authVm = context.watch<AuthViewModel>();
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          if (!authVm.isAuthenticated) {
            context.push('/login');
          } else {
            CreateChainDialog.show(context);
          }
        },
        icon: const Icon(Icons.add),
        label: Text(isArabic ? 'بدء سلسلة' : 'Start Chain'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
      ),
      body: RefreshIndicator(
        onRefresh: () => chainVm.fetchChains(),
        color: AppColors.primary,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
          slivers: [
            // Header Banner
            SliverToBoxAdapter(
              child: GlassContainer(
                margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                padding: const EdgeInsets.all(16),
                borderRadius: 20,
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(Icons.alt_route, color: AppColors.primaryLight, size: 24),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isArabic ? 'سلاسل قصة المايك المتتابع' : 'Pass-The-Mic Story Chains',
                            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14.5),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            isArabic
                                ? 'قصص جماعية يكتبها ويسجلها المبدعون دوراً بدور!'
                                : 'Collaborative storylines created beat by beat!',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Chains List
            if (chainVm.isLoading && chainVm.chains.isEmpty)
              const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
              )
            else if (chainVm.chains.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.alt_route, size: 48, color: Colors.grey),
                      const SizedBox(height: 12),
                      Text(
                        isArabic ? 'لا توجد سلاسل قصص نشطة' : 'No story chains yet',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
              )
            else
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final chain = chainVm.chains[index];
                    return _buildChainCard(context, chain, isArabic);
                  },
                  childCount: chainVm.chains.length,
                ),
              ),

            const SliverToBoxAdapter(child: SizedBox(height: 90)),
          ],
        ),
      ),
    );
  }

  Widget _buildChainCard(BuildContext context, ChainDto chain, bool isArabic) {
    return GestureDetector(
      onTap: () => context.push('/chains/${chain.id}'),
      child: GlassContainer(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        padding: const EdgeInsets.all(16),
        borderRadius: 20,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                AvatarBadge(
                  avatarUrl: chain.creatorAvatarUrl,
                  username: chain.creatorUsername,
                  size: 32,
                  showBorder: false,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        chain.title,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      Text(
                        'by @${chain.creatorUsername}',
                        style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: chain.isCompleted
                        ? AppColors.accentEmerald.withValues(alpha: 0.15)
                        : AppColors.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    chain.isCompleted ? (isArabic ? 'مكتملة' : 'Completed') : (isArabic ? 'نشطة' : 'Active'),
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: chain.isCompleted ? AppColors.accentEmerald : AppColors.primaryLight,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Progress bar
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: chain.turns.isEmpty ? 0.1 : chain.turns.length / chain.maxTurns,
                backgroundColor: AppColors.surfaceDark,
                color: AppColors.primary,
                minHeight: 6,
              ),
            ),
            const SizedBox(height: 8),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${chain.turns.length} / ${chain.maxTurns} ${isArabic ? 'أدوار' : 'turns'}',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                ),
                Text(
                  isArabic ? 'اضغط للقراءة والتفاعل ➔' : 'Tap to read & pass ➔',
                  style: const TextStyle(fontSize: 11, color: AppColors.primaryLight, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
