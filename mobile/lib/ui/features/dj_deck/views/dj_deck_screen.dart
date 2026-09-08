import 'dart:io';
import 'dart:math' as math;
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../data/models/dj_list_models.dart';
import '../../../../data/services/api_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/avatar_badge.dart';
import '../../auth/view_models/auth_view_model.dart';
import '../view_models/dj_deck_view_model.dart';
import '../widgets/music_copyright_dialog.dart';

class DjDeckScreen extends StatefulWidget {
  final String stationId;

  const DjDeckScreen({
    super.key,
    required this.stationId,
  });

  @override
  State<DjDeckScreen> createState() => _DjDeckScreenState();
}

class _DjDeckScreenState extends State<DjDeckScreen> with SingleTickerProviderStateMixin {
  late AnimationController _vinylAnimController;
  int _activeDeckTab = 0; // 0 = Playlist, 1 = DJ Controls (Broadcaster suite)

  @override
  void initState() {
    super.initState();
    _vinylAnimController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    );

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final djVm = context.read<DjDeckViewModel>();
      final authVm = context.read<AuthViewModel>();
      final currentUserId = authVm.currentUser?.id ?? authVm.currentPersona.id;
      if (djVm.activeStation == null || djVm.activeStation!.id != widget.stationId) {
        final st = djVm.stations.firstWhere(
          (s) => s.id == widget.stationId,
          orElse: () => DjListDto(
            id: widget.stationId,
            userId: '',
            username: 'DJ',
            userDisplayName: 'Spark DJ',
            title: 'Radio Station',
            genre: 'Lo-Fi',
            createdAtUtc: DateTime.now(),
          ),
        );
        final isOwner = st.userId == currentUserId;
        djVm.openStation(st, autoPlay: isOwner || st.isLive, isOwner: isOwner);
      }
    });
  }

  @override
  void dispose() {
    _vinylAnimController.dispose();
    super.dispose();
  }

  void _syncVinylAnimation(bool isPlaying, double tempoRate) {
    final targetMs = (3000 / tempoRate.clamp(0.5, 2.0)).round();
    final targetDuration = Duration(milliseconds: targetMs);
    if (_vinylAnimController.duration != targetDuration) {
      _vinylAnimController.duration = targetDuration;
      if (_vinylAnimController.isAnimating) {
        _vinylAnimController.repeat();
      }
    }
    if (isPlaying) {
      if (!_vinylAnimController.isAnimating) {
        _vinylAnimController.repeat();
      }
    } else {
      if (_vinylAnimController.isAnimating) {
        _vinylAnimController.stop();
      }
    }
  }

  String _formatDuration(Duration d) {
    final minutes = d.inMinutes;
    final seconds = d.inSeconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  Future<void> _pickTrackForStation(DjDeckViewModel djVm) async {
    try {
      final result = await FilePickerPlatform.instance.pickFiles(type: FileType.audio);
      if (result.isNotEmpty && result.first.path != null && mounted) {
        final file = result.first;
        final trackId = 'track_${DateTime.now().millisecondsSinceEpoch}';
        final track = DjTrackDto(
          id: trackId,
          title: file.name.replaceAll(RegExp(r'\.[^.]+$'), ''),
          artist: 'Local Stream',
          url: file.path!,
          durationSeconds: 180,
        );

        final currentStation = djVm.activeStation;
        if (currentStation != null) {
          final updatedTracks = List<DjTrackDto>.from(currentStation.tracks)..add(track);
          djVm.localTrackPaths[trackId] = file.path!;
          await djVm.createStation(
            CreateDjListDto(
              title: currentStation.title,
              description: currentStation.description,
              genre: currentStation.genre,
              isPublic: currentStation.isPublic,
              followersOnly: currentStation.followersOnly,
              tracks: updatedTracks,
            ),
            {trackId: file.path!},
          );
        }
      }
    } catch (e) {
      debugPrint('Error picking track: $e');
    }
  }

  Future<void> _pickAndUploadCloudTrackForStation(DjDeckViewModel djVm) async {
    try {
      final result = await FilePickerPlatform.instance.pickFiles(type: FileType.audio);
      if (result.isEmpty || result.first.path == null || !mounted) return;

      final file = File(result.first.path!);
      final fileName = result.first.name;

      final confirmed = await MusicCopyrightDialog.show(
        context,
        fileNames: [fileName],
      );

      if (confirmed != true || !mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Attesting and uploading "$fileName" to cloud...'),
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

      final currentStation = djVm.activeStation;
      if (currentStation != null) {
        final updatedTracks = List<DjTrackDto>.from(currentStation.tracks)..add(track);
        djVm.localTrackPaths[trackId] = uploadRes.url;
        await djVm.createStation(
          CreateDjListDto(
            title: currentStation.title,
            description: currentStation.description,
            genre: currentStation.genre,
            isPublic: currentStation.isPublic,
            followersOnly: currentStation.followersOnly,
            tracks: updatedTracks,
          ),
          {trackId: uploadRes.url},
        );

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Track uploaded & attested! ☁️'),
              backgroundColor: AppColors.accentEmerald,
            ),
          );
        }
      }
    } catch (e) {
      debugPrint('Error uploading track: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to upload track: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final djVm = context.watch<DjDeckViewModel>();
    final authVm = context.watch<AuthViewModel>();
    final currentUserId = authVm.currentUser?.id ?? authVm.currentPersona.id;
    final station = djVm.activeStation;

    if (station == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final isOwner = station.userId == currentUserId;
    final track = djVm.currentTrack;
    final isPlaying = djVm.isPlaying;
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final isDark = Theme.of(context).brightness == Brightness.dark;

    _syncVinylAnimation(isPlaying, djVm.tempoRate);

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF080C14) : const Color(0xFFF1F5F9),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.keyboard_arrow_down, size: 28),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Column(
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (djVm.isBroadcasting) ...[
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.error,
                    ),
                  ),
                  const SizedBox(width: 5),
                  const Text(
                    'LIVE BROADCAST',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: AppColors.error,
                      letterSpacing: 1.0,
                    ),
                  ),
                ] else ...[
                  Text(
                    isArabic ? 'راديو دي جي' : 'RADIO STATION',
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: AppColors.accentCyan,
                      letterSpacing: 1.0,
                    ),
                  ),
                ],
              ],
            ),
            Text(
              station.title,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        actions: [
          // Public / Private Switch (for Station Owner)
          if (isOwner)
            IconButton(
              tooltip: station.isPublic ? 'Public Station' : 'Private Station',
              icon: Icon(
                station.isPublic ? Icons.public : Icons.lock_outline,
                color: station.isPublic ? AppColors.accentEmerald : AppColors.accentAmber,
              ),
              onPressed: () => djVm.togglePrivacy(!station.isPublic),
            ),

          // Active Listeners Indicator
          Container(
            margin: const EdgeInsets.only(right: 12),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.surfaceDark.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.borderDark),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.people_outline, size: 14, color: AppColors.accentCyan),
                const SizedBox(width: 4),
                Text(
                  '${djVm.listenersCount}',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Offline Station Banner for Listeners
            if (!isOwner && !djVm.isBroadcasting)
              Container(
                margin: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B).withValues(alpha: 0.9),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.amber.withValues(alpha: 0.35)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(7),
                      decoration: BoxDecoration(
                        color: Colors.amber.withValues(alpha: 0.15),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.radio_outlined, color: Colors.amber, size: 18),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isArabic ? 'المحطة غير متصلة حالياً 📻' : 'Station is Currently Offline 📻',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5, color: Colors.amber),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            isArabic
                                ? 'بانتظار بدء بث الدي جي @${station.username}. سيبدأ البث تلقائياً عند انطلاقه.'
                                : 'Waiting for DJ @${station.username} to go live. Stream starts automatically when broadcasting.',
                            style: const TextStyle(fontSize: 11, color: Colors.grey),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

            // Top Section: Animated DJ Turntable & Equalizer
            Expanded(
              flex: 4,
              child: Center(
                child: _buildTurntableDeck(track, isPlaying, djVm, isOwner),
              ),
            ),

            // Middle Section: Track Details & Player Scrubber
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                children: [
                  Text(
                    track?.title ?? station.title,
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      AvatarBadge(
                        avatarUrl: station.userAvatarUrl,
                        username: station.username,
                        size: 16,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'DJ @${station.username} • ${station.genre}',
                        style: const TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  _buildSoundWaveVisualizer(isPlaying),
                  const SizedBox(height: 6),

                  // Controls Section: DJ Studio Controls (Owner) vs Radio Receiver (Listener)
                  if (isOwner) ...[
                    // Progress Scrubber (Owner can seek track)
                    SliderTheme(
                      data: SliderTheme.of(context).copyWith(
                        thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                        overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
                        activeTrackColor: AppColors.accentCyan,
                        inactiveTrackColor: Colors.grey.withValues(alpha: 0.3),
                        thumbColor: AppColors.accentCyan,
                      ),
                      child: Slider(
                        value: djVm.duration.inMilliseconds > 0
                            ? djVm.position.inMilliseconds.clamp(0, djVm.duration.inMilliseconds).toDouble()
                            : 0.0,
                        max: djVm.duration.inMilliseconds > 0
                            ? djVm.duration.inMilliseconds.toDouble()
                            : 1.0,
                        onChanged: (val) {
                          djVm.seek(Duration(milliseconds: val.toInt()));
                        },
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(_formatDuration(djVm.position), style: const TextStyle(fontSize: 11, color: Colors.grey)),
                          Text(_formatDuration(djVm.duration), style: const TextStyle(fontSize: 11, color: Colors.grey)),
                        ],
                      ),
                    ),

                    // Transport Buttons (Owner only)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // CUE Button
                        ElevatedButton(
                          onPressed: () => djVm.cue(isOwner: true),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.accentAmber.withValues(alpha: 0.2),
                            foregroundColor: AppColors.accentAmber,
                            side: const BorderSide(color: AppColors.accentAmber, width: 1.5),
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            minimumSize: const Size(48, 36),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          child: const Text('CUE', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11, letterSpacing: 1.0)),
                        ),
                        const SizedBox(width: 12),
                        IconButton(
                          icon: const Icon(Icons.skip_previous, size: 30),
                          onPressed: () => djVm.previousTrack(isOwner: true),
                        ),
                        const SizedBox(width: 12),
                        GestureDetector(
                          onTap: () => djVm.togglePlayPause(isOwner: true),
                          child: Container(
                            width: 58,
                            height: 58,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: const LinearGradient(
                                colors: [AppColors.accentCyan, AppColors.primary],
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.accentCyan.withValues(alpha: 0.4),
                                  blurRadius: 16,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Icon(
                              isPlaying ? Icons.pause : Icons.play_arrow,
                              size: 32,
                              color: Colors.white,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        IconButton(
                          icon: const Icon(Icons.skip_next, size: 30),
                          onPressed: () => djVm.nextTrack(isOwner: true),
                        ),
                      ],
                    ),
                  ] else ...[
                    // Listener Radio Station Receiver Panel
                    // Synchronized Progress Bar (Read-only status of current broadcast)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: djVm.duration.inMilliseconds > 0
                            ? (djVm.position.inMilliseconds / djVm.duration.inMilliseconds).clamp(0.0, 1.0)
                            : 0.0,
                        minHeight: 4,
                        backgroundColor: Colors.white10,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          djVm.isBroadcasting ? AppColors.accentCyan : Colors.grey,
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(_formatDuration(djVm.position), style: const TextStyle(fontSize: 11, color: Colors.grey)),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.radio,
                              size: 13,
                              color: djVm.isBroadcasting ? AppColors.accentCyan : Colors.grey,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              djVm.isBroadcasting
                                  ? (isArabic ? 'بث إذاعي مباشر ومتزامن' : 'Live Synced Radio')
                                  : (isArabic ? 'البث متوقف حالياً' : 'Broadcast Offline'),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: djVm.isBroadcasting ? AppColors.accentCyan : Colors.grey,
                              ),
                            ),
                          ],
                        ),
                        Text(_formatDuration(djVm.duration), style: const TextStyle(fontSize: 11, color: Colors.grey)),
                      ],
                    ),
                    const SizedBox(height: 8),

                    // Listener Live Synchronization Status Banner
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: isDark ? AppColors.surfaceDark : Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: const BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: AppColors.accentEmerald,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                isArabic ? 'متزامن مع بث الـ DJ' : 'Live Synced with DJ',
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.white10,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  '${djVm.tempoRate.toStringAsFixed(2)}x',
                                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
                                ),
                              ),
                              const SizedBox(width: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.primary.withValues(alpha: 0.2),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  djVm.filterPreset.toUpperCase(),
                                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.accentCyan),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),

                    // Listener Receiver Bar: Volume Slider + Mute + Tune Out
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: isDark ? AppColors.surfaceDark : Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                      ),
                      child: Row(
                        children: [
                          IconButton(
                            icon: Icon(
                              djVm.volume == 0 ? Icons.volume_off : Icons.volume_up,
                              color: djVm.volume == 0 ? AppColors.accentAmber : AppColors.accentCyan,
                              size: 20,
                            ),
                            onPressed: () {
                              if (djVm.volume == 0) {
                                djVm.setVolume(1.0);
                              } else {
                                djVm.setVolume(0.0);
                              }
                            },
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                            tooltip: djVm.volume == 0 ? 'Unmute' : 'Mute',
                          ),
                          Expanded(
                            child: SliderTheme(
                              data: SliderTheme.of(context).copyWith(
                                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 5),
                                overlayShape: const RoundSliderOverlayShape(overlayRadius: 10),
                                activeTrackColor: AppColors.accentCyan,
                                inactiveTrackColor: Colors.grey.withValues(alpha: 0.25),
                                thumbColor: AppColors.accentCyan,
                              ),
                              child: Slider(
                                value: djVm.volume.clamp(0.0, 1.0),
                                min: 0.0,
                                max: 1.0,
                                onChanged: (val) => djVm.setVolume(val),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          OutlinedButton.icon(
                            onPressed: () {
                              djVm.closeStation();
                              Navigator.of(context).pop();
                            },
                            icon: const Icon(Icons.power_settings_new, size: 14, color: AppColors.error),
                            label: Text(
                              isArabic ? 'مغادرة' : 'Tune Out',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: AppColors.error,
                              ),
                            ),
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(color: AppColors.error.withValues(alpha: 0.5)),
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              visualDensity: VisualDensity.compact,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 12),

            // Bottom Navigation Segment:
            // For Owner: Playlist vs DJ Deck Controls tab switcher
            // For Listener: Broadcast Program Schedule banner
            if (isOwner) ...[
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 20),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.surfaceDark : const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () => setState(() => _activeDeckTab = 0),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(
                            color: _activeDeckTab == 0 ? AppColors.primary : Colors.transparent,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Center(
                            child: Text(
                              isArabic ? 'قائمة المقاطع (${station.tracks.length})' : 'Playlist (${station.tracks.length})',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: _activeDeckTab == 0 ? Colors.white : Colors.grey,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: InkWell(
                        onTap: () => setState(() => _activeDeckTab = 1),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(
                            color: _activeDeckTab == 1 ? AppColors.accentCyan : Colors.transparent,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Center(
                            child: Text(
                              isArabic ? 'تحكم الدي جي 🎛️' : 'DJ Deck Controls 🎛️',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: _activeDeckTab == 1 ? Colors.black : Colors.grey,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ] else ...[
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 20),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.surfaceDark : const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.schedule, size: 16, color: AppColors.accentCyan),
                        const SizedBox(width: 6),
                        Text(
                          isArabic ? 'جدول بث المحطة (${station.tracks.length})' : 'Broadcast Program (${station.tracks.length})',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.accentCyan.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        isArabic ? 'راديو مباشر • قراءة فقط' : 'Live Radio • Read Only',
                        style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: AppColors.accentCyan),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 8),

            // Bottom Content Panel
            Expanded(
              flex: 3,
              child: (!isOwner || _activeDeckTab == 0)
                  ? _buildPlaylistView(djVm, isDark, isOwner, isArabic)
                  : _buildBroadcasterDeckView(djVm, currentUserId, authVm, isArabic, isDark),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTurntableDeck(
    DjTrackDto? track,
    bool isPlaying,
    DjDeckViewModel djVm,
    bool isOwner,
  ) {
    return LayoutBuilder(builder: (context, constraints) {
      final availableSize = math.min(constraints.maxWidth * 0.78, constraints.maxHeight - 16);
      final size = (availableSize - 24).clamp(130.0, 260.0);

      return Stack(
        alignment: Alignment.center,
        children: [
          // Outer Deck Housing with Ambient Neon Glow
          AnimatedContainer(
            duration: const Duration(milliseconds: 450),
            width: size + 24,
            height: size + 24,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: const Color(0xFF0B0F17),
              boxShadow: [
                BoxShadow(
                  color: isPlaying
                      ? AppColors.accentCyan.withValues(alpha: 0.35)
                      : Colors.black.withValues(alpha: 0.5),
                  blurRadius: isPlaying ? 32 : 16,
                  spreadRadius: isPlaying ? 6 : 2,
                ),
                if (isPlaying)
                  BoxShadow(
                    color: const Color(0xFFD946EF).withValues(alpha: 0.22),
                    blurRadius: 48,
                    spreadRadius: 8,
                  ),
              ],
              border: Border.all(
                color: isPlaying
                    ? AppColors.accentCyan.withValues(alpha: 0.5)
                    : const Color(0xFF1E293B),
                width: 3,
              ),
            ),
          ),

          // Spinning Vinyl Record
          GestureDetector(
            onTap: () {
              if (isOwner) {
                djVm.togglePlayPause(isOwner: true);
              }
            },
            child: AnimatedBuilder(
              animation: _vinylAnimController,
              builder: (context, child) {
                return Transform.rotate(
                  angle: _vinylAnimController.value * 2 * math.pi,
                  child: child,
                );
              },
              child: SizedBox(
                width: size,
                height: size,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    // Deep Vinyl Base
                    Container(
                      width: size,
                      height: size,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFF070B12),
                        border: Border.all(color: const Color(0xFF1E293B), width: 1.5),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.8),
                            blurRadius: 10,
                          ),
                        ],
                      ),
                    ),

                    // Concentric Vinyl Sound Grooves
                    Container(
                      width: size * 0.90,
                      height: size * 0.90,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.06),
                          width: 1.2,
                        ),
                      ),
                    ),
                    Container(
                      width: size * 0.78,
                      height: size * 0.78,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.04),
                          width: 1.2,
                        ),
                      ),
                    ),
                    Container(
                      width: size * 0.65,
                      height: size * 0.65,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.05),
                          width: 1.2,
                        ),
                      ),
                    ),
                    Container(
                      width: size * 0.52,
                      height: size * 0.52,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.07),
                          width: 1.2,
                        ),
                      ),
                    ),

                    // Specular Light Sheen Reflection (Rotates with disc to provide prominent rotation optics)
                    Container(
                      width: size,
                      height: size,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: SweepGradient(
                          colors: [
                            Colors.transparent,
                            Colors.white.withValues(alpha: 0.16),
                            Colors.transparent,
                            Colors.white.withValues(alpha: 0.03),
                            Colors.transparent,
                            Colors.white.withValues(alpha: 0.16),
                            Colors.transparent,
                            Colors.white.withValues(alpha: 0.03),
                            Colors.transparent,
                          ],
                          stops: const [0.0, 0.15, 0.30, 0.45, 0.50, 0.65, 0.80, 0.95, 1.0],
                        ),
                      ),
                    ),

                    // Strobe Rim Markers (4 cardinal notches for crisp angular spinning visibility)
                    for (int i = 0; i < 4; i++)
                      Transform.rotate(
                        angle: i * math.pi / 2,
                        child: Align(
                          alignment: Alignment.topCenter,
                          child: Container(
                            margin: const EdgeInsets.only(top: 2),
                            width: 3.5,
                            height: 6,
                            decoration: BoxDecoration(
                              color: AppColors.accentCyan.withValues(alpha: 0.75),
                              borderRadius: BorderRadius.circular(1),
                            ),
                          ),
                        ),
                      ),

                    // Center Vinyl Label with dynamic artwork & text
                    Container(
                      width: size * 0.38,
                      height: size * 0.38,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const LinearGradient(
                          colors: [Color(0xFFD946EF), Color(0xFF8B5CF6), Color(0xFF6366F1)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.85), width: 2),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF8B5CF6).withValues(alpha: 0.5),
                            blurRadius: 10,
                          ),
                        ],
                      ),
                      child: Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.album_rounded, size: 20, color: Colors.white),
                            const SizedBox(height: 2),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 4),
                              child: Text(
                                (track?.artist.isNotEmpty == true
                                        ? track!.artist
                                        : 'SPARK LOOP')
                                    .toUpperCase(),
                                style: const TextStyle(
                                  fontSize: 8,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white,
                                  letterSpacing: 0.8,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(height: 3),
                            // Spindle Hole
                            Container(
                              width: 10,
                              height: 10,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: const Color(0xFF020408),
                                border: Border.all(color: Colors.white70, width: 1.5),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Tonearm with smooth mechanical swing animation
          Positioned(
            top: 2,
            right: 14,
            child: AnimatedRotation(
              turns: isPlaying ? -0.040 : -0.105,
              duration: const Duration(milliseconds: 650),
              curve: Curves.easeInOutCubic,
              alignment: Alignment.topRight,
              child: SizedBox(
                width: 28,
                height: size * 0.72,
                child: Stack(
                  alignment: Alignment.topRight,
                  children: [
                    // Gimbal Pivot Base (Top Right)
                    Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const RadialGradient(
                          colors: [Color(0xFFE2E8F0), Color(0xFF64748B), Color(0xFF1E293B)],
                        ),
                        border: Border.all(color: Colors.white70, width: 1.5),
                        boxShadow: const [
                          BoxShadow(color: Colors.black54, blurRadius: 6, offset: Offset(0, 2)),
                        ],
                      ),
                      child: Center(
                        child: Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                      ),
                    ),

                    // Chrome Tonearm Wand
                    Positioned(
                      top: 18,
                      right: 10,
                      bottom: 22,
                      child: Container(
                        width: 4.5,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            begin: Alignment.centerLeft,
                            end: Alignment.centerRight,
                            colors: [Color(0xFF94A3B8), Color(0xFFF8FAFC), Color(0xFF64748B)],
                          ),
                          borderRadius: BorderRadius.circular(2),
                          boxShadow: const [
                            BoxShadow(color: Colors.black45, blurRadius: 3, offset: Offset(1, 1)),
                          ],
                        ),
                      ),
                    ),

                    // Angled Headshell & Stylus Cartridge (Bottom)
                    Positioned(
                      bottom: 0,
                      right: 6,
                      child: Transform.rotate(
                        angle: 0.22,
                        child: Container(
                          width: 14,
                          height: 24,
                          decoration: BoxDecoration(
                            color: isPlaying ? AppColors.accentCyan : const Color(0xFF334155),
                            borderRadius: BorderRadius.circular(3),
                            boxShadow: [
                              BoxShadow(
                                color: isPlaying
                                    ? AppColors.accentCyan.withValues(alpha: 0.6)
                                    : Colors.black54,
                                blurRadius: isPlaying ? 8 : 4,
                              ),
                            ],
                            border: Border.all(color: Colors.white54, width: 1),
                          ),
                          child: Align(
                            alignment: Alignment.bottomCenter,
                            child: Container(
                              width: 3,
                              height: 5,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      );
    });
  }

  Widget _buildSoundWaveVisualizer(bool isPlaying) {
    const barHeights = [14.0, 24.0, 10.0, 32.0, 20.0, 12.0, 28.0, 22.0, 16.0, 30.0, 18.0, 8.0, 26.0, 32.0];

    return AnimatedBuilder(
      animation: _vinylAnimController,
      builder: (context, _) {
        final animVal = _vinylAnimController.value;
        return SizedBox(
          height: 32,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: List.generate(barHeights.length, (i) {
              final baseH = barHeights[i];
              final dynamicH = isPlaying
                  ? (baseH * (math.sin(i * 0.7 + animVal * 2 * math.pi * 2) * 0.45 + 0.65)).clamp(4.0, 32.0)
                  : 4.0;

              return Container(
                margin: const EdgeInsets.symmetric(horizontal: 2),
                width: 3.5,
                height: dynamicH,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(2),
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: isPlaying
                        ? [const Color(0xFFD946EF), const Color(0xFF38BDF8)]
                        : [Colors.grey.withValues(alpha: 0.3), Colors.grey.withValues(alpha: 0.2)],
                  ),
                ),
              );
            }),
          ),
        );
      },
    );
  }

  Widget _buildPlaylistView(DjDeckViewModel djVm, bool isDark, bool isOwner, bool isArabic) {
    final tracks = djVm.activeStation?.tracks ?? [];

    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      itemCount: tracks.length + (isOwner ? 1 : 0),
      separatorBuilder: (_, _) => const SizedBox(height: 6),
      itemBuilder: (context, i) {
        if (i == tracks.length) {
          // Add Track Options - Owner only
          return Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _pickAndUploadCloudTrackForStation(djVm),
                  icon: const Icon(Icons.cloud_upload_outlined, size: 16),
                  label: Text(isArabic ? 'رفع سحابي ☁️' : 'Upload Cloud ☁️'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.accentAmber,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _pickTrackForStation(djVm),
                  icon: const Icon(Icons.phone_android, size: 16),
                  label: Text(isArabic ? 'من جهازك 💻' : 'From Device 💻'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    textStyle: const TextStyle(fontSize: 11),
                  ),
                ),
              ),
            ],
          );
        }

        final tr = tracks[i];
        final isCurrent = djVm.currentTrackIndex == i;

        return InkWell(
          onTap: isOwner
              ? () => djVm.playTrack(i, isOwner: true)
              : null, // Listener cannot select or change songs arbitrarily
          borderRadius: BorderRadius.circular(10),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: isCurrent
                  ? AppColors.accentCyan.withValues(alpha: 0.15)
                  : (isDark ? AppColors.surfaceDark : Colors.white),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: isCurrent ? AppColors.accentCyan : Colors.transparent,
              ),
            ),
            child: Row(
              children: [
                if (isCurrent)
                  Icon(
                    djVm.isPlaying ? Icons.equalizer : Icons.pause,
                    size: 18,
                    color: AppColors.accentCyan,
                  )
                else if (isOwner)
                  const Icon(
                    Icons.play_arrow,
                    size: 18,
                    color: Colors.grey,
                  )
                else
                  SizedBox(
                    width: 18,
                    child: Text(
                      '${i + 1}',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey),
                      textAlign: TextAlign.center,
                    ),
                  ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              tr.title,
                              style: TextStyle(
                                fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                                color: isCurrent ? AppColors.accentCyan : null,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                      Text(
                        tr.artist.isNotEmpty ? tr.artist : 'DJ Track',
                        style: const TextStyle(fontSize: 11, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
                if (isCurrent && !isOwner) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.error.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AppColors.error.withValues(alpha: 0.4)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.circle, size: 5, color: AppColors.error),
                        const SizedBox(width: 3),
                        Text(
                          isArabic ? 'على الهواء' : 'ON AIR',
                          style: const TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                            color: AppColors.error,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Text(
                  _formatDuration(Duration(seconds: tr.durationSeconds)),
                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildBroadcasterDeckView(
    DjDeckViewModel djVm,
    String currentUserId,
    AuthViewModel authVm,
    bool isArabic,
    bool isDark,
  ) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Live Broadcast & SFU Mic Toggles
          Row(
            children: [
              // Broadcast Live
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: djVm.toggleBroadcast,
                  icon: Icon(
                    djVm.isBroadcasting ? Icons.stop_circle : Icons.sensors,
                    size: 18,
                  ),
                  label: Text(
                    djVm.isBroadcasting
                        ? (isArabic ? 'إيقاف البث ⏹️' : 'Stop Broadcast ⏹️')
                        : (isArabic ? 'بث مباشر 🔴' : 'Go Live 🔴'),
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: djVm.isBroadcasting ? AppColors.error : AppColors.accentEmerald,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
              const SizedBox(width: 10),

              // Live Mic via LiveKit SFU
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    djVm.toggleLiveMic(
                      currentUserId: currentUserId,
                      currentUsername: authVm.currentUser?.username ?? authVm.currentPersona.username,
                      currentDisplayName: authVm.currentUser?.displayName ?? authVm.currentPersona.displayName,
                      currentAvatarUrl: authVm.currentUser?.avatarUrl ?? authVm.currentPersona.avatarUrl,
                    );
                  },
                  icon: Icon(
                    djVm.isLiveMicActive ? Icons.mic : Icons.mic_off,
                    size: 18,
                  ),
                  label: Text(
                    djVm.isLiveMicActive
                        ? (isArabic ? 'الميكروفون متصل 🎙️' : 'Mic Live 🎙️')
                        : (isArabic ? 'تفعيل الميكروفون' : 'Live Mic'),
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: djVm.isLiveMicActive ? AppColors.accentCyan : const Color(0xFF334155),
                    foregroundColor: djVm.isLiveMicActive ? Colors.black : Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Authentic DJ Features: Pitch/Tempo Fader, Crossfade, Beat Looper, Filters
          const SizedBox(height: 6),

          // Pitch / Tempo Slider & Reset
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: isDark ? AppColors.surfaceDark : Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      isArabic ? 'السرعة / النغمة (Pitch/Tempo)' : 'Tempo / Pitch Fader',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '${djVm.tempoRate.toStringAsFixed(2)}x',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.accentCyan),
                        ),
                        const SizedBox(width: 8),
                        InkWell(
                          onTap: () => djVm.setTempoRate(1.0, isOwner: true),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.white10,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text('1.0x', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                Slider(
                  value: djVm.tempoRate.clamp(0.8, 1.2),
                  min: 0.8,
                  max: 1.2,
                  divisions: 40,
                  activeColor: AppColors.accentCyan,
                  onChanged: (val) => djVm.setTempoRate(val, isOwner: true),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Crossfade Duration Selector
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: isDark ? AppColors.surfaceDark : Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  isArabic ? 'تلاشي الانتقال (Crossfade)' : 'Crossfade Transition',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [0, 2, 4, 6].map((sec) {
                    final isSel = djVm.crossfadeDurationSeconds == sec;
                    return Padding(
                      padding: const EdgeInsets.only(left: 4),
                      child: ChoiceChip(
                        label: Text(sec == 0 ? (isArabic ? 'قطع' : 'Cut') : '${sec}s',
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: isSel ? Colors.white : null)),
                        selected: isSel,
                        selectedColor: AppColors.primary,
                        onSelected: (selected) => djVm.setCrossfadeDuration(selected ? sec : 0),
                      ),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Beat Looper Modes
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: isDark ? AppColors.surfaceDark : Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      isArabic ? 'تكرار النبضات (Beat Looper)' : 'Beat Looper',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      djVm.loopMode == 'off' ? 'OFF' : djVm.loopMode.toUpperCase(),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: djVm.loopMode != 'off' ? AppColors.accentCyan : Colors.grey,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: ['off', '4s', '8s', '16s'].map((mode) {
                    final isSel = djVm.loopMode == mode;
                    return ChoiceChip(
                      label: Text(mode.toUpperCase(),
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: isSel ? Colors.white : null)),
                      selected: isSel,
                      selectedColor: AppColors.accentSky,
                      onSelected: (selected) => djVm.setLoopMode(selected ? mode : 'off'),
                    );
                  }).toList(),
                ),
                if (djVm.loopMode != 'off')
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppColors.accentSky.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.accentSky.withValues(alpha: 0.5)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.repeat_rounded, size: 16, color: AppColors.accentSky),
                              const SizedBox(width: 6),
                              Text(
                                '${isArabic ? "تكرار نشط" : "Active Loop"}: ${_formatDuration(djVm.loopStartTime)} ➔ ${_formatDuration(djVm.loopStartTime + Duration(seconds: djVm.loopDurationSeconds))}',
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.accentSky),
                              ),
                            ],
                          ),
                          InkWell(
                            onTap: () => djVm.setLoopMode('off'),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.red.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                isArabic ? 'إلغاء' : 'Exit',
                                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.redAccent),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // DJ Filters
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: isDark ? AppColors.surfaceDark : Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      isArabic ? 'فلتر الـ DJ المباشر' : 'DJ Filter Style',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      djVm.filterPreset.toUpperCase(),
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.accentCyan),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Wrap(
                  spacing: 6,
                  children: [
                    {'key': 'normal', 'label': 'Clean'},
                    {'key': 'bass', 'label': 'Bass+'},
                    {'key': 'muffled', 'label': 'Club'},
                    {'key': 'treble', 'label': 'Treble'},
                    {'key': 'lofi', 'label': 'Lo-Fi'},
                  ].map((f) {
                    final isSel = djVm.filterPreset == f['key'];
                    return ChoiceChip(
                      label: Text(f['label']!,
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: isSel ? Colors.white : null)),
                      selected: isSel,
                      selectedColor: AppColors.primary,
                      onSelected: (_) => djVm.setFilterPreset(f['key']!, isOwner: true),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // DJ Soundboard Section
          Text(
            isArabic ? 'لوحة مؤثرات الدي جي (مباشر لحظي)' : 'DJ Soundboard (Zero Latency SFX)',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          ),
          const SizedBox(height: 8),

          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _buildSfxButton('airhorn', '📢 Airhorn', djVm),
              _buildSfxButton('scratch', '🎛️ Scratch', djVm),
              _buildSfxButton('drop', '💣 808 Drop', djVm),
              _buildSfxButton('applause', '👏 Applause', djVm),
              _buildSfxButton('cheer', '🎉 Cheer', djVm),
              _buildSfxButton('laugh', '😂 Laugh', djVm),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSfxButton(String effectKey, String label, DjDeckViewModel djVm) {
    return ActionChip(
      label: Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
      onPressed: () => djVm.triggerSoundEffect(effectKey),
      backgroundColor: AppColors.surfaceDark,
      side: const BorderSide(color: AppColors.borderDark),
    );
  }
}
