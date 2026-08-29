import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../../data/models/pod_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/avatar_badge.dart';
import '../../../core/widgets/glass_container.dart';
import '../../auth/view_models/auth_view_model.dart';
import '../view_models/pod_view_model.dart';
import 'create_pod_dialog.dart';

class PodsScreen extends StatelessWidget {
  const PodsScreen({super.key});

  void _showJoinByCodeDialog(BuildContext context) {
    final controller = TextEditingController();
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    String? errorText;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Row(
            children: [
              const Icon(Icons.key, color: AppColors.accentEmerald, size: 20),
              const SizedBox(width: 8),
              Text(isArabic ? 'الانضمام برمز الدعوة' : 'Join by Invite Code'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                isArabic
                    ? 'أدخل رمز دعوة الحجرة الخاصة المكون من 6 إلى 8 أحرف:'
                    : 'Enter the 6-8 character invite code for the private pod:',
                style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                textCapitalization: TextCapitalization.characters,
                autofocus: true,
                onChanged: (_) {
                  if (errorText != null) {
                    setDialogState(() => errorText = null);
                  }
                },
                decoration: InputDecoration(
                  hintText: 'SPARK-1234',
                  prefixIcon: const Icon(Icons.lock_open, size: 18),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  errorText: errorText,
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(isArabic ? 'إلغاء' : 'Cancel'),
            ),
            FilledButton(
              onPressed: () async {
                final code = controller.text.trim();
                if (code.isEmpty) {
                  setDialogState(() {
                    errorText = isArabic ? 'يرجى إدخال رمز الدعوة' : 'Please enter an invite code';
                  });
                  return;
                }
                if (code.length < 4) {
                  setDialogState(() {
                    errorText = isArabic ? 'رمز الدعوة قصير جداً' : 'Invite code is too short';
                  });
                  return;
                }
                Navigator.pop(ctx);

                final authVm = context.read<AuthViewModel>();
                final podVm = context.read<PodViewModel>();

                final pod = await podVm.joinByCode(
                  code,
                  currentUserId: authVm.currentUser?.id ?? authVm.currentPersona.id,
                  currentUsername: authVm.currentUser?.username ?? authVm.currentPersona.username,
                  currentDisplayName: authVm.currentUser?.displayName ?? authVm.currentPersona.displayName,
                  currentAvatarUrl: authVm.currentUser?.avatarUrl ?? authVm.currentPersona.avatarUrl,
                );

                if (pod != null && context.mounted) {
                  context.push('/pods/${pod.id}');
                } else if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(isArabic ? 'رمز الدعوة غير صحيح أو الغرفة مغلقة' : 'Invalid invite code or pod closed'),
                      backgroundColor: AppColors.error,
                    ),
                  );
                }
              },
              style: FilledButton.styleFrom(backgroundColor: AppColors.accentEmerald),
              child: Text(isArabic ? 'انضمام' : 'Join Room'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final podVm = context.watch<PodViewModel>();
    final authVm = context.watch<AuthViewModel>();
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          if (!authVm.isAuthenticated) {
            context.push('/login');
          } else {
            CreatePodDialog.show(context);
          }
        },
        icon: const Icon(Icons.radio),
        label: Text(isArabic ? 'إنشاء حجرة' : 'Host Pod'),
        backgroundColor: AppColors.accentEmerald,
        foregroundColor: Colors.black,
      ),
      body: RefreshIndicator(
        onRefresh: () => podVm.fetchPods(),
        color: AppColors.accentEmerald,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
          slivers: [
            // Header Banner & Join via Code Button
            SliverToBoxAdapter(
              child: GlassContainer(
                margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                padding: const EdgeInsets.all(16),
                borderRadius: 20,
                customBorderColor: AppColors.accentEmerald.withValues(alpha: 0.3),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            gradient: AppColors.podLiveGradient,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(Icons.radio, color: Colors.white, size: 24),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                isArabic ? 'غرف المزاج والبث الصوتي' : 'Live Mood Pods',
                                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                isArabic
                                    ? 'غرف صوتية تفاعلية مع أجواء موسيقية وميمز!'
                                    : 'Live audio stages for deep talks, vibes & banter!',
                                style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => _showJoinByCodeDialog(context),
                            icon: const Icon(Icons.key, size: 16, color: AppColors.accentEmerald),
                            label: Text(
                              isArabic ? 'انضمام برمز دعوة' : 'Join with Code',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.accentEmerald),
                            ),
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(color: AppColors.accentEmerald.withValues(alpha: 0.4)),
                              padding: const EdgeInsets.symmetric(vertical: 8),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // Pods Grid
            if (podVm.isLoading && podVm.pods.isEmpty)
              const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator(color: AppColors.accentEmerald)),
              )
            else if (podVm.pods.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.radio, size: 48, color: Colors.grey),
                      const SizedBox(height: 12),
                      Text(
                        isArabic ? 'لا توجد غرف مزاج نشطة حالياً' : 'No active Mood Pods right now',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        isArabic ? 'كن أول من يطلق غرفة بث!' : 'Be the first to start a live audio stage!',
                        style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 0.85,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final pod = podVm.pods[index];
                      return _buildPodCard(context, pod, isArabic);
                    },
                    childCount: podVm.pods.length,
                  ),
                ),
              ),

            const SliverToBoxAdapter(child: SizedBox(height: 90)),
          ],
        ),
      ),
    );
  }

  Widget _buildPodCard(BuildContext context, MoodPodDto pod, bool isArabic) {
    return GestureDetector(
      onTap: () => context.push('/pods/${pod.id}'),
      child: GlassContainer(
        padding: const EdgeInsets.all(14),
        borderRadius: 22,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.accentEmerald.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.accentEmerald.withValues(alpha: 0.4)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(pod.moodEmoji, style: const TextStyle(fontSize: 12)),
                      const SizedBox(width: 4),
                      Text(
                        pod.vibe,
                        style: const TextStyle(
                          color: AppColors.accentEmerald,
                          fontSize: 9.5,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
                Row(
                  children: [
                    if (pod.isPrivate) ...[
                      const Icon(Icons.lock, size: 11, color: AppColors.primaryLight),
                      const SizedBox(width: 4),
                    ],
                    const Icon(Icons.people_alt_outlined, size: 12, color: Color(0xFF94A3B8)),
                    const SizedBox(width: 2),
                    Text(
                      '${pod.participantCount}',
                      style: const TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8)),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 10),

            Text(
              pod.title,
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13.5),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const Spacer(),

            Row(
              children: [
                AvatarBadge(
                  avatarUrl: pod.hostAvatarUrl,
                  username: pod.hostUsername,
                  size: 26,
                  showBorder: false,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    pod.hostDisplayName,
                    style: const TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8)),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
