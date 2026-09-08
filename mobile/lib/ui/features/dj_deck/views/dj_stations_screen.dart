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
import '../view_models/dj_deck_view_model.dart';
import '../widgets/music_copyright_dialog.dart';
import '../widgets/track_library_selector_bottom_sheet.dart';
import '../widgets/user_music_library_view.dart';

const List<String> stationGenres = [
  'All',
  'Lo-Fi',
  'Electronic',
  'Ambient',
  'Hip-Hop',
  'Pop',
  'Rock',
  'Chill',
];

class DjStationsScreen extends StatefulWidget {
  const DjStationsScreen({super.key});

  @override
  State<DjStationsScreen> createState() => _DjStationsScreenState();
}

class _DjStationsScreenState extends State<DjStationsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _searchController = TextEditingController();

  // Create Station Form
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _descController = TextEditingController();
  String _selectedCreateGenre = 'Lo-Fi';
  bool _isPublic = true;
  bool _followersOnly = false;
  final List<DjTrackDto> _newTracks = [];
  final Map<String, String> _newTrackLocalPaths = {};
  bool _isSaving = false;

  String _selectedFilterGenre = 'All';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<DjDeckViewModel>().loadStations();
      context.read<DjDeckViewModel>().loadMyTracks();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    _titleController.dispose();
    _descController.dispose();
    super.dispose();
  }

  Future<void> _pickLocalAudioFile() async {
    try {
      final result = await FilePickerPlatform.instance.pickFiles(
        type: FileType.audio,
      );

      if (result.isNotEmpty && mounted) {
        for (final file in result) {
          if (file.path != null) {
            final trackId = 'track_${DateTime.now().millisecondsSinceEpoch}_${_newTracks.length}';
            final cleanTitle = file.name.replaceAll(RegExp(r'\.[^.]+$'), '');

            final track = DjTrackDto(
              id: trackId,
              title: cleanTitle,
              artist: 'Local Stream',
              url: file.path!, // Local path on device - zero backend server upload!
              durationSeconds: 180,
            );

            setState(() {
              _newTracks.add(track);
              _newTrackLocalPaths[trackId] = file.path!;
            });
          }
        }
      }
    } catch (e) {
      debugPrint('Error picking local audio files: $e');
    }
  }

  Future<void> _pickAndUploadCloudAudioFile() async {
    try {
      final result = await FilePickerPlatform.instance.pickFiles(type: FileType.audio);
      if (result.isEmpty || result.first.path == null || !mounted) return;

      final file = File(result.first.path!);
      final fileName = result.first.name;

      // Prompt Copyright Ownership Attestation Dialog
      final confirmed = await MusicCopyrightDialog.show(
        context,
        fileNames: [fileName],
      );

      if (confirmed != true || !mounted) return;

      setState(() => _isSaving = true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Uploading and verifying "$fileName" on SparkLoop cloud...'),
          duration: const Duration(seconds: 2),
        ),
      );

      final cleanTitle = fileName.replaceAll(RegExp(r'\.[^.]+$'), '');
      final apiService = context.read<ApiService>();
      final uploadRes = await apiService.uploadMusicTrack(
        file: file,
        title: cleanTitle,
        artist: 'DJ Cloud',
        durationSeconds: 180,
        acceptCopyrightPolicy: true,
        policyVersion: '1.0',
      );

      final trackId = uploadRes.trackId.isNotEmpty
          ? uploadRes.trackId
          : 'cloud_${DateTime.now().millisecondsSinceEpoch}';

      final track = DjTrackDto(
        id: trackId,
        title: uploadRes.title.isNotEmpty ? uploadRes.title : cleanTitle,
        artist: uploadRes.artist.isNotEmpty ? uploadRes.artist : 'DJ Cloud',
        url: uploadRes.url,
        durationSeconds: uploadRes.durationSeconds.toInt(),
        isServerHosted: true,
        attestationId: uploadRes.attestationId,
      );

      if (mounted) {
        setState(() {
          _newTracks.add(track);
          _newTrackLocalPaths[trackId] = uploadRes.url;
          _isSaving = false;
        });

        // Refresh library so it appears in the library tab as well
        context.read<DjDeckViewModel>().loadMyTracks();

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Track uploaded & attested under copyright policy! ☁️'),
            backgroundColor: AppColors.accentEmerald,
          ),
        );
      }
    } catch (e) {
      debugPrint('Error uploading audio track: $e');
      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to upload track: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  void _openLibrarySelector() {
    TrackLibrarySelectorBottomSheet.show(
      context: context,
      alreadySelectedUrls: _newTracks.map((t) => t.url).toList(),
      onTracksSelected: (selectedTracks) {
        setState(() {
          for (final t in selectedTracks) {
            _newTracks.add(t);
            _newTrackLocalPaths[t.id] = t.url;
          }
        });
      },
      onOpenUpload: _pickAndUploadCloudAudioFile,
    );
  }

  void _addSampleTrack() {
    final trackId = 'sample_${DateTime.now().millisecondsSinceEpoch}';
    final sample = DjTrackDto(
      id: trackId,
      title: 'Neon Horizon (Synthesized)',
      artist: 'SparkLoop Audio Engine',
      url: 'asset:audio/sample.mp3',
      durationSeconds: 210,
    );
    setState(() {
      _newTracks.add(sample);
    });
  }

  Future<void> _submitCreateStation() async {
    if (!_formKey.currentState!.validate()) return;
    if (_newTracks.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select at least one audio track for your station.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    setState(() => _isSaving = true);
    try {
      final djVm = context.read<DjDeckViewModel>();
      final dto = CreateDjListDto(
        title: _titleController.text.trim(),
        description: _descController.text.trim().isNotEmpty ? _descController.text.trim() : null,
        genre: _selectedCreateGenre,
        isPublic: _isPublic,
        followersOnly: _followersOnly,
        tracks: _newTracks,
      );

      final created = await djVm.createStation(dto, _newTrackLocalPaths);

      _titleController.clear();
      _descController.clear();
      _newTracks.clear();
      _newTrackLocalPaths.clear();
      _selectedCreateGenre = 'Lo-Fi';
      _isPublic = true;
      _followersOnly = false;

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Radio Station created successfully! 📻'),
          backgroundColor: AppColors.accentEmerald,
        ),
      );

      _tabController.animateTo(1); // Switch to My Stations
      context.push('/dj/deck/${created.id}');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to create station: $e'),
          backgroundColor: AppColors.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _isSaving = false);
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
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.accentCyan.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.radio, size: 20, color: AppColors.accentCyan),
            ),
            const SizedBox(width: 10),
            Text(
              isArabic ? 'محطات الراديو واستوديو الدي جي' : 'Radio Stations & DJ Deck',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.accentCyan,
          tabs: [
            Tab(text: isArabic ? 'استكشاف المحطات' : 'Explore Stations'),
            Tab(text: isArabic ? 'محطاتي' : 'My Stations'),
            Tab(text: isArabic ? 'مكتبتي الموسيقية' : 'My Tracks'),
            Tab(text: isArabic ? 'إنشاء محطة' : 'Create Station'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildExploreTab(isArabic, isDark, currentUserId),
          _buildMyStationsTab(isArabic, isDark, currentUserId),
          UserMusicLibraryView(
            onNavigateToCreateStation: () => _tabController.animateTo(3),
          ),
          _buildCreateStationTab(isArabic, isDark),
        ],
      ),
    );
  }

  Widget _buildExploreTab(bool isArabic, bool isDark, String currentUserId) {
    final djVm = context.watch<DjDeckViewModel>();
    final query = _searchController.text.trim().toLowerCase();

    // Public explore directory: only public stations
    final publicStations = djVm.stations.where((s) {
      if (!s.isPublic) return false;
      final matchesSearch = query.isEmpty ||
          s.title.toLowerCase().contains(query) ||
          (s.description?.toLowerCase().contains(query) ?? false) ||
          s.username.toLowerCase().contains(query);
      final matchesGenre = _selectedFilterGenre == 'All' ||
          s.genre.toLowerCase() == _selectedFilterGenre.toLowerCase();
      return matchesSearch && matchesGenre;
    }).toList();

    return Column(
      children: [
        // Search & Genre Filter
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 6),
          child: TextField(
            controller: _searchController,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText: isArabic ? 'ابحث عن محطة أو فنان...' : 'Search stations or DJs...',
              prefixIcon: const Icon(Icons.search, size: 20),
              suffixIcon: _searchController.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 18),
                      onPressed: () => setState(() => _searchController.clear()),
                    )
                  : null,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            ),
          ),
        ),

        // Genre filter horizontal list
        SizedBox(
          height: 36,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            scrollDirection: Axis.horizontal,
            itemCount: stationGenres.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (context, i) {
              final g = stationGenres[i];
              final isSel = _selectedFilterGenre == g;
              return FilterChip(
                label: Text(g),
                selected: isSel,
                onSelected: (val) {
                  setState(() => _selectedFilterGenre = val ? g : 'All');
                },
                selectedColor: AppColors.accentCyan.withValues(alpha: 0.2),
                checkmarkColor: AppColors.accentCyan,
                labelStyle: TextStyle(
                  fontSize: 12,
                  fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                  color: isSel ? AppColors.accentCyan : (isDark ? Colors.white70 : Colors.black87),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 8),

        // Station List
        Expanded(
          child: djVm.isLoading
              ? const Center(child: CircularProgressIndicator())
              : publicStations.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.radio, size: 54, color: Colors.grey),
                          const SizedBox(height: 12),
                          Text(
                            isArabic ? 'لا توجد محطات عامة متاحة حالياً' : 'No public stations found',
                            style: const TextStyle(color: Colors.grey, fontSize: 14),
                          ),
                          const SizedBox(height: 14),
                          ElevatedButton.icon(
                            onPressed: () => _tabController.animateTo(2),
                            icon: const Icon(Icons.add, size: 18),
                            label: Text(isArabic ? 'ابدأ محطتك الخاصة' : 'Start Your Station'),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: djVm.loadStations,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(14),
                        itemCount: publicStations.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 12),
                        itemBuilder: (context, i) {
                          final st = publicStations[i];
                          final isOwner = st.userId == currentUserId;
                          return _buildStationCard(st, isArabic, isDark, isOwner: isOwner);
                        },
                      ),
                    ),
        ),
      ],
    );
  }

  Widget _buildMyStationsTab(bool isArabic, bool isDark, String currentUserId) {
    final djVm = context.watch<DjDeckViewModel>();
    final myStations = djVm.stations.where((s) => s.userId == currentUserId).toList();

    return djVm.isLoading
        ? const Center(child: CircularProgressIndicator())
        : myStations.isEmpty
            ? Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.queue_music, size: 54, color: Colors.grey),
                    const SizedBox(height: 12),
                    Text(
                      isArabic ? 'لم تنشئ أي محطة راديو بعد' : "You haven't created any radio stations yet",
                      style: const TextStyle(color: Colors.grey),
                    ),
                    const SizedBox(height: 14),
                    ElevatedButton.icon(
                      onPressed: () => _tabController.animateTo(2),
                      icon: const Icon(Icons.add, size: 18),
                      label: Text(isArabic ? 'إنشاء أول محطة' : 'Create First Station'),
                    ),
                  ],
                ),
              )
            : RefreshIndicator(
                onRefresh: djVm.loadStations,
                child: ListView.separated(
                  padding: const EdgeInsets.all(14),
                  itemCount: myStations.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 12),
                  itemBuilder: (context, i) {
                    final st = myStations[i];
                    return _buildStationCard(
                      st,
                      isArabic,
                      isDark,
                      isOwner: true,
                      onDelete: () => djVm.deleteStation(st.id),
                    );
                  },
                ),
              );
  }

  Widget _buildCreateStationTab(bool isArabic, bool isDark) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isArabic ? 'إنشاء محطة راديو جديدة' : 'Create New Radio Station',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
            ),
            const SizedBox(height: 4),
            Text(
              isArabic
                  ? 'اختر المقاطع الصوتية للبث المباشر للمستمعين عبر محطتك.'
                  : 'Select tracks from your device for live broadcast across your station.',
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
            const SizedBox(height: 16),

            // Station Title
            TextFormField(
              controller: _titleController,
              decoration: InputDecoration(
                labelText: isArabic ? 'اسم المحطة' : 'Station Name',
                hintText: isArabic ? 'مثال: محطة النيون الكونية' : 'e.g. Midnight Cyber Waves',
              ),
              validator: (v) => v == null || v.trim().isEmpty ? 'Station name is required' : null,
            ),
            const SizedBox(height: 14),

            // Description
            TextFormField(
              controller: _descController,
              decoration: InputDecoration(
                labelText: isArabic ? 'وصف المحطة (اختياري)' : 'Description (Optional)',
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 14),

            // Genre Dropdown
            DropdownButtonFormField<String>(
              initialValue: _selectedCreateGenre,
              decoration: InputDecoration(
                labelText: isArabic ? 'النوع الموسيقي' : 'Station Genre',
              ),
              items: stationGenres.where((g) => g != 'All').map((g) {
                return DropdownMenuItem(value: g, child: Text(g));
              }).toList(),
              onChanged: (v) {
                if (v != null) setState(() => _selectedCreateGenre = v);
              },
            ),
            const SizedBox(height: 16),

            // Public vs Private Switch
            Container(
              decoration: BoxDecoration(
                color: isDark ? AppColors.surfaceDark : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
              ),
              child: SwitchListTile(
                title: Row(
                  children: [
                    Icon(
                      _isPublic ? Icons.public : Icons.lock_outline,
                      size: 18,
                      color: _isPublic ? AppColors.accentEmerald : AppColors.accentAmber,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _isPublic
                          ? (isArabic ? 'محطة عامة (متاحة للجميع)' : 'Public Station (Discoverable in Explore)')
                          : (isArabic ? 'محطة خاصة (حصرية)' : 'Private Station (Exclusive / Followers only)'),
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                  ],
                ),
                subtitle: Text(
                  _isPublic
                      ? (isArabic ? 'تظهر في دليل المحطات لجميع المستخدمين' : 'Listed in public station directory')
                      : (isArabic ? 'لن تظهر في الدليل العام، خاصة بك ولمتابعيك فقط' : 'Hidden from explore directory; only for you & followers'),
                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                ),
                value: _isPublic,
                activeThumbColor: AppColors.accentEmerald,
                onChanged: (v) => setState(() => _isPublic = v),
              ),
            ),
            const Divider(height: 32),

            // Track List Builder
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  isArabic ? 'المقاطع الصوتية (${_newTracks.length})' : 'Station Tracks (${_newTracks.length})',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                ),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  alignment: WrapAlignment.end,
                  children: [
                    ElevatedButton.icon(
                      onPressed: _openLibrarySelector,
                      icon: const Icon(Icons.library_music_rounded, size: 14),
                      label: Text(
                        isArabic ? 'من مكتبتي 🎵' : 'My Library 🎵',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.accentCyan,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        visualDensity: VisualDensity.compact,
                      ),
                    ),
                    ElevatedButton.icon(
                      onPressed: _pickAndUploadCloudAudioFile,
                      icon: const Icon(Icons.cloud_upload, size: 14),
                      label: Text(
                        isArabic ? 'رفع سحابي ☁️' : 'Upload ☁️',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.accentAmber,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        visualDensity: VisualDensity.compact,
                      ),
                    ),
                    OutlinedButton.icon(
                      onPressed: _pickLocalAudioFile,
                      icon: const Icon(Icons.phone_android, size: 14),
                      label: Text(isArabic ? 'من جهازك 💻' : 'Device 💻', style: const TextStyle(fontSize: 11)),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        visualDensity: VisualDensity.compact,
                      ),
                    ),
                    TextButton.icon(
                      onPressed: _addSampleTrack,
                      icon: const Icon(Icons.auto_awesome, size: 14, color: AppColors.accentCyan),
                      label: Text(isArabic ? 'تجريبي' : 'Sample', style: const TextStyle(fontSize: 11)),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 10),

            if (_newTracks.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.surfaceDark : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                ),
                child: Column(
                  children: [
                    const Icon(Icons.queue_music, size: 36, color: AppColors.accentCyan),
                    const SizedBox(height: 10),
                    Text(
                      isArabic ? 'اختر طريقة إضافة المقاطع لمحطتك' : 'Add tracks to your radio station',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      isArabic
                          ? 'يمكنك الاختيار من مكتبتك السحابية، أو رفع مقاطع جديدة موثقة، أو البث المباشر من جهازك.'
                          : 'Pick from your cloud library, upload new attested tracks, or stream directly from device.',
                      style: const TextStyle(fontSize: 11, color: Colors.grey),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 14),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      alignment: WrapAlignment.center,
                      children: [
                        ElevatedButton.icon(
                          onPressed: _openLibrarySelector,
                          icon: const Icon(Icons.library_music_rounded, size: 14),
                          label: Text(isArabic ? 'من مكتبتي 🎵' : 'My Library 🎵'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.accentCyan,
                            foregroundColor: Colors.white,
                            textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                          ),
                        ),
                        ElevatedButton.icon(
                          onPressed: _pickAndUploadCloudAudioFile,
                          icon: const Icon(Icons.cloud_upload_outlined, size: 14),
                          label: Text(isArabic ? 'رفع سحابي ☁️' : 'Upload Cloud ☁️'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.accentAmber,
                            foregroundColor: Colors.black,
                            textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                          ),
                        ),
                        OutlinedButton.icon(
                          onPressed: _pickLocalAudioFile,
                          icon: const Icon(Icons.phone_android, size: 14),
                          label: Text(isArabic ? 'بث من جهازك' : 'Stream Local'),
                          style: OutlinedButton.styleFrom(
                            textStyle: const TextStyle(fontSize: 11),
                          ),
                        ),
                      ],
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
                        radius: 13,
                        backgroundColor: tr.isServerHosted
                            ? AppColors.accentSky.withValues(alpha: 0.2)
                            : AppColors.accentCyan.withValues(alpha: 0.2),
                        child: Text('${idx + 1}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(tr.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                            const SizedBox(height: 2),
                            Text(
                              tr.artist.isNotEmpty ? tr.artist : 'DJ Track',
                              style: const TextStyle(color: Colors.grey, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_outline, size: 18, color: AppColors.error),
                        onPressed: () {
                          setState(() {
                            _newTracks.removeAt(idx);
                            _newTrackLocalPaths.remove(tr.id);
                          });
                        },
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
                onPressed: _isSaving ? null : _submitCreateStation,
                icon: _isSaving
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.radio, size: 18),
                label: Text(
                  isArabic ? 'إنشاء وبدء المحطة 📻' : 'Create & Launch Station 📻',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.accentCyan,
                  foregroundColor: Colors.black,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStationCard(
    DjListDto station,
    bool isArabic,
    bool isDark, {
    bool isOwner = false,
    VoidCallback? onDelete,
  }) {
    final djVm = context.watch<DjDeckViewModel>();
    final isCurrentPlaying = djVm.activeStation?.id == station.id && djVm.isPlaying;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isCurrentPlaying ? AppColors.accentCyan : (isDark ? AppColors.borderDark : AppColors.borderLight),
          width: isCurrentPlaying ? 1.5 : 1.0,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Vinyl Cover Icon
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  gradient: isCurrentPlaying
                      ? const LinearGradient(colors: [AppColors.accentCyan, AppColors.primary])
                      : AppColors.primaryGradient,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Center(
                  child: Icon(
                    isCurrentPlaying ? Icons.equalizer : Icons.radio,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            station.title,
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                        ),
                        if (station.isLive)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.error.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Row(
                              children: [
                                Icon(Icons.circle, size: 6, color: AppColors.error),
                                SizedBox(width: 3),
                                Text(
                                  'ON AIR 🔴',
                                  style: TextStyle(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w900,
                                    color: AppColors.error,
                                  ),
                                ),
                              ],
                            ),
                          )
                        else
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.grey.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.circle, size: 6, color: Colors.grey),
                                const SizedBox(width: 3),
                                Text(
                                  isArabic ? 'غير متصل' : 'OFFLINE',
                                  style: const TextStyle(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.grey,
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        AvatarBadge(
                          avatarUrl: station.userAvatarUrl,
                          username: station.username,
                          size: 16,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '@${station.username}',
                          style: const TextStyle(fontSize: 11, color: Colors.grey),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                          decoration: BoxDecoration(
                            color: AppColors.accentCyan.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            station.genre,
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

          if (station.description != null && station.description!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              station.description!,
              style: const TextStyle(fontSize: 12, color: Colors.grey),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],

          const SizedBox(height: 12),
          Row(
            children: [
              // Privacy Badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: station.isPublic
                      ? AppColors.accentEmerald.withValues(alpha: 0.15)
                      : AppColors.accentAmber.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  children: [
                    Icon(
                      station.isPublic ? Icons.public : Icons.lock_outline,
                      size: 11,
                      color: station.isPublic ? AppColors.accentEmerald : AppColors.accentAmber,
                    ),
                    const SizedBox(width: 3),
                    Text(
                      station.isPublic
                          ? (isArabic ? 'عام' : 'Public')
                          : (isArabic ? 'خاص' : 'Private'),
                      style: TextStyle(
                        fontSize: 9.5,
                        color: station.isPublic ? AppColors.accentEmerald : AppColors.accentAmber,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),

              // Track Count
              Text(
                '${station.trackCount} ${isArabic ? 'مقاطع' : 'tracks'}',
                style: const TextStyle(fontSize: 11, color: Colors.grey),
              ),
              const Spacer(),

              // Enter Deck or Tune In Button
              ElevatedButton.icon(
                onPressed: () {
                  if (isOwner) {
                    djVm.openStation(station, autoPlay: true, isOwner: true);
                    context.push('/dj/deck/${station.id}');
                  } else if (station.isLive) {
                    djVm.openStation(station, autoPlay: true, isOwner: false);
                    context.push('/dj/deck/${station.id}');
                  } else {
                    djVm.openStation(station, autoPlay: false, isOwner: false);
                    context.push('/dj/deck/${station.id}');
                  }
                },
                icon: Icon(
                  isOwner
                      ? Icons.tune
                      : (station.isLive ? Icons.play_arrow : Icons.radio_outlined),
                  size: 16,
                ),
                label: Text(
                  isOwner
                      ? (isArabic ? 'استوديو الدي جي 🎛️' : 'DJ Deck 🎛️')
                      : (station.isLive
                          ? (isArabic ? 'استماع 🎧' : 'Tune In 🎧')
                          : (isArabic ? 'غير متصل 📻' : 'Offline 📻')),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: isOwner
                      ? AppColors.primary
                      : (station.isLive
                          ? AppColors.accentCyan
                          : (isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0))),
                  foregroundColor: isOwner
                      ? Colors.white
                      : (station.isLive ? Colors.black : Colors.grey),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
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
