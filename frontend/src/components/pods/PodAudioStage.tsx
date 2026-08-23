import React, { useEffect } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { PodSpeaker } from '../../types/api';
import {
  Hand,
  Mic,
  MicOff,
  Radio,
  Sparkles,
  UserCheck,
  UserPlus,
  Volume2,
  VolumeX,
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
  onJoinStage: () => void;
  onLeaveStage: () => void;
  onToggleMute: () => void;
  onToggleHandRaise: () => void;
  onInviteUser: (userId: string) => void;
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
  onJoinStage,
  onLeaveStage,
  onToggleMute,
  onToggleHandRaise,
  onInviteUser,
  onVolumeChange,
  onToggleAudioMute,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';
  const { currentPersona } = useAuthStore();
  const isHost = currentPersona.username === hostUsername;

  return (
    <div className="p-3.5 rounded-3xl bg-zinc-950/75 border border-zinc-800/80 backdrop-blur-xl shadow-xl space-y-3">
      {/* Stage Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider shadow-sm">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>{isArabic ? 'المسرح الصوتي الحي' : 'Live Voice Stage'}</span>
          </div>
          <span className="text-[11px] text-zinc-400 font-medium">
            {speakers.length} {isArabic ? 'على المسرح' : 'on stage'}
          </span>
        </div>

        {/* Stage Actions: Grab Mic / Mute / Leave / Raise Hand / Room Volume */}
        <div className="flex items-center gap-2">
          {/* Room Audio Mute/Volume for Listeners */}
          <div className="flex items-center gap-1 bg-zinc-900/80 border border-zinc-800 rounded-xl px-2 py-1">
            <button
              type="button"
              onClick={onToggleAudioMute}
              className="text-zinc-400 hover:text-zinc-200 transition-colors"
              title={isAudioMuted ? 'Unmute Room Audio' : 'Mute Room Audio'}
            >
              {isAudioMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isAudioMuted ? 0 : roomVolume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-12 h-1 accent-cyan-500 cursor-pointer hidden xs:inline-block"
              title={`Room Volume: ${Math.round(roomVolume * 100)}%`}
            />
          </div>

          {!isOnStage ? (
            <div className="flex items-center gap-1.5">
              {/* Raise Hand Button */}
              <button
                type="button"
                onClick={onToggleHandRaise}
                className={`p-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all ${
                  isHandRaised
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-lg shadow-amber-500/20 animate-pulse'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-amber-400'
                }`}
                title={
                  isHandRaised
                    ? isArabic
                      ? 'يدك مرفوعة ✋'
                      : 'Hand Raised ✋'
                    : isArabic
                    ? 'رفع اليد لطلب التحدث ✋'
                    : 'Raise Hand ✋'
                }
              >
                <Hand className="w-3.5 h-3.5" />
              </button>

              {/* Grab Mic Button */}
              <button
                type="button"
                onClick={onJoinStage}
                className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>{isArabic ? 'فتح المايك 🎙️' : 'Open Mic 🎙️'}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {/* Mute Toggle */}
              <button
                type="button"
                onClick={onToggleMute}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                  isMuted
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                    : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 animate-pulse'
                }`}
                title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
              >
                {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{isMuted ? (isArabic ? 'صامت' : 'Muted') : (isArabic ? 'مباشر' : 'Live')}</span>
              </button>

              {/* Leave Stage */}
              <button
                type="button"
                onClick={onLeaveStage}
                className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl text-xs font-semibold transition-colors"
              >
                {isArabic ? 'مغادرة' : 'Leave'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Host Hand Raise Notification Banner */}
      {isHost && handRaisedUsers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-2.5 bg-amber-950/40 border border-amber-600/50 rounded-2xl flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2 text-xs text-amber-300 min-w-0">
            <Hand className="w-4 h-4 text-amber-400 animate-bounce shrink-0" />
            <span className="truncate">
              <strong>{handRaisedUsers[0].displayName || handRaisedUsers[0].username}</strong>{' '}
              {isArabic ? 'يطلب المايك للتحدث' : 'is requesting to speak'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onInviteUser(handRaisedUsers[0].userId)}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black rounded-xl shadow-md transition-transform active:scale-95 shrink-0"
          >
            {isArabic ? 'منح المايك 🎙️' : 'Invite to Mic 🎙️'}
          </button>
        </motion.div>
      )}

      {/* Speakers Row / Glowing Avatars & Sound Waves */}
      <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar py-1.5">
        {speakers.length === 0 ? (
          <div className="w-full py-4 text-center text-xs text-zinc-500">
            {isArabic ? 'لا يوجد متحدثين على المسرح حالياً. اضغط على "فتح المايك" للبدء!' : 'No speakers on stage yet. Click "Open Mic" to speak!'}
          </div>
        ) : (
          speakers.map((speaker) => {
            const isSpeakerHost = speaker.username === hostUsername;
            const isMe = speaker.userId === currentPersona.id;
            return (
              <motion.div
                key={speaker.userId}
                layout
                className="flex flex-col items-center gap-1.5 shrink-0 min-w-[76px]"
              >
                <div className="relative">
                  {/* Dynamic Speaking Halo Animation */}
                  {speaker.isSpeaking && (
                    <span className="absolute -inset-2 rounded-2xl bg-emerald-400/30 animate-ping pointer-events-none" />
                  )}

                  <div
                    className={`w-14 h-14 rounded-2xl p-0.5 transition-all duration-150 ${
                      speaker.isSpeaking
                        ? 'ring-2 ring-emerald-400 bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 shadow-xl shadow-emerald-500/40 scale-105'
                        : speaker.isMuted
                        ? 'ring-1 ring-zinc-800 bg-zinc-900 opacity-60'
                        : 'ring-1 ring-zinc-700 bg-zinc-800'
                    }`}
                  >
                    <img
                      src={
                        speaker.avatarUrl ||
                        `https://api.dicebear.com/7.x/bottts/svg?seed=${speaker.username}`
                      }
                      alt={speaker.username}
                      className="w-full h-full rounded-[14px] object-cover bg-zinc-950"
                    />
                  </div>

                  {/* Mic Status Pill */}
                  <div
                    className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] border-2 border-zinc-950 shadow-md ${
                      speaker.isMuted
                        ? 'bg-rose-600 text-white'
                        : speaker.isSpeaking
                        ? 'bg-emerald-500 text-zinc-950 animate-pulse'
                        : 'bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    {speaker.isMuted ? <MicOff className="w-2.5 h-2.5" /> : <Mic className="w-2.5 h-2.5" />}
                  </div>
                </div>

                <div className="text-center max-w-[80px]">
                  <span className="text-[11px] font-bold text-zinc-200 block truncate">
                    {speaker.displayName || speaker.username}
                  </span>
                  {isSpeakerHost ? (
                    <span className="text-[9px] text-fuchsia-400 font-extrabold uppercase tracking-wider block">
                      Host 👑
                    </span>
                  ) : isMe ? (
                    <span className="text-[9px] text-cyan-400 font-semibold block">
                      {isArabic ? 'أنت' : 'You'}
                    </span>
                  ) : null}
                </div>

                {/* Mini Visualizer bars for active speaking */}
                {speaker.isSpeaking && (
                  <div className="flex items-center gap-0.5 h-2">
                    <span className="w-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s] h-3" />
                    <span className="w-1 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.15s] h-4" />
                    <span className="w-1 bg-emerald-400 rounded-full animate-bounce h-2.5" />
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Live Mic Waveform Frequency Spectrum for Local User */}
      {isOnStage && !isMuted && (
        <div className="flex items-center gap-2.5 pt-1.5 border-t border-zinc-800/60 text-[10px] text-zinc-400">
          <span className="text-emerald-400 font-bold flex items-center gap-1 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>{isArabic ? 'صوتك لايف للجميع:' : 'Your Voice Live:'}</span>
          </span>
          <div className="flex-1 h-2 bg-zinc-900 rounded-full overflow-hidden flex items-center p-0.5">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-teal-300 transition-all duration-75 rounded-full shadow-md shadow-emerald-500/50"
              style={{ width: `${Math.max(6, micLevel)}%` }}
            />
          </div>
          <span className="font-mono text-zinc-400 font-bold shrink-0">{micLevel}%</span>
        </div>
      )}
    </div>
  );
};
