import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, X, Disc3, Radio, Volume2, VolumeX } from 'lucide-react';
import { useDjRadioStore } from '../../stores/useDjRadioStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';

export const DjMiniPlayer: React.FC = () => {
  const {
    activeStation,
    currentTrackIndex,
    isPlaying,
    isBroadcasting,
    listenersCount,
    volume,
    setVolume,
    tempoRate,
    togglePlayPause,
    nextTrack,
    closeStation,
    openModal,
  } = useDjRadioStore();
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';
  const { currentPersona } = useAuthStore();

  if (!activeStation) return null;

  const isOwner = Boolean(currentPersona && activeStation.userId === currentPersona.id);
  const currentTrack =
    activeStation.tracks && activeStation.tracks.length > 0
      ? activeStation.tracks[currentTrackIndex] || activeStation.tracks[0]
      : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 80, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 24, stiffness: 300 }}
        className="fixed bottom-18 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-40"
      >
        <div className="relative group overflow-hidden rounded-2xl bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl border border-fuchsia-500/30 dark:border-fuchsia-500/40 p-3 shadow-2xl shadow-fuchsia-950/40 text-white">
          {/* Subtle neon glow overlay */}
          <div className="absolute -inset-1 bg-gradient-to-r from-fuchsia-600/20 via-indigo-600/20 to-pink-600/20 blur-xl opacity-60 pointer-events-none" />

          <div className="relative flex items-center justify-between gap-3">
            {/* Vinyl record & station cover (Click to expand deck) */}
            <div
              onClick={() => openModal('deck')}
              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group-hover:opacity-90 transition-opacity"
            >
              <div className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center">
                <div
                  className={`w-12 h-12 rounded-full bg-gradient-to-tr from-slate-900 via-fuchsia-950 to-slate-900 border-2 border-fuchsia-500/50 flex items-center justify-center shadow-lg ${
                    isPlaying ? 'animate-spin' : ''
                  }`}
                  style={{ animationDuration: `${(3 / (tempoRate || 1)).toFixed(2)}s` }}
                >
                  <Disc3 className="w-6 h-6 text-fuchsia-400" />
                  <div className="absolute w-3 h-3 rounded-full bg-slate-900 border border-fuchsia-400/80" />
                </div>

                {isBroadcasting && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                  </span>
                )}
              </div>

              {/* Station & Track Meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-white truncate">
                    {activeStation.title}
                  </p>
                  {isBroadcasting && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30">
                      LIVE
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-fuchsia-300/80 truncate font-medium mt-0.5">
                  {currentTrack ? `${currentTrack.title} • ${currentTrack.artist}` : (isArabic ? 'راديو مباشر' : 'Live Radio Station')}
                </p>

                {typeof listenersCount === 'number' && listenersCount > 0 && (
                  <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Radio className="w-2.5 h-2.5 text-fuchsia-400" />
                    <span>{listenersCount} {isArabic ? 'مستمع' : 'listeners'}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Controls: Owner has playback controls; Listeners have Receiver Mute and Tune Out */}
            <div className="flex items-center gap-1">
              {isOwner ? (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlayPause();
                    }}
                    className="w-9 h-9 rounded-full bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 flex items-center justify-center text-white shadow-md shadow-fuchsia-600/30 cursor-pointer active:scale-95 transition-transform"
                    title={isPlaying ? (isArabic ? 'إيقاف مؤقت' : 'Pause') : (isArabic ? 'تشغيل' : 'Play')}
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      nextTrack();
                    }}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
                    title={isArabic ? 'التالي' : 'Next'}
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeStation();
                    }}
                    className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800/60 transition-colors cursor-pointer"
                    title={isArabic ? 'إغلاق الراديو' : 'Close Radio'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setVolume(volume > 0 ? 0 : 0.85);
                    }}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
                    title={volume === 0 ? 'Unmute' : 'Mute'}
                  >
                    {volume === 0 ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4 text-fuchsia-400" />}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeStation();
                    }}
                    className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800/60 transition-colors cursor-pointer"
                    title={isArabic ? 'مغادرة المحطة' : 'Tune Out'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
