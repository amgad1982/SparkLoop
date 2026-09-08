import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Radio,
  Music,
  Plus,
  Trash2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Disc3,
  Users,
  Globe,
  Lock,
  Sparkles,
  Loader2,
  Mic,
  MicOff,
  RadioTower,
  Sliders,
  Check,
  Search,
  UploadCloud,
  Headphones,
  Cloud,
  ShieldCheck,
  Music2,
  Repeat,
} from 'lucide-react';
import { useDjRadioStore } from '../../stores/useDjRadioStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { DjListDto, DjTrackDto } from '../../types/api';
import { apiClient } from '../../services/apiClient';
import { CopyrightAgreementModal } from './CopyrightAgreementModal';
import { UserMusicLibraryView } from './UserMusicLibraryView';
import { TrackLibrarySelectorModal } from './TrackLibrarySelectorModal';

const GENRES = ['All', 'Chill', 'Lofi', 'Synthwave', 'Ambient', 'Electronic', 'Acoustic', 'HipHop'];

export const DjDeckModal: React.FC = () => {
  const {
    stations,
    activeStation,
    currentTrackIndex,
    isLoading,
    isPlaying,
    currentTime,
    duration,
    volume,
    crossfadeDuration,
    tempoRate,
    loopMode,
    loopStartTime,
    filterPreset,
    isBroadcasting,
    isLiveMicActive,
    listenersCount,
    isModalOpen,
    activeModalTab,
    closeModal,
    setActiveModalTab,
    fetchStations,
    openStation,
    closeStation,
    playTrack,
    crossfadeToTrack,
    togglePlayPause,
    nextTrack,
    previousTrack,
    seek,
    cueTrack,
    setTempoRate,
    setLoopMode,
    setFilterPreset,
    setCrossfadeDuration,
    setVolume,
    toggleBroadcast,
    toggleLiveMic,
    triggerSfx,
    createStation,
    toggleStationPrivacy,
    deleteStation,
  } = useDjRadioStore();

  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';
  const { currentPersona } = useAuthStore();

  const [selectedGenre, setSelectedGenre] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state for creating a new station
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newGenre, setNewGenre] = useState('Chill');
  const [isPublic, setIsPublic] = useState(true);
  const [newTracks, setNewTracks] = useState<
    Array<{
      id: string;
      title: string;
      artist: string;
      duration: number;
      file?: File;
      blobUrl: string;
      isServerHosted?: boolean;
      serverUrl?: string;
      attestationId?: string;
    }>
  >([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cloudFileInputRef = useRef<HTMLInputElement | null>(null);

  // Cloud upload & copyright modal state
  const [isCopyrightModalOpen, setIsCopyrightModalOpen] = useState(false);
  const [pendingCloudTracks, setPendingCloudTracks] = useState<
    Array<{ file: File; title: string; artist: string; durationSeconds: number }>
  >([]);
  const [isUploadingCloud, setIsUploadingCloud] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<
    { current: number; total: number; trackTitle: string } | undefined
  >(undefined);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isLibrarySelectorOpen, setIsLibrarySelectorOpen] = useState(false);

  useEffect(() => {
    if (isModalOpen) {
      fetchStations();
    }
  }, [isModalOpen]);

  if (!isModalOpen) return null;

  const currentTrack =
    activeStation && activeStation.tracks && activeStation.tracks.length > 0
      ? activeStation.tracks[currentTrackIndex] || activeStation.tracks[0]
      : null;

  const isOwner = Boolean(activeStation && currentPersona && activeStation.userId === currentPersona.id);
  const safeStations = Array.isArray(stations) ? stations : [];

  // Filter stations for Explore
  const exploreStations = safeStations.filter((s) => {
    if (selectedGenre !== 'All' && s.genre.toLowerCase() !== selectedGenre.toLowerCase()) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q) ||
        s.userDisplayName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Filter stations for My Stations
  const myStations = safeStations.filter((s) => currentPersona && s.userId === currentPersona.id);

  // Handle local device file picker (ZERO SERVER UPLOADS)
  const handleLocalFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const added: Array<{ id: string; title: string; artist: string; duration: number; file: File; blobUrl: string }> = [];

    Array.from(files).forEach((file) => {
      const blobUrl = URL.createObjectURL(file);
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      const trackId = `track-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      added.push({
        id: trackId,
        title: cleanTitle,
        artist: currentPersona?.displayName || 'DJ',
        duration: 180, // Default estimate until loaded
        file,
        blobUrl,
      });

      // Probe audio duration locally
      const audioProbe = new Audio();
      audioProbe.src = blobUrl;
      audioProbe.onloadedmetadata = () => {
        if (audioProbe.duration && isFinite(audioProbe.duration)) {
          setNewTracks((prev) =>
            prev.map((t) => (t.id === trackId ? { ...t, duration: Math.round(audioProbe.duration) } : t))
          );
        }
      };
    });

    setNewTracks((prev) => [...prev, ...added]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle cloud file selection & open copyright modal
  const handleCloudFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const list: Array<{ file: File; title: string; artist: string; durationSeconds: number }> = [];

    Array.from(files).forEach((file) => {
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      list.push({
        file,
        title: cleanTitle,
        artist: currentPersona?.displayName || 'DJ',
        durationSeconds: 180,
      });

      // Probe audio duration
      const probeUrl = URL.createObjectURL(file);
      const audioProbe = new Audio();
      audioProbe.src = probeUrl;
      audioProbe.onloadedmetadata = () => {
        if (audioProbe.duration && isFinite(audioProbe.duration)) {
          setPendingCloudTracks((prev) =>
            prev.map((p) => (p.file === file ? { ...p, durationSeconds: Math.round(audioProbe.duration) } : p))
          );
        }
        URL.revokeObjectURL(probeUrl);
      };
    });

    setPendingCloudTracks(list);
    setIsCopyrightModalOpen(true);
    if (cloudFileInputRef.current) {
      cloudFileInputRef.current.value = '';
    }
  };

  // Upload attested tracks to server (MinIO)
  const handleConfirmCloudUpload = async () => {
    if (pendingCloudTracks.length === 0) return;
    setIsUploadingCloud(true);
    setUploadError(null);

    const uploadedResults: Array<{
      id: string;
      title: string;
      artist: string;
      duration: number;
      blobUrl: string;
      isServerHosted: boolean;
      serverUrl: string;
      attestationId: string;
    }> = [];

    for (let i = 0; i < pendingCloudTracks.length; i++) {
      const item = pendingCloudTracks[i];
      setUploadProgress({
        current: i + 1,
        total: pendingCloudTracks.length,
        trackTitle: item.title,
      });

      try {
        const res = await apiClient.uploadMusicTrack(item.file, item.file.name, {
          title: item.title,
          artist: item.artist,
          durationSeconds: item.durationSeconds,
          acceptCopyrightPolicy: true,
          policyVersion: '1.0',
        });

        uploadedResults.push({
          id: res.trackId || `cloud-${Date.now()}-${i}`,
          title: res.title || item.title,
          artist: res.artist || item.artist,
          duration: Math.round(res.durationSeconds || item.durationSeconds || 180),
          blobUrl: res.url,
          isServerHosted: true,
          serverUrl: res.url,
          attestationId: res.attestationId,
        });
      } catch (err: any) {
        console.error('Failed to upload track:', item.title, err);
        setUploadError(err.message || 'Failed to upload audio track');
        break;
      }
    }

    if (uploadedResults.length > 0) {
      setNewTracks((prev) => [...prev, ...uploadedResults]);
    }

    setIsUploadingCloud(false);
    setUploadProgress(undefined);
    setIsCopyrightModalOpen(false);
    setPendingCloudTracks([]);
  };

  const handleCreateStationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsCreating(true);
    try {
      const localUrlsMap: Record<string, string> = {};
      const trackDtos: DjTrackDto[] = newTracks.map((t) => {
        if (t.isServerHosted && t.serverUrl) {
          localUrlsMap[t.id] = t.serverUrl;
          return {
            id: t.id,
            title: t.title,
            artist: t.artist,
            url: t.serverUrl,
            durationSeconds: t.duration,
            isServerHosted: true,
            attestationId: t.attestationId,
          };
        }
        localUrlsMap[t.id] = t.blobUrl;
        return {
          id: t.id,
          title: t.title,
          artist: t.artist,
          url: '', // Left blank because files are streamed from device without server upload
          durationSeconds: t.duration,
          isServerHosted: false,
        };
      });

      const created = await createStation(
        {
          title: newTitle.trim(),
          description: newDesc.trim() || undefined,
          genre: newGenre,
          coverUrl: undefined,
          isPublic,
          followersOnly: !isPublic,
          tracks: trackDtos,
        },
        localUrlsMap
      );

      setCreateSuccess(true);
      setTimeout(() => {
        setCreateSuccess(false);
        setNewTitle('');
        setNewDesc('');
        setNewTracks([]);
        openStation(created, localUrlsMap, true);
      }, 1000);
    } catch (err) {
      console.error('Failed to create station:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const formatSeconds = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-fuchsia-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-fuchsia-600/30">
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                {isArabic ? 'محطات الراديو واستوديو الـ DJ' : 'Radio Stations & DJ Deck'}
                <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 tracking-wider uppercase">
                  Live Deck
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {isArabic
                  ? 'بث مباشر للموسيقى وتشغيل متزامن في الخلفية'
                  : 'Live synchronized music streaming and background playback'}
              </p>
            </div>
          </div>

          <button
            onClick={closeModal}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-5 py-2.5 bg-slate-900/60 border-b border-slate-800/60 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveModalTab('explore')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeModalTab === 'explore'
                ? 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            {isArabic ? 'استكشاف المحطات' : 'Explore Stations'}
          </button>

          <button
            onClick={() => setActiveModalTab('my')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeModalTab === 'my'
                ? 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            {isArabic ? 'محطاتي' : 'My Stations'}
          </button>

          <button
            onClick={() => setActiveModalTab('tracks')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeModalTab === 'tracks'
                ? 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Music2 className="w-3.5 h-3.5" />
            {isArabic ? 'مكتبتي الموسيقية' : 'My Tracks'}
          </button>

          <button
            onClick={() => setActiveModalTab('create')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeModalTab === 'create'
                ? 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            {isArabic ? 'إنشاء محطة جديدة' : 'Create Station'}
          </button>

          {activeStation && (
            <button
              onClick={() => setActiveModalTab('deck')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ml-auto ${
                activeModalTab === 'deck'
                  ? 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-md shadow-fuchsia-600/30'
                  : 'text-fuchsia-400 hover:text-white hover:bg-fuchsia-500/10 border border-fuchsia-500/30'
              }`}
            >
              <Disc3 className={`w-3.5 h-3.5 ${isPlaying ? 'animate-spin' : ''}`} />
              <span>{activeStation.title}</span>
              {isBroadcasting && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping ml-1" />
              )}
            </button>
          )}
        </div>

        {/* Tab Content Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* TAB: EXPLORE */}
          {activeModalTab === 'explore' && (
            <div className="space-y-4">
              {/* Search & Genre Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isArabic ? 'ابحث عن محطة أو منسق موسيقى...' : 'Search stations or DJs...'}
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-fuchsia-500"
                  />
                </div>

                {/* Genre Selector */}
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {GENRES.map((genre) => (
                    <button
                      key={genre}
                      onClick={() => setSelectedGenre(genre)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap transition-all ${
                        selectedGenre === genre
                          ? 'bg-fuchsia-600 text-white'
                          : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>

              {/* Station Grid */}
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                  <Loader2 className="w-8 h-8 text-fuchsia-500 animate-spin" />
                  <p className="text-xs">{isArabic ? 'جاري تحميل المحطات...' : 'Tuning into radio stations...'}</p>
                </div>
              ) : exploreStations.length === 0 ? (
                <div className="text-center py-16 bg-slate-800/20 border border-dashed border-slate-800 rounded-3xl p-8">
                  <Radio className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-300">
                    {isArabic ? 'لا توجد محطات راديو حالياً' : 'No radio stations found'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {isArabic
                      ? 'كن أول من يطلق محطته الإذاعية الخاصة ويبث موسيقاه من جهازه مباشرة!'
                      : 'Be the first to create your own radio station and stream music live from your device!'}
                  </p>
                  <button
                    onClick={() => setActiveModalTab('create')}
                    className="mt-4 px-4 py-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-xs font-bold text-white transition-colors cursor-pointer"
                  >
                    {isArabic ? 'إنشاء محطة الآن' : 'Create a Station Now'}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {exploreStations.map((st) => (
                    <div
                      key={st.id}
                      className="group relative overflow-hidden rounded-2xl bg-slate-800/50 border border-slate-700/60 hover:border-fuchsia-500/50 p-4 transition-all duration-200 flex flex-col justify-between shadow-lg"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 uppercase">
                            {st.genre}
                          </span>

                          <div className="flex items-center gap-2">
                            {st.isLive ? (
                              <span className="flex items-center gap-1 text-[10px] font-black uppercase text-red-400 bg-red-500/20 px-2 py-0.5 rounded border border-red-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                                LIVE
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                                {isArabic ? 'غير متصل' : 'OFFLINE'}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {st.listenersCount || 0}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-fuchsia-950 to-slate-900 border border-fuchsia-500/30 flex items-center justify-center flex-shrink-0">
                            <Disc3 className="w-6 h-6 text-fuchsia-400 group-hover:rotate-45 transition-transform" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-white truncate">{st.title}</h3>
                            <p className="text-xs text-slate-400 truncate">
                              DJ {st.userDisplayName || st.username}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {st.trackCount} {isArabic ? 'مسار موسيقي' : 'tracks'}
                            </p>
                          </div>
                        </div>

                        {st.description && (
                          <p className="text-xs text-slate-400 line-clamp-2 mb-3">{st.description}</p>
                        )}
                      </div>

                      {st.isLive || (currentPersona && st.userId === currentPersona.id) ? (
                        <button
                          onClick={() => openStation(st, undefined, true)}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-2 shadow-md shadow-fuchsia-600/20 transition-all cursor-pointer active:scale-98"
                        >
                          <Headphones className="w-3.5 h-3.5" />
                          {currentPersona && st.userId === currentPersona.id
                            ? (isArabic ? 'استوديو البث' : 'DJ Deck')
                            : (isArabic ? 'استمع للمحطة' : 'Tune In')}
                        </button>
                      ) : (
                        <button
                          onClick={() => openStation(st, undefined, false)}
                          className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-xs font-bold text-slate-400 hover:text-slate-300 flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          <Radio className="w-3.5 h-3.5" />
                          {isArabic ? 'المحطة غير متصلة 📻' : 'Station Offline 📻'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: MY STATIONS */}
          {activeModalTab === 'my' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isArabic ? 'محطاتي الإذاعية' : 'My Broadcast Stations'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isArabic
                      ? 'إدارة محطاتك، التحكم في الخصوصية (عام أو خاص)، والبث المباشر'
                      : 'Manage your stations, toggle privacy (Public vs Private), and broadcast live'}
                  </p>
                </div>

                <button
                  onClick={() => setActiveModalTab('create')}
                  className="px-3 py-1.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isArabic ? 'إنشاء محطة' : 'New Station'}
                </button>
              </div>

              {myStations.length === 0 ? (
                <div className="text-center py-16 bg-slate-800/20 border border-dashed border-slate-800 rounded-3xl p-8">
                  <Radio className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-300">
                    {isArabic ? 'لم تقم بإنشاء أي محطة حتى الآن' : 'You have not created any radio stations yet'}
                  </p>
                  <button
                    onClick={() => setActiveModalTab('create')}
                    className="mt-4 px-4 py-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-xs font-bold text-white transition-colors cursor-pointer"
                  >
                    {isArabic ? 'إنشاء محطة الآن' : 'Create My First Station'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {myStations.map((st) => (
                    <div
                      key={st.id}
                      className="rounded-2xl bg-slate-800/40 border border-slate-700/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-fuchsia-950/60 border border-fuchsia-500/30 flex items-center justify-center flex-shrink-0">
                          <Disc3 className="w-6 h-6 text-fuchsia-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">{st.title}</h4>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-300">
                              {st.genre}
                            </span>
                            {st.isLive && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase text-red-400 bg-red-500/20 border border-red-500/30">
                                LIVE
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {st.trackCount} {isArabic ? 'مسارات' : 'tracks'} • {st.listenersCount || 0}{' '}
                            {isArabic ? 'مستمع' : 'listeners'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Privacy Toggle: Public vs Private */}
                        <button
                          onClick={() => toggleStationPrivacy(st.id, !st.isPublic)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                            st.isPublic
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                          }`}
                          title={st.isPublic ? 'Visible in Explore' : 'Private (Followers only)'}
                        >
                          {st.isPublic ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          <span>{st.isPublic ? (isArabic ? 'عامة' : 'Public') : (isArabic ? 'خاصة' : 'Private')}</span>
                        </button>

                        <button
                          onClick={() => openStation(st, undefined, true)}
                          className="px-4 py-1.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Disc3 className="w-3.5 h-3.5" />
                          {isArabic ? 'استوديو البث' : 'Open DJ Deck'}
                        </button>

                        <button
                          onClick={() => {
                            if (window.confirm(isArabic ? 'هل أنت متأكد من حذف هذه المحطة؟' : 'Are you sure you want to delete this station?')) {
                              deleteStation(st.id);
                            }
                          }}
                          className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-700/60 transition-colors cursor-pointer"
                          title={isArabic ? 'حذف المحطة' : 'Delete station'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: MY MUSIC TRACKS */}
          {activeModalTab === 'tracks' && (
            <UserMusicLibraryView />
          )}

          {/* TAB: CREATE STATION */}
          {activeModalTab === 'create' && (
            <form onSubmit={handleCreateStationSubmit} className="space-y-4 max-w-xl mx-auto">
              <div className="p-3.5 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/30 text-xs text-fuchsia-300 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-fuchsia-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold">
                    {isArabic ? 'بث صوتي مباشر:' : 'Live Synchronized Broadcast:'}
                  </span>{' '}
                  {isArabic
                    ? 'يتم بث نغماتك للمستمعين بجودة عالية وبشكل متزامن وبث إذاعي فوري.'
                    : 'Stream your music tracks live and synchronized to all your listeners in real time.'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isArabic ? 'عنوان المحطة' : 'Station Title'} *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={isArabic ? 'مثال: نبض السهارى Lofi Radio' : 'e.g. Midnight Cyber Lofi Radio'}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isArabic ? 'الوصف' : 'Description'}
                </label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder={isArabic ? 'وصف للمحطة وللموسيقى التي تبثها...' : 'A brief description about your station...'}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {isArabic ? 'نوع الموسيقى (Genre)' : 'Genre'}
                  </label>
                  <select
                    value={newGenre}
                    onChange={(e) => setNewGenre(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-fuchsia-500"
                  >
                    {GENRES.filter((g) => g !== 'All').map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {isArabic ? 'مستوى الخصوصية' : 'Privacy Visibility'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsPublic(!isPublic)}
                    className={`w-full px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                      isPublic
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    }`}
                  >
                    {isPublic ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    <span>{isPublic ? (isArabic ? 'عامة (مستكشفة)' : 'Public (Explore)') : (isArabic ? 'خاصة (المتابعين فقط)' : 'Private (Followers)')}</span>
                  </button>
                </div>
              </div>

              {/* Music Playlist Selection (Cloud Upload vs Local Device Streaming) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-300">
                    {isArabic ? 'قائمة المقطوعات الموسيقية' : 'Music Playlist'}
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {newTracks.length} {isArabic ? 'مسارات مختارة' : 'tracks selected'}
                  </span>
                </div>

                {/* Hidden File Inputs */}
                <input
                  type="file"
                  multiple
                  accept="audio/*"
                  ref={fileInputRef}
                  onChange={handleLocalFilesSelected}
                  className="hidden"
                />
                <input
                  type="file"
                  multiple
                  accept="audio/*"
                  ref={cloudFileInputRef}
                  onChange={handleCloudFilesSelected}
                  className="hidden"
                />

                {/* Upload Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Option 1: Select from Cloud Library */}
                  <div
                    onClick={() => setIsLibrarySelectorOpen(true)}
                    className="group border border-fuchsia-500/40 hover:border-fuchsia-400 bg-gradient-to-b from-fuchsia-500/10 via-slate-800/40 to-slate-800/60 rounded-2xl p-4 text-center cursor-pointer transition-all duration-200 shadow-lg shadow-fuchsia-500/5 hover:shadow-fuchsia-500/10"
                  >
                    <div className="w-9 h-9 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/40 flex items-center justify-center text-fuchsia-400 mx-auto mb-2 group-hover:scale-105 transition-transform">
                      <Music2 className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-white group-hover:text-fuchsia-200 transition-colors">
                      {isArabic ? 'اختر من مكتبتي 🎵' : 'My Music Library 🎵'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                      {isArabic
                        ? 'اختر من مقاطعك الموسيقية المرفوعة مسبقاً'
                        : 'Choose from your pre-uploaded music tracks'}
                    </p>
                  </div>

                  {/* Option 2: Cloud Server Upload (With Copyright Attestation) */}
                  <div
                    onClick={() => cloudFileInputRef.current?.click()}
                    className="group border border-amber-500/30 hover:border-amber-400/80 bg-gradient-to-b from-amber-500/10 via-slate-800/40 to-slate-800/60 rounded-2xl p-4 text-center cursor-pointer transition-all duration-200 shadow-lg shadow-amber-500/5 hover:shadow-amber-500/10 relative overflow-hidden"
                  >
                    <div className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-semibold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      <span>{isArabic ? 'إقرار ملكية' : 'Ownership'}</span>
                    </div>

                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto mb-2 group-hover:scale-105 transition-transform">
                      <Cloud className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-white group-hover:text-amber-200 transition-colors">
                      {isArabic ? 'رفع سحابي جديد ☁️' : 'Upload to Cloud ☁️'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                      {isArabic
                        ? 'رفع وحفظ بالمكتبة مع إقرار الملكية الفكرية'
                        : 'Upload & save to library with legal attestation'}
                    </p>
                  </div>

                  {/* Option 3: Local Stream from Device (Zero Server Upload) */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="group border border-slate-700/80 hover:border-fuchsia-500/70 bg-slate-800/30 hover:bg-slate-800/60 rounded-2xl p-4 text-center cursor-pointer transition-all duration-200"
                  >
                    <div className="w-9 h-9 rounded-xl bg-slate-700/40 border border-slate-600/40 flex items-center justify-center text-slate-300 mx-auto mb-2 group-hover:scale-105 transition-transform">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-200 group-hover:text-fuchsia-200 transition-colors">
                      {isArabic ? 'بث من جهازك 💻' : 'Stream Device 💻'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                      {isArabic
                        ? 'بث مباشر فوري بدون رفع للسيرفر'
                        : 'Direct device streaming zero upload'}
                    </p>
                  </div>
                </div>

                {/* Upload Error Banner if any */}
                {uploadError && (
                  <div className="mt-2.5 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-center justify-between">
                    <span>{uploadError}</span>
                    <button
                      type="button"
                      onClick={() => setUploadError(null)}
                      className="text-red-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Selected Tracks List with Cloud/Local Badges */}
                {newTracks.length > 0 && (
                  <div className="mt-3 space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {newTracks.map((tr, idx) => (
                      <div
                        key={tr.id}
                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-slate-500 font-mono text-[10px] w-4">{idx + 1}</span>
                          <Music className="w-3.5 h-3.5 text-fuchsia-400 flex-shrink-0" />
                          <span className="text-white font-medium truncate">{tr.title}</span>
                          <span className="text-slate-400 text-[10px] whitespace-nowrap">
                            ({formatSeconds(tr.duration)})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setNewTracks((prev) => prev.filter((t) => t.id !== tr.id))}
                            className="text-slate-500 hover:text-red-400 transition-colors p-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isCreating || !newTitle.trim()}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-fuchsia-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isArabic ? 'جاري إطلاق المحطة...' : 'Launching Station...'}</span>
                  </>
                ) : createSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>{isArabic ? 'تم إطلاق المحطة بنجاح!' : 'Station Launched!'}</span>
                  </>
                ) : (
                  <>
                    <RadioTower className="w-4 h-4" />
                    <span>{isArabic ? 'إطلاق المحطة وتشغيل استوديو الـ DJ' : 'Launch Station & Open DJ Deck'}</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB: DJ DECK PLAYER */}
          {activeModalTab === 'deck' && activeStation && (
            <div className="space-y-6">
              {/* Station Header in Deck */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-white">{activeStation.title}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 uppercase">
                      {activeStation.genre}
                    </span>
                    {activeStation.isPublic ? (
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {isArabic ? 'عامة' : 'Public'}
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        {isArabic ? 'خاصة' : 'Private'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    DJ {activeStation.userDisplayName || activeStation.username} • {activeStation.tracks.length}{' '}
                    {isArabic ? 'مسارات' : 'tracks'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs">
                    <Users className="w-3.5 h-3.5 text-fuchsia-400" />
                    <span className="font-bold text-white">{typeof listenersCount === 'number' ? listenersCount : ((listenersCount as any)?.listenersCount ?? 0)}</span>
                    <span className="text-slate-400">{isArabic ? 'مستمع' : 'listening'}</span>
                  </div>
                </div>
              </div>

              {/* Offline Station Banner for Listeners */}
              {!isOwner && !isBroadcasting && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
                  <Radio className="w-5 h-5 flex-shrink-0 text-amber-400" />
                  <div>
                    <h5 className="text-xs font-bold">
                      {isArabic ? 'المحطة غير متصلة حالياً 📻' : 'Station is Currently Offline 📻'}
                    </h5>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isArabic
                        ? `بانتظار بدء بث الدي جي ${activeStation.userDisplayName || activeStation.username}. سيبدأ البث والموسيقى تلقائياً فور انطلاقه.`
                        : `Waiting for DJ ${activeStation.userDisplayName || activeStation.username} to go live. Audio streams automatically once broadcast starts.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Turntable Section */}
              <div className="relative flex flex-col md:flex-row items-center justify-center gap-8 py-4 px-4 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 rounded-3xl border border-fuchsia-500/20 shadow-inner">
                {/* Vinyl Record */}
                <div className="relative w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center">
                  {/* Outer Vinyl Platter */}
                  <div
                    className={`relative w-full h-full rounded-full bg-gradient-to-tr from-slate-950 via-zinc-900 to-slate-950 border-4 border-slate-800 shadow-2xl flex items-center justify-center transition-transform ${
                      isPlaying ? 'animate-spin' : ''
                    }`}
                    style={{ animationDuration: `${(3 / (tempoRate || 1)).toFixed(2)}s` }}
                  >
                    {/* Vinyl grooves */}
                    <div className="absolute inset-4 rounded-full border border-slate-800/80 pointer-events-none" />
                    <div className="absolute inset-8 rounded-full border border-slate-800/60 pointer-events-none" />
                    <div className="absolute inset-12 rounded-full border border-slate-800/50 pointer-events-none" />
                    <div className="absolute inset-16 rounded-full border border-slate-800/40 pointer-events-none" />

                    {/* Center Vinyl Label */}
                    <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-fuchsia-600 via-purple-700 to-indigo-600 border-2 border-fuchsia-400/80 shadow-lg flex flex-col items-center justify-center text-center p-2 text-white">
                      <Disc3 className="w-5 h-5 text-white mb-0.5" />
                      <p className="text-[9px] font-black uppercase tracking-wider truncate w-16">
                        {activeStation.genre}
                      </p>
                      <div className="w-3 h-3 rounded-full bg-slate-950 border border-white/60 mt-1" />
                    </div>
                  </div>

                  {/* Tonearm */}
                  <div
                    className="absolute top-2 right-2 w-20 h-28 pointer-events-none transition-transform duration-700 origin-top-right"
                    style={{
                      transform: isPlaying ? 'rotate(22deg)' : 'rotate(0deg)',
                    }}
                  >
                    <div className="w-4 h-4 rounded-full bg-slate-400 border border-white shadow-md ml-auto" />
                    <div className="w-1.5 h-20 bg-gradient-to-b from-slate-300 to-slate-500 mx-auto -mt-1 shadow" />
                    <div className="w-3 h-5 bg-fuchsia-500 rounded-sm shadow-md mx-auto" />
                  </div>
                </div>

                {/* Track Details & Visualizer */}
                <div className="flex-1 w-full flex flex-col items-center md:items-start text-center md:text-left">
                  <span className="text-[11px] font-bold text-fuchsia-400 tracking-wider uppercase mb-1">
                    {isArabic ? 'المسار الحالي' : 'Now Spinning'}
                  </span>
                  <h4 className="text-xl font-black text-white truncate max-w-full">
                    {currentTrack ? currentTrack.title : (isArabic ? 'لا توجد مسارات مضافة' : 'No tracks loaded')}
                  </h4>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    {currentTrack ? currentTrack.artist : activeStation.username}
                  </p>

                  {/* Sound Wave Visualizer Bars */}
                  <div className="flex items-center gap-1.5 h-8 my-4">
                    {[16, 28, 12, 36, 22, 14, 30, 24, 18, 32, 20, 10, 26, 34].map((h, i) => (
                      <div
                        key={i}
                        className="w-1.5 rounded-full bg-gradient-to-t from-fuchsia-600 to-indigo-400 transition-all duration-150"
                        style={{
                          height: isPlaying ? `${Math.max(6, (h * (Math.sin(i + currentTime * 3) + 1.2)) / 1.5)}px` : '6px',
                          opacity: isPlaying ? 0.9 : 0.3,
                        }}
                      />
                    ))}
                  </div>

                  {/* Controls: DJ Studio Controls (Owner) vs Radio Receiver Bar (Listener) */}
                  {isOwner ? (
                    <>
                      {/* Scrubber (Owner only) */}
                      <div className="w-full space-y-1">
                        <input
                          type="range"
                          min={0}
                          max={duration || 100}
                          value={currentTime || 0}
                          onChange={(e) => seek(parseFloat(e.target.value))}
                          className="w-full accent-fuchsia-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                        />
                        <div className="flex justify-between text-[11px] font-mono text-slate-400">
                          <span>{formatSeconds(currentTime)}</span>
                          <span>{formatSeconds(duration)}</span>
                        </div>
                      </div>

                      {/* Media Controls (Owner only) */}
                      <div className="flex flex-wrap items-center gap-3 mt-4">
                        <button
                          onClick={cueTrack}
                          className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-black text-xs tracking-wider cursor-pointer active:scale-95 shadow-md shadow-amber-500/10"
                          title={isArabic ? 'نقطة البداية (CUE)' : 'DJ Cue (Seek 0:00 / Pause)'}
                        >
                          CUE
                        </button>

                        <button
                          onClick={previousTrack}
                          className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white transition-colors cursor-pointer active:scale-95"
                          title={isArabic ? 'السابق' : 'Previous'}
                        >
                          <SkipBack className="w-5 h-5" />
                        </button>

                        <button
                          onClick={togglePlayPause}
                          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white transition-transform bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 shadow-xl shadow-fuchsia-600/40 cursor-pointer active:scale-95"
                          title={isPlaying ? (isArabic ? 'إيقاف مؤقت' : 'Pause') : (isArabic ? 'تشغيل' : 'Play')}
                        >
                          {isPlaying ? (
                            <Pause className="w-6 h-6 fill-white" />
                          ) : (
                            <Play className="w-6 h-6 fill-white ml-1" />
                          )}
                        </button>

                        <button
                          onClick={nextTrack}
                          className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white transition-colors cursor-pointer active:scale-95"
                          title={isArabic ? 'التالي' : 'Next'}
                        >
                          <SkipForward className="w-5 h-5" />
                        </button>

                        {/* Volume Slider */}
                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            onClick={() => setVolume(volume > 0 ? 0 : 0.85)}
                            className="text-slate-400 hover:text-white cursor-pointer"
                          >
                            {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          </button>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={volume}
                            onChange={(e) => setVolume(parseFloat(e.target.value))}
                            className="w-20 accent-fuchsia-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* DJ Professional Control Strip (Pitch/Tempo & Crossfade) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3 w-full">
                        {/* Tempo / Pitch Speed Slider */}
                        <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[11px] font-bold text-slate-300">
                              {isArabic ? 'السرعة' : 'Tempo'}:
                            </span>
                            <span className="font-mono text-[11px] font-bold text-fuchsia-400 bg-fuchsia-500/10 px-1.5 py-0.5 rounded">
                              {tempoRate.toFixed(2)}x
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-1 max-w-[140px]">
                            <input
                              type="range"
                              min={0.8}
                              max={1.2}
                              step={0.01}
                              value={tempoRate}
                              onChange={(e) => setTempoRate(parseFloat(e.target.value))}
                              className="w-full accent-fuchsia-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                            />
                            <button
                              onClick={() => setTempoRate(1.0)}
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                              title="Reset tempo to 1.0x"
                            >
                              1.0x
                            </button>
                          </div>
                        </div>

                        {/* Crossfade Transition Selector */}
                        <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                          <span className="text-[11px] font-bold text-slate-300 flex-shrink-0">
                            {isArabic ? 'تلاشي الانتقال' : 'Crossfade'}:
                          </span>
                          <div className="flex items-center gap-1">
                            {[
                              { val: 0, label: isArabic ? 'إيقاف' : 'Cut' },
                              { val: 2, label: '2s' },
                              { val: 4, label: '4s' },
                              { val: 6, label: '6s' },
                            ].map((opt) => (
                              <button
                                key={opt.val}
                                onClick={() => setCrossfadeDuration(opt.val)}
                                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                                  crossfadeDuration === opt.val
                                    ? 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-sm shadow-fuchsia-600/30'
                                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Beat Looper & DJ Filter Presets */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2 w-full">
                        {/* Beat Looper */}
                        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-300">
                              🔁 {isArabic ? 'تكرار النبضات (Loop)' : 'Beat Looper'}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${loopMode !== 'off' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400'}`}>
                              {loopMode === 'off' ? (isArabic ? 'معطل' : 'Off') : loopMode}
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-1">
                            {(['off', '4s', '8s', '16s'] as const).map((mode) => (
                              <button
                                key={mode}
                                onClick={() => setLoopMode(mode)}
                                className={`py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                                  loopMode === mode
                                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
                                }`}
                              >
                                {mode}
                              </button>
                            ))}
                          </div>
                          {loopMode !== 'off' && (
                            <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold mt-1.5">
                              <div className="flex items-center gap-1.5 truncate">
                                <Repeat className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                                <span className="truncate">
                                  {isArabic ? 'تكرار نشط' : 'Active Loop'}: {formatSeconds(loopStartTime)} ➔ {formatSeconds(loopStartTime + (loopMode === '4s' ? 4 : loopMode === '8s' ? 8 : 16))}
                                </span>
                              </div>
                              <button
                                onClick={() => setLoopMode('off')}
                                className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 text-[9px] font-bold transition-all cursor-pointer flex-shrink-0 ml-1"
                              >
                                {isArabic ? 'إلغاء' : 'Exit'}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* DJ Filters */}
                        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-300">
                              🎛️ {isArabic ? 'فلتر الـ DJ' : 'DJ Filter'}
                            </span>
                            <span className="text-[10px] font-bold text-fuchsia-400 uppercase">
                              {filterPreset}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap">
                            {[
                              { key: 'normal', label: 'Clean' },
                              { key: 'bass', label: 'Bass+' },
                              { key: 'muffled', label: 'Club' },
                              { key: 'treble', label: 'Treble' },
                              { key: 'lofi', label: 'Lo-Fi' },
                            ].map((f) => (
                              <button
                                key={f.key}
                                onClick={() => setFilterPreset(f.key as any)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                  filterPreset === f.key
                                    ? 'bg-fuchsia-600 text-white shadow-sm shadow-fuchsia-600/30'
                                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
                                }`}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Listener Radio Station Receiver Bar */}
                      <div className="w-full space-y-1.5">
                        <div className="w-full h-1.5 bg-slate-800 rounded-lg overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 transition-all duration-300"
                            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] font-mono text-slate-400">
                          <span>{formatSeconds(currentTime)}</span>
                          <span className="text-fuchsia-400 font-sans font-semibold text-[10px] flex items-center gap-1">
                            <Radio className="w-3 h-3" />
                            {isBroadcasting
                              ? (isArabic ? 'بث إذاعي مباشر ومتزامن' : 'Live Synced Radio Broadcast')
                              : (isArabic ? 'البث متوقف حالياً' : 'Station Offline')}
                          </span>
                          <span>{formatSeconds(duration)}</span>
                        </div>
                      </div>

                      {/* Listener Live Synchronization Status */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs mt-3 w-full">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
                          <span className="font-bold text-white text-[11px]">
                            {isArabic ? 'متزامن مع بث الـ DJ' : 'Live Synced with Broadcaster'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-mono">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                            Pitch: {tempoRate.toFixed(2)}x
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-fuchsia-300 uppercase">
                            {filterPreset}
                          </span>
                          {crossfadeDuration > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-400 font-bold">
                              Fade {crossfadeDuration}s
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Listener Receiver Controls: Volume & Tune Out */}
                      <div className="flex items-center justify-between gap-4 mt-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800 w-full">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setVolume(volume > 0 ? 0 : 0.85)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                            title={volume === 0 ? 'Unmute' : 'Mute'}
                          >
                            {volume === 0 ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4 text-fuchsia-400" />}
                          </button>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={volume}
                            onChange={(e) => setVolume(parseFloat(e.target.value))}
                            className="w-24 accent-fuchsia-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                          />
                        </div>

                        <button
                          onClick={() => {
                            closeStation();
                            closeModal();
                          }}
                          className="px-3 py-1.5 rounded-xl border border-red-500/40 hover:bg-red-500/10 text-red-400 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>{isArabic ? 'مغادرة المحطة' : 'Tune Out'}</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Broadcaster Actions (Live Broadcast & LiveKit SFU Mic) - Owner Only */}
              {isOwner && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={toggleBroadcast}
                      className={`py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                        isBroadcasting
                          ? 'bg-red-500/20 text-red-400 border-red-500/40 shadow-lg shadow-red-500/20'
                          : 'bg-slate-800 hover:bg-slate-750 text-white border-slate-700'
                      }`}
                    >
                      <RadioTower className={`w-4 h-4 ${isBroadcasting ? 'animate-bounce' : ''}`} />
                      <span>
                        {isBroadcasting
                          ? (isArabic ? 'إيقاف البث المباشر (LIVE)' : 'Stop Live Broadcast (LIVE)')
                          : (isArabic ? 'بدء البث المباشر للمستمعين' : 'Go Live (Broadcast Station)')}
                      </span>
                    </button>

                    <button
                      onClick={toggleLiveMic}
                      className={`py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                        isLiveMicActive
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-lg shadow-emerald-500/20'
                          : 'bg-slate-800 hover:bg-slate-750 text-white border-slate-700'
                      }`}
                    >
                      {isLiveMicActive ? (
                        <>
                          <Mic className="w-4 h-4 text-emerald-400 animate-pulse" />
                          <span>{isArabic ? 'الميكروفون متصل 🎙️' : 'Live Mic Active 🎙️'}</span>
                        </>
                      ) : (
                        <>
                          <MicOff className="w-4 h-4 text-slate-400" />
                          <span>{isArabic ? 'تشغيل الميكروفون' : 'Turn On Live Mic'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* DJ Soundboard */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-fuchsia-400" />
                      <span>{isArabic ? 'لوحة مؤثرات الـ DJ (Soundboard)' : 'DJ Soundboard FX'}</span>
                    </h4>

                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                      {[
                        { key: 'scratch', label: 'Scratch', icon: '💿' },
                        { key: 'drop', label: 'Bass Drop', icon: '🔊' },
                        { key: 'airhorn', label: 'Airhorn', icon: '📢' },
                        { key: 'applause', label: 'Applause', icon: '👏' },
                        { key: 'cheer', label: 'Cheer', icon: '🥳' },
                        { key: 'laugh', label: 'Laugh', icon: '😂' },
                        { key: 'victory', label: 'Victory', icon: '🏆' },
                        { key: 'magic', label: 'Magic', icon: '✨' },
                      ].map((sfx) => (
                        <button
                          key={sfx.key}
                          onClick={() => triggerSfx(sfx.key)}
                          className="flex flex-col items-center justify-center py-2.5 px-2 rounded-xl bg-slate-800/80 hover:bg-fuchsia-600/20 border border-slate-700/60 hover:border-fuchsia-500/50 text-white transition-all cursor-pointer active:scale-90"
                        >
                          <span className="text-lg">{sfx.icon}</span>
                          <span className="text-[10px] font-bold text-slate-300 mt-1 truncate max-w-full">
                            {sfx.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Station Tracklist: Interactive Queue for DJ, Broadcast Program for Listeners */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    {isOwner
                      ? (isArabic ? 'قائمة تشغيل المحطة' : 'Station Tracklist')
                      : (isArabic ? 'جدول بث المحطة' : 'Station Broadcast Program')}
                  </h4>
                  {!isOwner && (
                    <span className="text-[10px] font-semibold text-fuchsia-400 bg-fuchsia-500/10 px-2 py-0.5 rounded border border-fuchsia-500/20">
                      {isArabic ? 'راديو مباشر • قراءة فقط' : 'Live Radio • Read Only'}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {activeStation.tracks.map((t, idx) => {
                    const isCur = idx === currentTrackIndex;
                    return (
                      <div
                        key={t.id}
                        onClick={isOwner ? () => playTrack(idx) : undefined}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-colors border ${
                          isOwner ? 'cursor-pointer' : 'cursor-default'
                        } ${
                          isCur
                            ? 'bg-fuchsia-600/20 border-fuchsia-500/40 text-white'
                            : 'bg-slate-800/40 hover:bg-slate-800/80 border-slate-700/50 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono text-slate-500 text-[11px] w-4">{idx + 1}</span>
                          {isCur && isPlaying ? (
                            <Disc3 className="w-3.5 h-3.5 text-fuchsia-400 animate-spin" />
                          ) : (
                            <Music className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <div className="truncate">
                            <p className="font-bold truncate">{t.title}</p>
                            <p className="text-[10px] text-slate-400 truncate">{t.artist}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isCur && !isOwner && (
                            <span className="flex items-center gap-1 text-[9px] font-black uppercase text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded border border-red-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                              ON AIR
                            </span>
                          )}
                          <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap">
                            {formatSeconds(t.durationSeconds)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Music Copyright Legal Agreement Modal */}
      <CopyrightAgreementModal
        isOpen={isCopyrightModalOpen}
        onClose={() => {
          if (!isUploadingCloud) {
            setIsCopyrightModalOpen(false);
            setPendingCloudTracks([]);
          }
        }}
        pendingTracks={pendingCloudTracks}
        onConfirmUpload={handleConfirmCloudUpload}
        isUploading={isUploadingCloud}
        uploadProgress={uploadProgress}
      />

      {/* Track Library Selector Modal */}
      <TrackLibrarySelectorModal
        isOpen={isLibrarySelectorOpen}
        onClose={() => setIsLibrarySelectorOpen(false)}
        onSelectTracks={(chosen) => {
          const mapped = chosen.map((t) => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            duration: t.durationSeconds,
            blobUrl: t.url,
            isServerHosted: true,
            serverUrl: t.url,
            attestationId: t.attestationId,
          }));
          setNewTracks((prev) => [...prev, ...mapped]);
        }}
        onOpenUpload={() => cloudFileInputRef.current?.click()}
        alreadySelectedUrls={newTracks.map((t) => t.serverUrl || t.blobUrl)}
      />
    </div>
  );
};
