import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../data/models/dj_list_models.dart';
import '../../../../data/services/api_service.dart';
import '../../../core/theme/app_colors.dart';
import '../view_models/dj_deck_view_model.dart';
import 'music_copyright_dialog.dart';

class UserMusicLibraryView extends StatefulWidget {
  final VoidCallback onNavigateToCreateStation;

  const UserMusicLibraryView({
    super.key,
    required this.onNavigateToCreateStation,
  });

  @override
  State<UserMusicLibraryView> createState() => _UserMusicLibraryViewState();
}

class _UserMusicLibraryViewState extends State<UserMusicLibraryView> {
  final TextEditingController _searchController = TextEditingController();
  bool _isUploading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<DjDeckViewModel>().loadMyTracks();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _pickAndUploadAudio() async {
    try {
      final result = await FilePickerPlatform.instance.pickFiles(
        type: FileType.audio,
      );

      if (result.isEmpty || !mounted) return;

      final validFiles = result
          .where((f) => f.path != null && File(f.path!).existsSync())
          .map((f) => File(f.path!))
          .toList();

      if (validFiles.isEmpty || !mounted) return;

      final fileNames = validFiles.map((f) => f.path.split(Platform.pathSeparator).last).toList();

      final agreed = await MusicCopyrightDialog.show(
        context,
        fileNames: fileNames,
      );

      if (agreed != true || !mounted) return;

      setState(() => _isUploading = true);

      final api = context.read<ApiService>();
      final djVm = context.read<DjDeckViewModel>();
      int uploadedCount = 0;

      for (final file in validFiles) {
        final cleanTitle = file.path.split(Platform.pathSeparator).last.replaceAll(RegExp(r'\.[^.]+$'), '');
        try {
          await api.uploadMusicTrack(
            file: file,
            title: cleanTitle,
            artist: 'My Audio Track',
            durationSeconds: 180,
            acceptCopyrightPolicy: true,
            policyVersion: '1.0',
          );
          uploadedCount++;
        } catch (e) {
          debugPrint('Error uploading audio track: $e');
        }
      }

      await djVm.loadMyTracks();

      if (mounted) {
        final isArabic = Localizations.localeOf(context).languageCode == 'ar';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              isArabic
                ? 'تم رفع $uploadedCount من أصل ${validFiles.length} مقاطع بنجاح وتوثيق الملكية'
                : 'Successfully uploaded $uploadedCount of ${validFiles.length} tracks to cloud',
            ),
            backgroundColor: AppColors.accentCyan,
          ),
        );
      }
    } catch (e) {
      debugPrint('Error in _pickAndUploadAudio: $e');
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  Future<void> _confirmDelete(BuildContext context, UserMusicTrackDto track) async {
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.delete_outline, color: AppColors.error, size: 22),
            const SizedBox(width: 8),
            Text(isArabic ? 'حذف المقطع الصوتي' : 'Delete Audio Track'),
          ],
        ),
        content: Text(
          isArabic
              ? 'هل أنت متأكد من حذف "${track.trackTitle}" من مكتبتك السحابية؟ سيتم حذفه نهائياً من الخادم.'
              : 'Are you sure you want to delete "${track.trackTitle}" from your cloud library? It will be removed from servers.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(isArabic ? 'إلغاء' : 'Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(isArabic ? 'حذف' : 'Delete', style: const TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      final djVm = Provider.of<DjDeckViewModel>(this.context, listen: false);
      final messenger = ScaffoldMessenger.of(this.context);
      final ok = await djVm.deleteMyTrack(track.id);
      if (mounted) {
        messenger.showSnackBar(
          SnackBar(
            content: Text(
              ok
                  ? (isArabic ? 'تم حذف المقطع الصوتي بنجاح' : 'Track deleted successfully')
                  : (isArabic ? 'فشل حذف المقطع' : 'Failed to delete track'),
            ),
            backgroundColor: ok ? AppColors.accentCyan : AppColors.error,
          ),
        );
      }
    }
  }

  String _formatDuration(double seconds) {
    final s = seconds.toInt();
    final m = s ~/ 60;
    final rem = s % 60;
    return '$m:${rem.toString().padLeft(2, '0')}';
  }

  String _formatBytes(int bytes) {
    if (bytes <= 0) return '0 B';
    const kb = 1024;
    const mb = kb * 1024;
    if (bytes >= mb) {
      return '${(bytes / mb).toStringAsFixed(1)} MB';
    }
    return '${(bytes / kb).toStringAsFixed(0)} KB';
  }

  @override
  Widget build(BuildContext context) {
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final djVm = context.watch<DjDeckViewModel>();

    final query = _searchController.text.trim().toLowerCase();
    final filteredTracks = djVm.myTracks.where((t) {
      if (query.isEmpty) return true;
      return t.trackTitle.toLowerCase().contains(query) ||
          t.trackArtist.toLowerCase().contains(query);
    }).toList();

    return Column(
      children: [
        // Header Banner & Upload Action
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isDark
                    ? [const Color(0xFF1E1B4B), const Color(0xFF0F172A)]
                    : [const Color(0xFFEEF2FF), const Color(0xFFF8FAFC)],
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: AppColors.accentCyan.withValues(alpha: 0.3),
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.accentCyan.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.library_music_rounded, color: AppColors.accentCyan, size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            isArabic ? 'مكتبتي الموسيقية السحابية' : 'My Cloud Music Library',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                            decoration: BoxDecoration(
                              color: Colors.amber.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              'DMCA Safe',
                              style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.amber),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        isArabic
                            ? '${djVm.myTracks.length} مقطع مخزن وموثق قانونياً'
                            : '${djVm.myTracks.length} tracks attested and hosted on server',
                        style: TextStyle(
                          fontSize: 11,
                          color: isDark ? Colors.white60 : Colors.black54,
                        ),
                      ),
                    ],
                  ),
                ),
                ElevatedButton.icon(
                  onPressed: _isUploading ? null : _pickAndUploadAudio,
                  icon: _isUploading
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.cloud_upload_outlined, size: 16),
                  label: Text(
                    isArabic ? 'رفع جديد' : 'Upload',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.accentCyan,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ],
            ),
          ),
        ),

        // Search Bar
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          child: TextField(
            controller: _searchController,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText: isArabic ? 'ابحث في مكتبتك...' : 'Search your tracks...',
              prefixIcon: const Icon(Icons.search, size: 20),
              suffixIcon: _searchController.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 18),
                      onPressed: () => setState(() => _searchController.clear()),
                    )
                  : null,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            ),
          ),
        ),

        // Track List
        Expanded(
          child: djVm.isLoadingMyTracks
              ? const Center(child: CircularProgressIndicator())
              : filteredTracks.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.music_off_outlined, size: 52, color: Colors.grey),
                          const SizedBox(height: 12),
                          Text(
                            djVm.myTracks.isEmpty
                                ? (isArabic ? 'لا توجد مقاطع موسيقية في مكتبتك بعد' : 'No uploaded tracks in your library yet')
                                : (isArabic ? 'لا توجد نتائج مطابقة لبحثك' : 'No tracks match your search'),
                            style: const TextStyle(color: Colors.grey, fontSize: 13),
                          ),
                          const SizedBox(height: 12),
                          if (djVm.myTracks.isEmpty)
                            ElevatedButton.icon(
                              onPressed: _pickAndUploadAudio,
                              icon: const Icon(Icons.cloud_upload_outlined, size: 16),
                              label: Text(isArabic ? 'رفع أول مقطع الآن' : 'Upload First Track'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.accentCyan,
                                foregroundColor: Colors.white,
                              ),
                            ),
                        ],
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(14, 8, 14, 24),
                      itemCount: filteredTracks.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final track = filteredTracks[index];
                        final isPreviewThis = djVm.previewTrackId == track.id && djVm.isPreviewPlaying;

                        return Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: isPreviewThis
                                ? AppColors.accentCyan.withValues(alpha: 0.12)
                                : (isDark ? AppColors.surfaceDark : Colors.white),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: isPreviewThis
                                  ? AppColors.accentCyan.withValues(alpha: 0.5)
                                  : (isDark ? Colors.white12 : Colors.black12),
                            ),
                          ),
                          child: Row(
                            children: [
                              // Play / Pause Preview Button
                              IconButton(
                                style: IconButton.styleFrom(
                                  backgroundColor: isPreviewThis
                                      ? AppColors.accentCyan
                                      : (isDark ? Colors.white10 : Colors.black.withValues(alpha: 0.05)),
                                  foregroundColor: isPreviewThis ? Colors.white : AppColors.accentCyan,
                                ),
                                icon: Icon(
                                  isPreviewThis ? Icons.pause_rounded : Icons.play_arrow_rounded,
                                  size: 22,
                                ),
                                onPressed: () => djVm.toggleTrackPreview(track),
                              ),
                              const SizedBox(width: 10),

                              // Track Details
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      track.trackTitle,
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      '${track.trackArtist} • ${_formatDuration(track.durationSeconds)} • ${_formatBytes(track.fileSizeBytes)}',
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: isDark ? Colors.white60 : Colors.black54,
                                      ),
                                    ),
                                  ],
                                ),
                              ),

                              // Delete Action
                              IconButton(
                                icon: const Icon(Icons.delete_outline, size: 20, color: AppColors.error),
                                onPressed: () => _confirmDelete(context, track),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
        ),
      ],
    );
  }
}
