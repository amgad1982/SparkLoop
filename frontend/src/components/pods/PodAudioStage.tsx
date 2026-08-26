import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { PodSpeaker } from '../../types/api';
import { Tooltip } from '../ui/Tooltip';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Hand,
  Mic,
  MicOff,
  Radio,
  Sparkles,
  Volume2,
  VolumeX,
  Shield,
  UserMinus,
  ShieldAlert,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PodAudioStageProps {
  podId: string;
  hostUsername: string;
  hostDisplayName: string;
  hostAvatarUrl?: string;
  speakers: PodSpeaker[];
  isOnStage: boolean;
  isMuted: boolean;
  micLevel: number;
  isHandRaised: boolean;
  handRaisedUsers: { userId: string; username: string; displayName: string }[];
  roomVolume: number;
  isAudioMuted: boolean;
  allowOpenMic?: boolean;
  isModerator?: boolean;
  moderatorUserIds?: string[];
  onJoinStage: () => void;
  onLeaveStage: () => void;
  onToggleMute: () => void;
  onToggleHandRaise: () => void;
  onInviteUser: (userId: string, username?: string, displayName?: string) => void;
  onHostMuteSpeaker?: (userId: string) => void;
  onHostRemoveSpeaker?: (userId: string) => void;
  onVolumeChange: (volume: number) => void;
  onToggleAudioMute: () => void;
}

