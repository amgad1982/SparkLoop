import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../data/models/dj_list_models.dart';
import '../../../../data/services/api_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/avatar_badge.dart';
import '../../auth/view_models/auth_view_model.dart';
import '../view_models/pod_view_model.dart';

const List<String> djGenres = [
  'All',
  'Lo-Fi',
  'Electronic',
  'Ambient',
  'Hip-Hop',
  'Pop',
  'Rock',
];

class DjListsScreen extends StatefulWidget {
  const DjListsScreen({super.key});

  @override
  State<DjListsScreen> createState() => _DjListsScreenState();
}

class _DjListsScreenState extends State<DjListsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _searchController = TextEditingController();

  // Create form state
  final _createFormKey = GlobalKey<FormState>();
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _descController = TextEditingController();
  String _createGenre = 'Lo-Fi';
  bool _isPublic = true;
  bool _followersOnly = false;
  final List<DjTrackDto> _newTracks = [];

  String _selectedGenre = 'All';
  List<DjListDto> _lists = [];
  bool _isLoading = false;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadLists();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    _titleController.dispose();
    _descController.dispose();
    super.dispose();
  }

  Future<void> _loadLists() async {
    setState(() {
      _isLoading = true;
    });
    try {
      final podVm = context.read<PodViewModel>();
      final genre = _selectedGenre == 'All' ? null : _selectedGenre;
      final results = await podVm.getDjLists(genre: genre);
      if (mounted) {
        setState(() {
          _lists = results;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _pickTrackFile() async {
    try {
      final result = await FilePickerPlatform.instance.pickFiles(
        type: FileType.audio,
      );
      if (result.isNotEmpty && result.first.path != null && mounted) {
        final path = result.first.path!;
        final name = result.first.name;
        final apiService = context.read<ApiService>();

        // Upload to server storage
        final url = await apiService.uploadMedia(File(path));
        final track = DjTrackDto(
          id: 'track_${DateTime.now().millisecondsSinceEpoch}',
          title: name.replaceAll(RegExp(r'\.[^.]+$'), ''),
          artist: 'Local Artist',
          url: url,
          durationSeconds: 180,
        );

        setState(() {
          _newTracks.add(track);
        });
      }
    } catch (e) {
      debugPrint('Error picking track file: $e');
    }
  }

  Future<void> _submitCreateList() async {
    if (!_createFormKey.currentState!.validate()) return;
    if (_newTracks.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please add at least one track to the DJ playlist.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    setState(() => _isSaving = true);
    try {
      final podVm = context.read<PodViewModel>();
      final dto = CreateDjListDto(
        title: _titleController.text.trim(),
        description: _descController.text.trim().isNotEmpty ? _descController.text.trim() : null,
        genre: _createGenre,
        isPublic: _isPublic,
        followersOnly: _followersOnly,
        tracks: _newTracks,
      );

      await podVm.createDjList(dto);

      _titleController.clear();
      _descController.clear();
      _newTracks.clear();
      _createGenre = 'Lo-Fi';
      _isPublic = true;
      _followersOnly = false;

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('DJ Playlist created successfully! 🎧'),
          backgroundColor: AppColors.accentEmerald,
        ),
      );

      _loadLists();
      _tabController.animateTo(0);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to create DJ playlist: $e'),
          backgroundColor: AppColors.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _streamList(DjListDto list) async {
    try {
      final podVm = context.read<PodViewModel>();
      final pod = await podVm.streamDjList(
        list.id,
        title: '${list.title} 🎧 Live DJ Set',
        followersOnly: list.followersOnly,
      );
      if (mounted) {
        context.push('/pods/${pod.id}');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to start DJ stream: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _deleteList(String id) async {
    try {
      final podVm = context.read<PodViewModel>();
      await podVm.deleteDjList(id);
      _loadLists();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('DJ playlist deleted.'),
            backgroundColor: AppColors.accentEmerald,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to delete playlist: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final authVm = context.watch<AuthViewModel>();
    final currentUserId = authVm.currentUser?.id ?? authVm.currentPersona.id;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const Icon(Icons.radio, size: 20, color: AppColors.accentCyan),
            const SizedBox(width: 8),
            Text(
              isArabic ? 'استوديو وقوائم الدي جي' : 'DJ Studio & Playlists',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          tabs: [
            Tab(text: isArabic ? 'استكشاف' : 'Explore'),
            Tab(text: isArabic ? 'قوائمي' : 'My Lists'),
            Tab(text: isArabic ? 'إنشاء قائمة' : 'Create List'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // 1. Explore Tab
          _buildExploreTab(isArabic, isDark),

          // 2. My Lists Tab
          _buildMyListsTab(isArabic, isDark, currentUserId),

          // 3. Create List Tab
          _buildCreateListTab(isArabic, isDark),
        ],
      ),
    );
  }

  Widget _buildExploreTab(bool isArabic, bool isDark) {
    final query = _searchController.text.trim().toLowerCase();
    final filtered = _lists.where((l) {
      final matchesSearch = query.isEmpty ||
          l.title.toLowerCase().contains(query) ||
          (l.description?.toLowerCase().contains(query) ?? false) ||
          l.username.toLowerCase().contains(query);
      final matchesGenre = _selectedGenre == 'All' || l.genre.toLowerCase() == _selectedGenre.toLowerCase();
      return matchesSearch && matchesGenre;
    }).toList();

    return Column(
      children: [
        // Search & Genre Filter
        Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: isArabic ? 'ابحث عن قوائم أو منسقي موسيقى...' : 'Search DJ playlists or creators...',
                  prefixIcon: const Icon(Icons.search, size: 20),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                ),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 10),
              SizedBox(
                height: 36,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: djGenres.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (context, i) {
                    final g = djGenres[i];
                    final isSelected = g == _selectedGenre;
                    return FilterChip(
                      label: Text(g, style: TextStyle(fontSize: 12, fontWeight: isSelected ? FontWeight.bold : FontWeight.normal)),
                      selected: isSelected,
                      onSelected: (_) {
                        setState(() => _selectedGenre = g);
                        _loadLists();
                      },
                      selectedColor: AppColors.primary.withValues(alpha: 0.25),
                      checkmarkColor: AppColors.primary,
                    );
                  },
                ),
              ),
            ],
          ),
        ),

        // Lists View
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : filtered.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.music_off, size: 48, color: Colors.grey),
                          const SizedBox(height: 12),
                          Text(
                            isArabic ? 'لا توجد قوائم دي جي مطابقة' : 'No DJ playlists found',
                            style: const TextStyle(color: Colors.grey),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadLists,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(12),
                        itemCount: filtered.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, i) {
                          return _buildDjListCard(filtered[i], isArabic, isDark);
                        },
                      ),
                    ),
        ),
      ],
    );
  }

  Widget _buildMyListsTab(bool isArabic, bool isDark, String currentUserId) {
    final myLists = _lists.where((l) => l.userId == currentUserId).toList();

    return _isLoading
        ? const Center(child: CircularProgressIndicator())
        : myLists.isEmpty
            ? Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.queue_music, size: 48, color: Colors.grey),
                    const SizedBox(height: 12),
                    Text(
                      isArabic ? 'لم تقم بإنشاء أي قوائم دي جي بعد' : "You haven't created any DJ playlists yet",
                      style: const TextStyle(color: Colors.grey),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: () => _tabController.animateTo(2),
                      icon: const Icon(Icons.add, size: 18),
                      label: Text(isArabic ? 'إنشاء أول قائمة' : 'Create First Playlist'),
                    ),
                  ],
                ),
              )
            : RefreshIndicator(
                onRefresh: _loadLists,
                child: ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: myLists.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, i) {
                    final item = myLists[i];
                    return _buildDjListCard(
                      item,
                      isArabic,
                      isDark,
                      isOwner: true,
                      onDelete: () => _deleteList(item.id),
                    );
                  },
                ),
              );
  }

  Widget _buildCreateListTab(bool isArabic, bool isDark) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _createFormKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isArabic ? 'إنشاء قائمة دي جي جديدة' : 'Create New DJ Playlist',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            const SizedBox(height: 16),

            // Title
            TextFormField(
              controller: _titleController,
              decoration: InputDecoration(
                labelText: isArabic ? 'عنوان القائمة' : 'Playlist Title',
                hintText: isArabic ? 'مثال: أجواء دراسة نيون' : 'e.g. Neon Focus Vibes',
              ),
              validator: (v) => v == null || v.trim().isEmpty ? 'Title is required' : null,
            ),
            const SizedBox(height: 14),

            // Description
            TextFormField(
              controller: _descController,
              decoration: InputDecoration(
                labelText: isArabic ? 'الوصف (اختياري)' : 'Description (Optional)',
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 14),

            // Genre Dropdown
            DropdownButtonFormField<String>(
              initialValue: _createGenre,
              decoration: InputDecoration(
                labelText: isArabic ? 'النوع الموسيقي' : 'Music Genre',
              ),
              items: djGenres.where((g) => g != 'All').map((g) {
                return DropdownMenuItem(value: g, child: Text(g));
              }).toList(),
              onChanged: (v) {
                if (v != null) setState(() => _createGenre = v);
              },
            ),
            const SizedBox(height: 14),

            // Access switches
            SwitchListTile(
              title: Text(isArabic ? 'إتاحة عامة للجميع' : 'Public Access (Anyone can discover)'),
              subtitle: Text(
                isArabic ? 'يمكن لأي مستخدم الاستماع لهذه القائمة' : 'Anyone can listen to this playlist',
                style: const TextStyle(fontSize: 11),
              ),
              value: _isPublic,
              onChanged: (v) => setState(() => _isPublic = v),
            ),
            SwitchListTile(
              title: Text(isArabic ? 'خاص للمتابعين فقط' : 'Followers Only (Exclusive to followers)'),
              subtitle: Text(
                isArabic ? 'حصري لمتابعيك فقط' : 'Only your followers can tune into this stream',
                style: const TextStyle(fontSize: 11),
              ),
              value: _followersOnly,
              onChanged: (v) => setState(() => _followersOnly = v),
            ),
            const Divider(height: 24),

            // Track Builder
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  isArabic ? 'المقاطع الصوتية (${_newTracks.length})' : 'Playlist Tracks (${_newTracks.length})',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
                TextButton.icon(
                  onPressed: _pickTrackFile,
                  icon: const Icon(Icons.queue_music, size: 18),
                  label: Text(isArabic ? 'إضافة ملف صوتي' : 'Add Audio File'),
                ),
              ],
            ),
            const SizedBox(height: 8),

            if (_newTracks.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.surfaceDark : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                ),
                child: Column(
                  children: [
                    const Icon(Icons.cloud_upload_outlined, size: 36, color: AppColors.primary),
                    const SizedBox(height: 8),
                    Text(
                      isArabic ? 'اختر ملفات MP3/WAV/AAC من جهازك' : 'Select MP3/WAV/AAC files from your device',
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                  ],
                ),
              )
            else
              ...List.generate(_newTracks.length, (idx) {
                final tr = _newTracks[idx];
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.surfaceDark : const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 14,
                        backgroundColor: AppColors.primary.withValues(alpha: 0.2),
                        child: Text('${idx + 1}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(tr.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                            Text(tr.artist, style: const TextStyle(color: Colors.grey, fontSize: 11)),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_outline, size: 18, color: AppColors.error),
                        onPressed: () => setState(() => _newTracks.removeAt(idx)),
                      ),
                    ],
                  ),
                );
              }),

            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton.icon(
                onPressed: _isSaving ? null : _submitCreateList,
                icon: _isSaving
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.save, size: 18),
                label: Text(
                  isArabic ? 'حفظ ونشر القائمة' : 'Save & Publish Playlist',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDjListCard(
    DjListDto list,
    bool isArabic,
    bool isDark, {
    bool isOwner = false,
    VoidCallback? onDelete,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.borderLight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Cover Icon
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  gradient: AppColors.primaryGradient,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.music_note, color: Colors.white, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      list.title,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        AvatarBadge(
                          avatarUrl: list.userAvatarUrl,
                          username: list.username,
                          size: 16,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '@${list.username}',
                          style: const TextStyle(fontSize: 11, color: Colors.grey),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.accentCyan.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            list.genre,
                            style: const TextStyle(fontSize: 9.5, color: AppColors.accentCyan, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              if (isOwner && onDelete != null)
                IconButton(
                  icon: const Icon(Icons.delete_outline, size: 20, color: AppColors.error),
                  onPressed: onDelete,
                ),
            ],
          ),
          if (list.description != null && list.description!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              list.description!,
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              // Badges
              if (list.followersOnly)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.accentAmber.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.lock_outline, size: 11, color: AppColors.accentAmber),
                      const SizedBox(width: 3),
                      Text(
                        isArabic ? 'للمتابعين فقط' : 'Followers Only',
                        style: const TextStyle(fontSize: 9.5, color: AppColors.accentAmber, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                )
              else
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.accentEmerald.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.public, size: 11, color: AppColors.accentEmerald),
                      const SizedBox(width: 3),
                      Text(
                        isArabic ? 'عام للجميع' : 'Public',
                        style: const TextStyle(fontSize: 9.5, color: AppColors.accentEmerald, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
              const SizedBox(width: 8),
              Text(
                '${list.trackCount} ${isArabic ? 'مقاطع' : 'tracks'}',
                style: const TextStyle(fontSize: 11, color: Colors.grey),
              ),
              const Spacer(),
              ElevatedButton.icon(
                onPressed: () => _streamList(list),
                icon: const Icon(Icons.play_arrow, size: 16),
                label: Text(
                  isArabic ? 'بث مباشر 🔴' : 'Stream Live 🔴',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  visualDensity: VisualDensity.compact,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
