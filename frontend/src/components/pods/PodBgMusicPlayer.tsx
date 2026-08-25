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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Sample royalty-free online ambient tracks for instant 1-click testing
const PRESET_VIBES = [
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
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
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
  onVolumeChange,
  onToggleMute,
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
      const response = await fetch(preset.url);
      const blob = await response.blob();
      const file = new File([blob], `${preset.title}.mp3`, { type: 'audio/mp3' });
      setIsShareModalOpen(false);
      await onStartSharingFile(file);
    } catch (err) {
      console.warn('Could not load preset audio directly, falling back:', err);
    } finally {
      setIsLoadingPreset(null);
    }
  };

  return (
    <>
      {/* 1. Header Trigger & Active Player Bar */}
      <div className="flex items-center gap-2">
        {bgMusic.isActive ? (
          /* Active Playing Banner */
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-fuchsia-50 via-white to-cyan-50 dark:from-fuchsia-950/80 dark:via-zinc-900/90 dark:to-cyan-950/80 border border-fuchsia-300 dark:border-fuchsia-500/40 shadow-lg backdrop-blur-md transition-colors">
            {/* Equalizer dancing bars */}
            <div className="flex items-end gap-0.5 h-3.5 px-0.5">
              <span className={`w-1 bg-fuchsia-500 dark:bg-fuchsia-400 rounded-full transition-all ${bgMusic.isPlaying ? 'h-3.5 animate-pulse' : 'h-1.5'}`} />
              <span className={`w-1 bg-purple-500 dark:bg-purple-400 rounded-full transition-all ${bgMusic.isPlaying ? 'h-2.5 animate-bounce' : 'h-1'}`} />
              <span className={`w-1 bg-cyan-500 dark:bg-cyan-400 rounded-full transition-all ${bgMusic.isPlaying ? 'h-3.5 animate-pulse' : 'h-2'}`} />
            </div>

            {/* DJ Avatar & Track info */}
            <div className="flex items-center gap-1.5 min-w-0 max-w-[130px] sm:max-w-[200px]">
              <img
                src={bgMusic.djAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${bgMusic.djUsername}`}
                alt={bgMusic.djUsername || 'DJ'}
                className="w-5 h-5 rounded-full border border-fuchsia-400 dark:border-fuchsia-500/50 shrink-0 object-cover"
              />
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-fuchsia-900 dark:text-fuchsia-200 truncate leading-tight">
                  {bgMusic.trackTitle || (isArabic ? 'بث صوتي مباشر' : 'Live Audio')}
                </div>
                <div className="text-[9px] text-zinc-500 dark:text-zinc-400 truncate">
                  DJ @{bgMusic.djUsername}
                </div>
              </div>
            </div>

            {/* Listener Volume & Mute Controls */}
            <div className="flex items-center gap-1.5 pl-1 border-l rtl:pl-0 rtl:pr-1 rtl:border-l-0 rtl:border-r border-zinc-300 dark:border-zinc-700/60">
              <button
                type="button"
                onClick={onToggleMute}
                className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                title={isBgMusicMuted ? 'Unmute background audio' : 'Mute background audio'}
              >
                {isBgMusicMuted ? (
                  <VolumeX className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
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
                className="w-12 h-1 accent-fuchsia-500 cursor-pointer hidden md:inline-block"
                title={`Background Music Volume: ${Math.round(bgMusicVolume * 100)}%`}
              />
            </div>

            {/* DJ Specific Controls */}
            {isLocalDJ && (
              <div className="flex items-center gap-1 pl-1 border-l rtl:pl-0 rtl:pr-1 rtl:border-l-0 rtl:border-r border-zinc-300 dark:border-zinc-700/60">
                {bgMusic.isPlaying ? (
                  <button
                    type="button"
                    onClick={onPause}
                    className="p-1 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200"
                    title="Pause"
                  >
                    <Pause className="w-3 h-3" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onResume}
                    className="p-1 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white"
                    title="Play"
                  >
                    <Play className="w-3 h-3" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={onStopSharing}
                  className="p-1 rounded-lg bg-rose-100 dark:bg-rose-950/60 hover:bg-rose-200 dark:hover:bg-rose-900 border border-rose-300 dark:border-rose-800/60 text-rose-700 dark:text-rose-300"
                  title="Stop Sharing"
                >
                  <Square className="w-3 h-3 fill-current" />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Inactive: Share Music Trigger Button */
          <button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            className="px-3 py-1.5 rounded-xl border border-fuchsia-300 dark:border-fuchsia-500/40 bg-fuchsia-50/80 dark:bg-fuchsia-950/40 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/50 text-fuchsia-700 dark:text-fuchsia-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 group"
            title={isArabic ? 'مشاركة وبث صوت من جهازك' : 'Play & Share audio from your machine'}
          >
            <Disc3 className="w-3.5 h-3.5 text-fuchsia-500 dark:text-fuchsia-400 group-hover:rotate-180 transition-transform duration-500" />
            <span className="hidden sm:inline">
              {isArabic ? 'بث صوت محلي 🎵' : 'Share Audio 🎵'}
            </span>
          </button>
        )}
      </div>

      {/* 2. Hidden File Input for Local Audio */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* 3. Audio Sharing Modal (Rendered in Portal above all headers & sidebars) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isShareModalOpen && (
              <div
                className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md"
                onClick={() => setIsShareModalOpen(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl text-zinc-900 dark:text-white space-y-5 relative z-10 transition-colors"
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
                        <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                          {isArabic ? 'مشاركة وبث مقطع صوتي في الحجرة' : 'Share Background Music'}
                        </h3>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {isArabic
                            ? 'شغّل مقطع صوت من جهازك ليسمعه الجميع في الخلفية أثناء التحدث بالمايك'
                            : 'Play audio from your machine live in the room background without file uploads'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsShareModalOpen(false)}
                      className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full bg-zinc-100 dark:bg-zinc-800 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Source Options Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Option 1: Local Audio File */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-4 rounded-2xl border border-fuchsia-300 dark:border-fuchsia-500/40 bg-gradient-to-b from-fuchsia-50 via-white to-stone-50 dark:from-fuchsia-950/40 dark:to-zinc-950 hover:border-fuchsia-400 hover:scale-[1.02] text-left rtl:text-right space-y-2 transition-all group shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-xl bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <FileAudio className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-zinc-900 dark:text-white">
                          {isArabic ? 'ملف صوت من جهازك' : 'Local Audio File'}
                        </div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          {isArabic ? 'MP3, WAV, M4A, FLAC, OGG' : 'Direct local playback'}
                        </div>
                      </div>
                    </button>

                    {/* Option 2: System / Tab Audio Capture */}
                    <button
                      type="button"
                      onClick={handleSelectSystemAudio}
                      className="p-4 rounded-2xl border border-cyan-300 dark:border-cyan-500/40 bg-gradient-to-b from-cyan-50 via-white to-stone-50 dark:from-cyan-950/40 dark:to-zinc-950 hover:border-cyan-400 hover:scale-[1.02] text-left rtl:text-right space-y-2 transition-all group shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Monitor className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-zinc-900 dark:text-white">
                          {isArabic ? 'صوت النظام أو المتصفح' : 'System / Tab Audio'}
                        </div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          {isArabic ? 'Spotify, YouTube, تبويب' : 'Live stream computer sound'}
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Option 3: Quick Preset Vibes */}
                  <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                    <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 block">
                      {isArabic ? 'أو اختر مقطوعة جاهزة للبث المباشر:' : 'Or pick a live vibe track:'}
                    </span>
                    <div className="space-y-1.5">
                      {PRESET_VIBES.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          disabled={isLoadingPreset === preset.id}
                          onClick={() => handleSelectPreset(preset)}
                          className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 flex items-center justify-between text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-all group shadow-sm"
                        >
                          <span className="truncate">
                            {isArabic ? preset.titleAr : preset.title}
                          </span>
                          <span className="text-[10px] font-bold text-fuchsia-600 dark:text-fuchsia-400 group-hover:text-fuchsia-500 shrink-0">
                            {isLoadingPreset === preset.id
                              ? (isArabic ? 'جاري التشغيل...' : 'Loading...')
                              : (isArabic ? 'تشغيل 🎵' : 'Play 🎵')}
                          </span>
                        </button>
                      ))}
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