export const PodAudioStage: React.FC<PodAudioStageProps> = ({
  podId,
  hostUsername,
  hostDisplayName,
  hostAvatarUrl,
  speakers,
  isOnStage,
  isMuted,
  micLevel,
  isHandRaised,
  handRaisedUsers,
  roomVolume,
  isAudioMuted,
  allowOpenMic = false,
  isModerator = false,
  moderatorUserIds = [],
  onJoinStage,
  onLeaveStage,
  onToggleMute,
  onToggleHandRaise,
  onInviteUser,
  onHostMuteSpeaker,
  onHostRemoveSpeaker,
  onVolumeChange,
  onToggleAudioMute,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';
  const { currentPersona } = useAuthStore();
  const isHost = currentPersona.username.toLowerCase() === hostUsername.toLowerCase();
  const canModerate = isHost || isModerator || moderatorUserIds.includes(currentPersona.id);

  // Manual collapse toggle & manual compact mode toggle
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [forceCompact, setForceCompact] = useState(false);

  // Scroll controls & overflow indicators
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [speakers.length, forceCompact, isCollapsed]);

  const scrollBy = (offset: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  // Dynamic Avatar sizing depending on speaker count & compact mode
  const sizeConfig = useMemo(() => {
    const count = speakers.length;
    if (forceCompact) {
      return {
        avatarClass: 'w-8 h-8 rounded-xl',
        innerRadius: 'rounded-[10px]',
        cardWidth: 'min-w-[56px] max-w-[66px]',
        nameText: 'text-[9px]',
        badgeText: 'text-[7.5px]',
        micBadge: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5 text-[8px]',
        micIcon: 'w-2 h-2',
        haloClass: '-inset-1 rounded-xl',
        waveHeight: 'h-1.5',
        waveBars: ['h-2 w-0.5', 'h-2.5 w-0.5', 'h-2 w-0.5'],
      };
    }

    if (count <= 2) {
      // Large Stage Focus
      return {
        avatarClass: 'w-14 h-14 rounded-2xl',
        innerRadius: 'rounded-[14px]',
        cardWidth: 'min-w-[84px] max-w-[96px]',
        nameText: 'text-[11px]',
        badgeText: 'text-[9px]',
        micBadge: 'w-5 h-5 -bottom-1 -right-1 text-[10px]',
        micIcon: 'w-2.5 h-2.5',
        haloClass: '-inset-2 rounded-2xl',
        waveHeight: 'h-2',
        waveBars: ['h-3 w-1', 'h-4 w-1', 'h-2.5 w-1'],
      };
    }

    if (count <= 5) {
      // Standard / Balanced
      return {
        avatarClass: 'w-11 h-11 rounded-2xl',
        innerRadius: 'rounded-[12px]',
        cardWidth: 'min-w-[70px] max-w-[80px]',
        nameText: 'text-[10px]',
        badgeText: 'text-[8.5px]',
        micBadge: 'w-4.5 h-4.5 -bottom-0.5 -right-0.5 text-[9px]',
        micIcon: 'w-2.5 h-2.5',
        haloClass: '-inset-1.5 rounded-2xl',
        waveHeight: 'h-2',
        waveBars: ['h-2.5 w-0.5', 'h-3.5 w-0.5', 'h-2 w-0.5'],
      };
    }

    if (count <= 8) {
      // Compact size
      return {
        avatarClass: 'w-9 h-9 rounded-xl',
        innerRadius: 'rounded-[10px]',
        cardWidth: 'min-w-[58px] max-w-[68px]',
        nameText: 'text-[9px]',
        badgeText: 'text-[8px]',
        micBadge: 'w-4 h-4 -bottom-0.5 -right-0.5 text-[8.5px]',
        micIcon: 'w-2 h-2',
        haloClass: '-inset-1 rounded-xl',
        waveHeight: 'h-1.5',
        waveBars: ['h-2 w-0.5', 'h-3 w-0.5', 'h-1.5 w-0.5'],
      };
    }

    // Dense / Mini for 9+ speakers
    return {
      avatarClass: 'w-7 h-7 rounded-lg',
      innerRadius: 'rounded-[7px]',
      cardWidth: 'min-w-[48px] max-w-[56px]',
      nameText: 'text-[8.5px]',
      badgeText: 'text-[7.5px]',
      micBadge: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5 text-[7.5px]',
      micIcon: 'w-1.5 h-1.5',
      haloClass: '-inset-0.5 rounded-lg',
      waveHeight: 'h-1.5',
      waveBars: ['h-1.5 w-0.5', 'h-2 w-0.5', 'h-1.5 w-0.5'],
    };
  }, [speakers.length, forceCompact]);

  const hasSpeakers = speakers.length > 0;

  return (
    <motion.div
      layout
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className={`rounded-3xl bg-white/85 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800/80 backdrop-blur-xl shadow-lg transition-colors overflow-hidden ${
        !hasSpeakers || isCollapsed ? 'p-2.5 sm:p-3 space-y-0' : 'p-3 sm:p-3.5 space-y-2.5'
      }`}
    >
      {/* 1. Header Row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider shadow-sm shrink-0">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>{isArabic ? 'المسرح الصوتي' : 'Voice Stage'}</span>
          </div>

          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium truncate">
            {speakers.length} {isArabic ? 'على المسرح' : 'on stage'}
          </span>

          {/* Mode Indicator Badge */}
          <span
            className={`px-2 py-0.5 rounded-md text-[9px] font-bold border hidden sm:inline-block ${
              allowOpenMic
                ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
            }`}
          >
            {allowOpenMic
              ? isArabic ? '🎙️ المايك مفتوح' : '🎙️ Open Mic'
              : isArabic ? '✋ برفع اليد فقط' : '✋ Request Only'}
          </span>

          {/* When collapsed and speakers exist, show mini avatar cluster */}
          {isCollapsed && hasSpeakers && (
            <div className="flex items-center -space-x-1.5 rtl:space-x-reverse overflow-hidden max-w-[140px] shrink-0">
              {speakers.slice(0, 5).map((sp) => (
                <img
                  key={sp.userId}
                  src={sp.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${sp.username}`}
                  alt={sp.username}
                  className={`w-5 h-5 rounded-full border-2 border-white dark:border-zinc-950 object-cover ${
                    sp.isSpeaking ? 'ring-2 ring-emerald-500 scale-105' : ''
                  }`}
                  title={`${sp.displayName || sp.username} ${sp.isSpeaking ? '🎙️ Speaking' : ''}`}
                />
              ))}
              {speakers.length > 5 && (
                <span className="text-[9px] font-bold text-zinc-400 pl-1 rtl:pr-1">
                  +{speakers.length - 5}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1.5">
          {/* Room Audio Mute/Volume for Listeners */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2 py-1 shadow-sm">
            <Tooltip content={isAudioMuted ? (isArabic ? 'تشغيل صوت الغرفة' : 'Unmute Room') : (isArabic ? 'كتم صوت الغرفة' : 'Mute Room')} position="bottom">
              <button
                type="button"
                onClick={onToggleAudioMute}
                className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                {isAudioMuted ? (
                  <VolumeX className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                )}
              </button>
            </Tooltip>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isAudioMuted ? 0 : roomVolume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-10 sm:w-12 h-1 accent-cyan-500 cursor-pointer hidden xs:inline-block"
              title={`Room Volume: ${Math.round(roomVolume * 100)}%`}
            />
          </div>

          {/* Collapse/Expand Toggle Button */}
          {hasSpeakers && (
            <Tooltip
              content={
                isCollapsed
                  ? isArabic
                    ? 'توسيع مسرح المتحدثين'
                    : 'Expand speaker stage'
                  : isArabic
                  ? 'طي مسرح المتحدثين'
                  : 'Minimize stage view'
              }
              position="bottom"
            >
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors shadow-sm cursor-pointer"
              >
                {isCollapsed ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5" />
                )}
              </button>
            </Tooltip>
          )}

          {/* Stage Controls: Mic / Mute / Raise Hand / Leave */}
          {!isOnStage ? (
            <div className="flex items-center gap-1.5">
              {/* Raise Hand Button (Always available for audience to request speaking) */}
              <Tooltip
                content={
                  isHandRaised
                    ? isArabic
                      ? 'يدك مرفوعة (إلغاء الطلب)'
                      : 'Hand raised (Cancel request)'
                    : isArabic
                    ? 'رفع اليد لطلب التحدث ✋'
                    : 'Raise hand to speak ✋'
                }
                position="bottom"
              >
                <button
                  type="button"
                  onClick={onToggleHandRaise}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                    isHandRaised
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 shadow-md animate-pulse'
                      : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:text-amber-600 dark:hover:text-amber-400'
                  }`}
                >
                  <Hand className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[11px]">
                    {isHandRaised
                      ? isArabic ? 'اليد مرفوعة ✋' : 'Hand Raised ✋'
                      : isArabic ? 'طلب التحدث ✋' : 'Raise Hand ✋'}
                  </span>
                </button>
              </Tooltip>

              {/* Direct Open Mic Join Button (Available ONLY if Open Mic is enabled OR user is Host/Moderator) */}
              {(allowOpenMic || canModerate) && (
                <Tooltip content={isArabic ? 'الانضمام للمسرح والتحدث المباشر' : 'Join live stage to speak'} position="bottom">
                  <button
                    type="button"
                    onClick={onJoinStage}
                    className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/25 transition-all active:scale-95 shrink-0 cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'فتح المايك 🎙️' : 'Open Mic 🎙️'}</span>
                  </button>
                </Tooltip>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {/* Mute Toggle */}
              <Tooltip content={isMuted ? (isArabic ? 'إلغاء كتم المايك' : 'Unmute mic') : (isArabic ? 'كتم المايك' : 'Mute mic')} position="bottom">
                <button
                  type="button"
                  onClick={onToggleMute}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                    isMuted
                      ? 'bg-rose-500/10 dark:bg-rose-500/20 border-rose-400 dark:border-rose-500/40 text-rose-600 dark:text-rose-400'
                      : 'bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-400 dark:border-emerald-500/40 text-emerald-600 dark:text-emerald-400 animate-pulse'
                  }`}
                >
                  {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  <span>{isMuted ? (isArabic ? 'صامت' : 'Muted') : (isArabic ? 'مباشر' : 'Live')}</span>
                </button>
              </Tooltip>

              {/* Leave Stage */}
              <Tooltip content={isArabic ? 'مغادرة المسرح والنزول للجمهور' : 'Leave stage and return to listeners'} position="bottom">
                <button
                  type="button"
                  onClick={onLeaveStage}
                  className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                >
                  {isArabic ? 'مغادرة' : 'Leave'}
                </button>
              </Tooltip>
            </div>
          )}
        </div>
      </div>

      {/* 2. Host Hand Raise Notification Banner */}
      <AnimatePresence>
        {canModerate && handRaisedUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            className="overflow-hidden"
          >
            <div className="p-2.5 bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-600/50 rounded-2xl flex items-center justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-300 min-w-0">
                <Hand className="w-4 h-4 text-amber-500 animate-bounce shrink-0" />
                <span className="truncate">
                  <strong>{handRaisedUsers[0].displayName || handRaisedUsers[0].username}</strong>{' '}
                  {isArabic ? 'يطلب المايك للتحدث على المسرح' : 'is requesting to speak on stage'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    onInviteUser(
                      handRaisedUsers[0].userId,
                      handRaisedUsers[0].username,
                      handRaisedUsers[0].displayName
                    )
                  }
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black rounded-xl shadow-md transition-transform active:scale-95 cursor-pointer"
                >
                  {isArabic ? 'قبول ومنح المايك 🎙️' : 'Approve Speaker 🎙️'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Speakers Row Container */}
      <AnimatePresence>
        {hasSpeakers && !isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="relative pt-0.5 overflow-hidden"
          >
            {/* Left Scroll Arrow Navigation Button */}
            {canScrollLeft && (
              <button
                type="button"
                onClick={() => scrollBy(isArabic ? 160 : -160)}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-1 rounded-full bg-white/90 dark:bg-zinc-900/90 border border-zinc-300 dark:border-zinc-700 shadow-md text-zinc-700 dark:text-zinc-200 hover:scale-110 transition-transform cursor-pointer"
                title="Scroll left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}

            {/* Right Scroll Arrow Navigation Button */}
            {canScrollRight && (
              <button
                type="button"
                onClick={() => scrollBy(isArabic ? -160 : 160)}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-1 rounded-full bg-white/90 dark:bg-zinc-900/90 border border-zinc-300 dark:border-zinc-700 shadow-md text-zinc-700 dark:text-zinc-200 hover:scale-110 transition-transform cursor-pointer"
                title="Scroll right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {/* Horizontal Scrollable Row */}
            <div
              ref={scrollRef}
              onScroll={checkScroll}
              className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1 px-1 scroll-smooth"
            >
              {speakers.map((speaker) => {
                const isSpeakerHost = speaker.username.toLowerCase() === hostUsername.toLowerCase();
                const isMe = speaker.userId === currentPersona.id;
                const isSpeakerMod = moderatorUserIds.includes(speaker.userId);

                return (
                  <motion.div
                    key={speaker.userId}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={`group relative flex flex-col items-center gap-1 shrink-0 ${sizeConfig.cardWidth}`}
                  >
                    <div className="relative">
                      {/* Dynamic Speaking Halo Animation */}
                      {speaker.isSpeaking && (
                        <span
                          className={`absolute ${sizeConfig.haloClass} bg-emerald-400/30 animate-ping pointer-events-none`}
                        />
                      )}

                      <div
                        className={`${sizeConfig.avatarClass} p-0.5 transition-all duration-150 ${
                          speaker.isSpeaking
                            ? 'ring-2 ring-emerald-400 bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 shadow-xl shadow-emerald-500/40 scale-105'
                            : speaker.isMuted
                            ? 'ring-1 ring-zinc-300 dark:ring-zinc-800 bg-zinc-100 dark:bg-zinc-900 opacity-60'
                            : 'ring-1 ring-zinc-300 dark:ring-zinc-700 bg-zinc-100 dark:bg-zinc-800'
                        }`}
                      >
                        <img
                          src={
                            speaker.avatarUrl ||
                            `https://api.dicebear.com/7.x/bottts/svg?seed=${speaker.username}`
                          }
                          alt={speaker.username}
                          className={`w-full h-full ${sizeConfig.innerRadius} object-cover bg-white dark:bg-zinc-950`}
                        />
                      </div>

                      {/* Mic Status Pill */}
                      <div
                        className={`absolute ${sizeConfig.micBadge} rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-950 shadow-md ${
                          speaker.isMuted
                            ? 'bg-rose-600 text-white'
                            : speaker.isSpeaking
                            ? 'bg-emerald-500 text-zinc-950 animate-pulse'
                            : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {speaker.isMuted ? (
                          <MicOff className={sizeConfig.micIcon} />
                        ) : (
                          <Mic className={sizeConfig.micIcon} />
                        )}
                      </div>
                    </div>

                    <div className="text-center w-full">
                      <span
                        className={`${sizeConfig.nameText} font-bold text-zinc-800 dark:text-zinc-200 block truncate`}
                        title={speaker.displayName || speaker.username}
                      >
                        {speaker.displayName || speaker.username}
                      </span>
                      {isSpeakerHost ? (
                        <span
                          className={`${sizeConfig.badgeText} text-fuchsia-600 dark:text-fuchsia-400 font-extrabold uppercase tracking-wider block`}
                        >
                          Host 👑
                        </span>
                      ) : isSpeakerMod ? (
                        <span
                          className={`${sizeConfig.badgeText} text-cyan-600 dark:text-cyan-400 font-extrabold uppercase tracking-wider block`}
                        >
                          Mod 🛡️
                        </span>
                      ) : isMe ? (
                        <span
                          className={`${sizeConfig.badgeText} text-cyan-600 dark:text-cyan-400 font-semibold block`}
                        >
                          {isArabic ? 'أنت' : 'You'}
                        </span>
                      ) : null}
                    </div>

                    {/* Mini Visualizer bars for active speaking */}
                    {speaker.isSpeaking && (
                      <div className={`flex items-center gap-0.5 ${sizeConfig.waveHeight}`}>
                        <span
                          className={`${sizeConfig.waveBars[0]} bg-emerald-500 dark:bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]`}
                        />
                        <span
                          className={`${sizeConfig.waveBars[1]} bg-cyan-500 dark:bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.15s]`}
                        />
                        <span
                          className={`${sizeConfig.waveBars[2]} bg-emerald-500 dark:bg-emerald-400 rounded-full animate-bounce`}
                        />
                      </div>
                    )}

                    {/* Moderator Quick Actions on Stage (Remote Mute & Kick from stage) */}
                    {canModerate && !isMe && !isSpeakerHost && (
                      <div className="flex items-center gap-1 mt-0.5 opacity-80 hover:opacity-100 transition-opacity">
                        <Tooltip content={isArabic ? 'كتم مايك المتحدث' : 'Remote Mute Speaker'} position="bottom">
                          <button
                            type="button"
                            onClick={() => onHostMuteSpeaker?.(speaker.userId)}
                            className="p-1 rounded-md bg-zinc-200 dark:bg-zinc-800 hover:bg-rose-500/20 hover:text-rose-500 text-zinc-600 dark:text-zinc-400 transition-colors cursor-pointer"
                          >
                            <MicOff className="w-2.5 h-2.5" />
                          </button>
                        </Tooltip>
                        <Tooltip content={isArabic ? 'إنزال المتحدث للجمهور' : 'Remove from Stage'} position="bottom">
                          <button
                            type="button"
                            onClick={() => onHostRemoveSpeaker?.(speaker.userId)}
                            className="p-1 rounded-md bg-zinc-200 dark:bg-zinc-800 hover:bg-rose-500/20 hover:text-rose-500 text-zinc-600 dark:text-zinc-400 transition-colors cursor-pointer"
                          >
                            <UserMinus className="w-2.5 h-2.5" />
                          </button>
                        </Tooltip>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Live Mic Waveform Frequency Spectrum for Local User on stage */}
      {isOnStage && !isMuted && (
        <div className="flex items-center gap-2.5 pt-1.5 border-t border-zinc-200 dark:border-zinc-800/60 text-[10px] text-zinc-600 dark:text-zinc-400">
          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>{isArabic ? 'صوتك لايف للجميع:' : 'Your Voice Live:'}</span>
          </span>
          <div className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-900 rounded-full overflow-hidden flex items-center p-0.5">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-teal-300 transition-all duration-75 rounded-full shadow-md shadow-emerald-500/50"
              style={{ width: `${Math.max(6, Math.round(micLevel * 100))}%` }}
            />
          </div>
          <span className="font-mono text-zinc-700 dark:text-zinc-400 font-bold shrink-0">{Math.round(micLevel * 100)}%</span>
        </div>
      )}
    </motion.div>
  );
};
