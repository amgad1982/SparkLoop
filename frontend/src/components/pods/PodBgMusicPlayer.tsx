import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { PodBgMusicState } from '../../hooks/usePodVoiceEngine';
import {
  Disc3,
  FileAudio,
  Monitor,
  Music,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
  Square,
  Radio,
  Crown,
  Sparkles,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Royalty-free online ambient tracks for instant 1-click testing
export const PRESET_VIBES = [
  {
    id: 'lofi',
    title: '🌆 Sunset Lo-Fi Chill',
    titleAr: '🌆 موسيقى لو-فاي هادئة',
    url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
  },
  {
    id: 'synth',
    title: '⚡ Cyberpunk Synthwave Pulse',
    titleAr: '⚡ نبضات سايبر بانك نيون',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8bbf853e8.mp3?filename=synthwave-80s-110045.mp3',
  },
  {
    id: 'rain',
    title: '🌧️ Cozy Rainy Night Cafe',
    titleAr: '🌧️ مقهى ليلة ممطرة',
    url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=rain-and-nostalgia-version-60s-10820.mp3',
  },
];

interface PodBgMusicPlayerProps {
  bgMusic: PodBgMusicState;
  bgMusicVolume: number;
  isBgMusicMuted: boolean;
  isHostOrMod?: boolean;
  isDjTakeoverApprovedForMe?: boolean;
  isRequestingTakeover?: boolean;
  onRequestDjTakeover?: () => void;
  onTakeOverDjBooth?: () => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onStartSharingPreset: (vibeId: 'lofi' | 'synth' | 'rain', title: string) => Promise<void>;
  onStartSharingFile: (file: File) => Promise<void>;
  onStartSharingSystem: () => Promise<void>;
  onPause: () => void;
  onResume: () => void;
  onStopSharing: () => void;
}

export const PodBgMusicPlayer: React.FC<PodBgMusicPlayerProps> = ({
  bgMusic,
  bgMusicVolume,
  isBgMusicMuted,
  isHostOrMod = false,
  isDjTakeoverApprovedForMe = false,
  isRequestingTakeover = false,
  onRequestDjTakeover,
  onTakeOverDjBooth,
  onVolumeChange,
  onToggleMute,
  onStartSharingPreset,
  onStartSharingFile,
  onStartSharingSystem,
  onPause,
  onResume,
  onStopSharing,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';
  const { currentPersona } = useAuthStore();

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isLoadingPreset, setIsLoadingPreset] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isLocalDJ = bgMusic.djUserId === currentPersona.id;
  const isAnotherDjActive = bgMusic.isActive && !isLocalDJ;
  const isLockedForMe = isAnotherDjActive && !isDjTakeoverApprovedForMe && !isHostOrMod;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      setIsShareModalOpen(false);
      await onStartSharingFile(files[0]);
    }
  };

  const handleSelectSystemAudio = async () => {
    setIsShareModalOpen(false);
    await onStartSharingSystem();
  };

  const handleSelectPreset = async (preset: typeof PRESET_VIBES[0]) => {
    setIsLoadingPreset(preset.id);
    try {
      setIsShareModalOpen(false);
      await onStartSharingPreset(
        preset.id as 'lofi' | 'synth' | 'rain',
        isArabic ? preset.titleAr : preset.title
      );
    } catch (err) {
      console.warn('Could not start preset ambient vibe:', err);
    } finally {
      setIsLoadingPreset(null);
    }
  };

  return (
    <>
      {/* 1. Header DJ Audio Trigger Button */}
      <button
        type="button"
        onClick={() => setIsShareModalOpen(true)}
        className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer shrink-0 ${
          bgMusic.isActive
            ? 'border-fuchsia-500 bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 shadow-fuchsia-500/20'
            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
        }`}
        title={
          bgMusic.isActive
            ? isArabic ? 'إعدادات البث الصوتي المباشر' : 'DJ Audio Settings'
            : isArabic ? 'مشاركة وبث صوت من جهازك' : 'Play & Share audio from your machine'
        }
      >
        <Disc3
          className={`w-3.5 h-3.5 text-fuchsia-500 dark:text-fuchsia-400 ${
            bgMusic.isActive && bgMusic.isPlaying ? 'animate-spin' : ''
          }`}
        />
        <span className="hidden sm:inline">
          {bgMusic.isActive
            ? isArabic ? 'بث الـ DJ 🔴' : 'DJ Live 🔴'
            : isArabic ? 'بث صوت 🎵' : 'Share Audio 🎵'}
        </span>
      </button>

      {/* 2. Hidden File Input for Local Audio */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* 3. Audio Sharing Modal (Rendered in Portal above everything) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isShareModalOpen && (
              <div
                className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/65 dark:bg-black/80 backdrop-blur-md"
                onClick={() => setIsShareModalOpen(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl text-zinc-900 dark:text-white space-y-4 relative z-10 transition-colors max-h-[90vh] overflow-y-auto no-scrollbar"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-fuchsia-600 to-purple-600 p-0.5 flex items-center justify-center shadow-lg">
                        <div className="w-full h-full bg-white dark:bg-zinc-950 rounded-[14px] flex items-center justify-center">
                          <Music className="w-4 h-4 text-fuchsia-500 dark:text-fuchsia-400" />
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-white">
                          {isArabic ? 'مشاركة وبث صوت في الحجرة (DJ)' : 'Share Background Audio (DJ)'}
                        </h3>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {isArabic
                            ? 'شغّل مقطع صوت من جهازك ليسمعه الجميع في الخلفية'
                            : 'Stream audio live in the room background for all attendees'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsShareModalOpen(false)}
                      className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full bg-zinc-100 dark:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Case A: Current User is the Active DJ */}
                  {isLocalDJ && bgMusic.isActive && (
                    <div className="p-3.5 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={bgMusic.djAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${bgMusic.djUsername}`}
                            alt={bgMusic.djUsername || 'DJ'}
                            className="w-7 h-7 rounded-full border border-fuchsia-400 shrink-0 object-cover"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-fuchsia-900 dark:text-fuchsia-200 truncate">
                              {bgMusic.trackTitle || 'Live Audio Stream'}
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                              DJ @{bgMusic.djUsername} ({isArabic ? 'أنت' : 'You'})
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {bgMusic.isPlaying ? (
                            <button
                              type="button"
                              onClick={onPause}
                              className="p-1.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
                              title="Pause"
                            >
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={onResume}
                              className="p-1.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white transition-colors cursor-pointer"
                              title="Play"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              onStopSharing();
                              setIsShareModalOpen(false);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Square className="w-3 h-3 fill-current" />
                            <span>{isArabic ? 'إيقاف البث' : 'Stop Stream'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Volume Slider in Modal */}
                      <div className="flex items-center gap-2 pt-1 border-t border-fuchsia-500/20">
                        <button
                          type="button"
                          onClick={onToggleMute}
                          className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                        >
                          {isBgMusicMuted ? (
                            <VolumeX className="w-4 h-4 text-rose-500" />
                          ) : (
                            <Volume2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                          )}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={isBgMusicMuted ? 0 : bgMusicVolume}
                          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                          className="flex-1 h-1.5 accent-fuchsia-500 cursor-pointer"
                        />
                        <span className="text-[10px] font-mono font-bold text-zinc-500">
                          {Math.round(bgMusicVolume * 100)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Case B: Another DJ is Currently Active */}
                  {isAnotherDjActive && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={bgMusic.djAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${bgMusic.djUsername}`}
                            alt={bgMusic.djUsername || 'DJ'}
                            className="w-8 h-8 rounded-full border border-amber-400 shrink-0 object-cover"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-amber-900 dark:text-amber-200 truncate">
                              {bgMusic.trackTitle || 'Live Audio Stream'}
                            </div>
                            <div className="text-[10.5px] text-amber-700 dark:text-amber-400 font-semibold">
                              {isArabic ? `الـ DJ الحالي: @${bgMusic.djUsername}` : `Current DJ: @${bgMusic.djUsername}`}
                            </div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-black border border-amber-500/30 flex items-center gap-1 shrink-0">
                          <Lock className="w-3 h-3" />
                          <span>{isArabic ? 'مشغول' : 'Busy'}</span>
                        </span>
                      </div>

                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                        {isArabic
                          ? 'يوجد مقطع صوتي قيد البث حالياً. لمنع التداخل، اطلب الإذن للتبديل.'
                          : 'A background track is currently playing. To prevent overlapping audio, request permission to take over.'}
                      </p>

                      {isHostOrMod ? (
                        <button
                          type="button"
                          onClick={() => onTakeOverDjBooth?.()}
                          className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-600 via-purple-600 to-fuchsia-600 hover:opacity-90 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                        >
                          <Crown className="w-3.5 h-3.5" />
                          <span>{isArabic ? 'تولي كابينة الـ DJ الآن (صلاحية المشرف) 👑' : 'Take Over DJ Booth (Moderator) 👑'}</span>
                        </button>
                      ) : !isDjTakeoverApprovedForMe ? (
                        <button
                          type="button"
                          disabled={isRequestingTakeover}
                          onClick={() => onRequestDjTakeover?.()}
                          className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer ${
                            isRequestingTakeover
                              ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed'
                              : 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white active:scale-95'
                          }`}
                        >
                          <Radio className="w-3.5 h-3.5" />
                          <span>
                            {isRequestingTakeover
                              ? (isArabic ? 'تم إرسال الطلب للـ DJ... ⏳' : 'Request Sent to DJ... ⏳')
                              : (isArabic ? 'طلب إذن تغيير الـ DJ 🙋‍♂️' : 'Request DJ Turn 🙋‍♂️')}
                          </span>
                        </button>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 animate-spin" />
                          <span>{isArabic ? 'تمت الموافقة! اختر مقطع صوتي أدناه لبدء البث 🎵' : 'Approved! Choose audio below to stream 🎵'}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Case C: Approved for me notification */}
                  {isDjTakeoverApprovedForMe && !isAnotherDjActive && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 animate-spin" />
                      <span>{isArabic ? 'كابينة الـ DJ جاهزة لك! اختر مقطعك الصوتي 🎵' : 'DJ booth is ready! Pick your sound 🎵'}</span>
                    </div>
                  )}

                  {/* Source Options Grid (Disabled when locked) */}
                  <div className={`space-y-3 transition-opacity ${isLockedForMe ? 'opacity-40 pointer-events-none select-none' : 'opacity-100'}`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Option 1: Local Audio File */}
                      <button
                        type="button"
                        disabled={isLockedForMe}
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3.5 rounded-2xl border border-fuchsia-300 dark:border-fuchsia-500/40 bg-gradient-to-b from-fuchsia-50 via-white to-stone-50 dark:from-fuchsia-950/40 dark:to-zinc-950 hover:border-fuchsia-400 hover:scale-[1.01] text-left rtl:text-right space-y-1.5 transition-all group shadow-sm cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-xl bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <FileAudio className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-xs text-zinc-900 dark:text-white">
                            {isArabic ? 'ملف صوت من جهازك' : 'Local Audio File'}
                          </div>
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                            {isArabic ? 'MP3, WAV, M4A, FLAC' : 'Direct file playback'}
                          </div>
                        </div>
                      </button>

                      {/* Option 2: System / Tab Audio Capture */}
                      <button
                        type="button"
                        disabled={isLockedForMe}
                        onClick={handleSelectSystemAudio}
                        className="p-3.5 rounded-2xl border border-cyan-300 dark:border-cyan-500/40 bg-gradient-to-b from-cyan-50 via-white to-stone-50 dark:from-cyan-950/40 dark:to-zinc-950 hover:border-cyan-400 hover:scale-[1.01] text-left rtl:text-right space-y-1.5 transition-all group shadow-sm cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Monitor className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-xs text-zinc-900 dark:text-white">
                            {isArabic ? 'صوت النظام أو المتصفح' : 'System / Tab Audio'}
                          </div>
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                            {isArabic ? 'Spotify, YouTube, تبويب' : 'Stream computer sound'}
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* Option 3: Quick Preset Vibes */}
                    <div className="space-y-1.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                      <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 block">
                        {isArabic ? 'أو اختر مقطوعة جاهزة للبث المباشر:' : 'Or stream a preset vibe:'}
                      </span>
                      <div className="space-y-1.5">
                        {PRESET_VIBES.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            disabled={isLockedForMe || isLoadingPreset === preset.id}
                            onClick={() => handleSelectPreset(preset)}
                            className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 flex items-center justify-between text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-all group shadow-sm cursor-pointer"
                          >
                            <span className="truncate">
                              {isArabic ? preset.titleAr : preset.title}
                            </span>
                            <span className="text-[10.5px] font-bold text-fuchsia-600 dark:text-fuchsia-400 group-hover:text-fuchsia-500 shrink-0">
                              {isLoadingPreset === preset.id
                                ? (isArabic ? 'جاري التشغيل...' : 'Loading...')
                                : (isArabic ? 'تشغيل 🎵' : 'Play 🎵')}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};

