import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../data/models/dj_list_models.dart';
import '../../../core/theme/app_colors.dart';
import '../view_models/dj_deck_view_model.dart';

class TrackLibrarySelectorBottomSheet extends StatefulWidget {
  final List<String> alreadySelectedUrls;
  final ValueChanged<List<DjTrackDto>> onTracksSelected;
  final VoidCallback onOpenUpload;

  const TrackLibrarySelectorBottomSheet({
    super.key,
    required this.alreadySelectedUrls,
    required this.onTracksSelected,
    required this.onOpenUpload,
  });

  static Future<void> show({
    required BuildContext context,
    required List<String> alreadySelectedUrls,
    required ValueChanged<List<DjTrackDto>> onTracksSelected,
    required VoidCallback onOpenUpload,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => TrackLibrarySelectorBottomSheet(
        alreadySelectedUrls: alreadySelectedUrls,
        onTracksSelected: onTracksSelected,
        onOpenUpload: onOpenUpload,
      ),
    );
  }

  @override
  State<TrackLibrarySelectorBottomSheet> createState() => _TrackLibrarySelectorBottomSheetState();
}

class _TrackLibrarySelectorBottomSheetState extends State<TrackLibrarySelectorBottomSheet> {
  final TextEditingController _searchController = TextEditingController();
  final Set<String> _selectedTrackIds = {};

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

  String _formatDuration(double seconds) {
    final s = seconds.toInt();
    final m = s ~/ 60;
    final rem = s % 60;
    return '$m:${rem.toString().padLeft(2, '0')}';
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

    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F172A) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 20,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: Column(
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 6),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.accentCyan.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.library_music_rounded, color: AppColors.accentCyan, size: 20),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isArabic ? 'اختر من مكتبتك السحابية' : 'Select from Cloud Library',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                      Text(
                        isArabic ? 'المقاطع المحفوظة مسبقاً والموثقة' : 'Pre-uploaded and attested tracks',
                        style: TextStyle(
                          fontSize: 11,
                          color: isDark ? Colors.white60 : Colors.black54,
                        ),
                      ),
                    ],
                  ),
                ),
                TextButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    widget.onOpenUpload();
                  },
                  icon: const Icon(Icons.cloud_upload_outlined, size: 16),
                  label: Text(isArabic ? 'رفع جديد' : 'Upload'),
                ),
              ],
            ),
          ),

          // Search Bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
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

          const Divider(height: 1),

          // Tracks List
          Expanded(
            child: djVm.isLoadingMyTracks
                ? const Center(child: CircularProgressIndicator())
                : filteredTracks.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.music_off_outlined, size: 48, color: Colors.grey),
                            const SizedBox(height: 10),
                            Text(
                              djVm.myTracks.isEmpty
                                  ? (isArabic ? 'لا توجد مقاطع في مكتبتك السحابية' : 'No tracks in your library yet')
                                  : (isArabic ? 'لا توجد نتائج مطابقة لبحثك' : 'No tracks match your search'),
                              style: const TextStyle(color: Colors.grey, fontSize: 13),
                            ),
                          ],
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        itemCount: filteredTracks.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final track = filteredTracks[index];
                          final isSelected = _selectedTrackIds.contains(track.id);
                          final isAlreadyInStation = widget.alreadySelectedUrls.contains(track.mediaUrl);

                          return InkWell(
                            borderRadius: BorderRadius.circular(14),
                            onTap: isAlreadyInStation
                                ? null
                                : () {
                                    setState(() {
                                      if (isSelected) {
                                        _selectedTrackIds.remove(track.id);
                                      } else {
                                        _selectedTrackIds.add(track.id);
                                      }
                                    });
                                  },
                            child: Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? AppColors.accentCyan.withValues(alpha: 0.12)
                                    : (isAlreadyInStation
                                        ? (isDark ? Colors.white.withValues(alpha: 0.03) : Colors.black.withValues(alpha: 0.03))
                                        : (isDark ? AppColors.surfaceDark : Colors.white)),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: isSelected
                                      ? AppColors.accentCyan
                                      : (isDark ? Colors.white12 : Colors.black12),
                                ),
                              ),
                              child: Row(
                                children: [
                                  // Checkbox
                                  Checkbox(
                                    value: isAlreadyInStation || isSelected,
                                    onChanged: isAlreadyInStation
                                        ? null
                                        : (val) {
                                            setState(() {
                                              if (val == true) {
                                                _selectedTrackIds.add(track.id);
                                              } else {
                                                _selectedTrackIds.remove(track.id);
                                              }
                                            });
                                          },
                                    activeColor: AppColors.accentCyan,
                                  ),
                                  const SizedBox(width: 4),

                                  // Track Info
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                track.trackTitle,
                                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ),
                                            if (isAlreadyInStation)
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                                decoration: BoxDecoration(
                                                  color: Colors.grey.withValues(alpha: 0.2),
                                                  borderRadius: BorderRadius.circular(6),
                                                ),
                                                child: Text(
                                                  isArabic ? 'مضاف' : 'Added',
                                                  style: const TextStyle(fontSize: 9, color: Colors.grey),
                                                ),
                                              ),
                                          ],
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          '${track.trackArtist} • ${_formatDuration(track.durationSeconds)}',
                                          style: TextStyle(
                                            fontSize: 11,
                                            color: isDark ? Colors.white60 : Colors.black54,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),

          // Bottom Action Bar
          Container(
            padding: EdgeInsets.fromLTRB(16, 12, 16, MediaQuery.of(context).padding.bottom + 12),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF0F172A) : Colors.white,
              border: Border(top: BorderSide(color: isDark ? Colors.white12 : Colors.black12)),
            ),
            child: Row(
              children: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text(isArabic ? 'إلغاء' : 'Cancel'),
                ),
                const Spacer(),
                ElevatedButton.icon(
                  onPressed: _selectedTrackIds.isEmpty
                      ? null
                      : () {
                          final selectedTracks = djVm.myTracks
                              .where((t) => _selectedTrackIds.contains(t.id))
                              .map((t) => t.toDjTrackDto())
                              .toList();
                          widget.onTracksSelected(selectedTracks);
                          Navigator.pop(context);
                        },
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: Text(
                    isArabic
                        ? 'إضافة المحددة (${_selectedTrackIds.length})'
                        : 'Add Selected (${_selectedTrackIds.length})',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.accentCyan,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