// ==========================================
// 4. Dedicated Standalone DJ Ambient Music Bar
// ==========================================
interface PodBgMusicActiveBarProps {
  bgMusic: PodBgMusicState;
  bgMusicVolume: number;
  isBgMusicMuted: boolean;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onPause: () => void;
  onResume: () => void;
  onStopSharing: () => void;
  onOpenSettings?: () => void;
}

export const PodBgMusicActiveBar: React.FC<PodBgMusicActiveBarProps> = ({
  bgMusic,
  bgMusicVolume,
  isBgMusicMuted,
  onVolumeChange,
  onToggleMute,
  onPause,
  onResume,
  onStopSharing,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';
  const { currentPersona } = useAuthStore();

  if (!bgMusic.isActive) return null;

  const isLocalDJ = bgMusic.djUserId === currentPersona.id;

  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-2xl bg-white/90 dark:bg-zinc-950/85 border border-fuchsia-400/40 dark:border-fuchsia-500/30 backdrop-blur-xl shadow-lg shadow-fuchsia-500/5 transition-all">
      {/* Left: Animated Equalizer + DJ Info + Track Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Equalizer animation */}
        <div className="flex items-end gap-0.5 h-4 px-1 py-0.5 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 shrink-0">
          <span className={`w-1 bg-fuchsia-500 rounded-full transition-all ${bgMusic.isPlaying ? 'h-3.5 animate-pulse' : 'h-1.5'}`} />
          <span className={`w-1 bg-purple-500 rounded-full transition-all ${bgMusic.isPlaying ? 'h-2.5 animate-bounce' : 'h-1'}`} />
          <span className={`w-1 bg-cyan-500 rounded-full transition-all ${bgMusic.isPlaying ? 'h-3.5 animate-pulse' : 'h-2'}`} />
        </div>

        {/* DJ Avatar */}
        <img
          src={bgMusic.djAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${bgMusic.djUsername}`}
          alt={bgMusic.djUsername || 'DJ'}
          className="w-6 h-6 rounded-full border border-fuchsia-400 dark:border-fuchsia-500/50 shrink-0 object-cover"
        />

        {/* Track Title & DJ Username */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-xs font-bold text-fuchsia-950 dark:text-fuchsia-200 truncate">
              {bgMusic.trackTitle || (isArabic ? 'موسيقى الخلفية المباشرة' : 'Live Ambient Audio')}
            </span>
            <span className="px-1.5 py-0.2 rounded-md bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-300 text-[8.5px] font-black border border-fuchsia-500/30 shrink-0">
              DJ
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate block">
            @{bgMusic.djUsername}
          </span>
        </div>
      </div>

      {/* Right: Volume Controls + Local DJ Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Volume & Mute */}
        <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2 py-1">
          <button
            type="button"
            onClick={onToggleMute}
            className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
            title={isBgMusicMuted ? 'Unmute' : 'Mute'}
          >
            {isBgMusicMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-500" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isBgMusicMuted ? 0 : bgMusicVolume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-14 sm:w-20 h-1 accent-fuchsia-500 cursor-pointer"
            title={`Volume: ${Math.round(bgMusicVolume * 100)}%`}
          />
        </div>

        {/* Local DJ Controls */}
        {isLocalDJ && (
          <div className="flex items-center gap-1">
            {bgMusic.isPlaying ? (
              <button
                type="button"
                onClick={onPause}
                className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
                title="Pause"
              >
                <Pause className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onResume}
                className="p-1.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white transition-colors cursor-pointer shadow-sm"
                title="Play"
              >
                <Play className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={onStopSharing}
              className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
              title="Stop Sharing"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
