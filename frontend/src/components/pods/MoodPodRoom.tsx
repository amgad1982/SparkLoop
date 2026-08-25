import React, { useState, useRef, useEffect } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { usePodStore } from '../../stores/usePodStore';
import { MoodPodDto, PodMessageDto, PodSpeaker } from '../../types/api';
import { useCentrifugo } from '../../hooks/useCentrifugo';
import { usePodVoiceEngine } from '../../hooks/usePodVoiceEngine';
import { FloatingReactions } from './FloatingReactions';
import { PodAudioPlayer } from './PodAudioPlayer';
import { PodAudioStage } from './PodAudioStage';
import { PodBgMusicPlayer } from './PodBgMusicPlayer';
import { PodModerationDrawer } from './PodModerationDrawer';
import { Tooltip } from '../ui/Tooltip';
import { api, getMediaUrl } from '../../services/apiClient';
import {
  ArrowLeft,
  Clock,
  Flame,
  Globe,
  Lock,
  Mic,
  Music,
  Radio,
  Send,
  Settings,
  Shield,
  Sparkles,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MoodPodRoomProps {
  initialPod: MoodPodDto;
  onBack?: () => void;
}

const BURST_EMOJIS = ['🔥', '💖', '🚀', '😂', '⚡', '🤯', '🌙', '✨', '🎧', '☕', '🍿', '💯'];

const SOUNDBOARD_EFFECTS = [
  { id: 'applause', name: 'Applause', emoji: '👏', arName: 'تصفيق حار' },
  { id: 'airhorn', name: 'DJ Airhorn', emoji: '📢', arName: 'هورن DJ' },
  { id: 'drumroll', name: 'Drum Roll', emoji: '🥁', arName: 'دقات طبول' },
  { id: 'cheer', name: 'Crowd Cheer', emoji: '🥳', arName: 'هتاف تشجيع' },
  { id: 'laugh', name: 'Laugh Track', emoji: '😂', arName: 'ضحكات جمهور' },
  { id: 'magic', name: 'Magic Chime', emoji: '✨', arName: 'رنين سحري' },
  { id: 'victory', name: 'Victory Fanfare', emoji: '🏆', arName: 'لحن الفوز' },
  { id: 'tada', name: 'Tada Fanfare', emoji: '🎉', arName: 'احتفال تادا' },
  { id: 'boo', name: 'Crowd Boo', emoji: '👎', arName: 'استهجان' },
  { id: 'gasp', name: 'Audience Gasp', emoji: '😱', arName: 'شهقة ذهول' },
];

export const MoodPodRoom: React.FC<MoodPodRoomProps> = ({ initialPod, onBack }) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';
  const { currentPersona } = useAuthStore();
  const { addReaction } = usePodStore();

  const [pod, setPod] = useState<MoodPodDto>(initialPod);
  const [messages, setMessages] = useState<PodMessageDto[]>(initialPod.recentMessages || []);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeSoundBanner, setActiveSoundBanner] = useState<{ effect: string; senderName: string } | null>(null);
  const [showSoundboard, setShowSoundboard] = useState(false);
  const [isModerationDrawerOpen, setIsModerationDrawerOpen] = useState(false);

  const isHost =
    pod.hostUserId === currentPersona.id ||
    pod.hostUsername.toLowerCase() === currentPersona.username.toLowerCase();
  const isModerator =
    isHost || (pod.moderatorUserIds || []).includes(currentPersona.id);

  // Voice note recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Update pod state when initialPod changes
  useEffect(() => {
    setPod(initialPod);
    setMessages(initialPod.recentMessages || []);
  }, [initialPod.id]);

  // Voice Engine (WebRTC Mesh, Audio Chunks, Mic level, Soundboard, Hand Raises, DJ Background Music)
  const voiceEngine = usePodVoiceEngine({
    podId: pod.id,
    hostUsername: pod.hostUsername,
    onSoundEffectReceived: (effect, senderName) => {
      const match = SOUNDBOARD_EFFECTS.find((s) => s.id === effect);
      setActiveSoundBanner({
        effect: match ? `${match.emoji} ${isArabic ? match.arName : match.name}` : effect,
        senderName,
      });
      setTimeout(() => setActiveSoundBanner(null), 3000);
    },
    onReactionReceived: (emoji) => {
      addReaction(emoji);
    },
  });

  // Real-Time Centrifugo Subscription for `pod:{podId}`
  useCentrifugo(`pod:${pod.id}`, (data) => {
    if (data.type === 'POD_MESSAGE' && data.message) {
      const newMsg = data.message as PodMessageDto;
      setMessages((prev) => {
        const index = prev.findIndex((m) => m.id === newMsg.id);
        if (index >= 0) {
          const copy = [...prev];
          copy[index] = {
            ...copy[index],
            ...newMsg,
            senderDisplayName: newMsg.senderDisplayName || copy[index].senderDisplayName,
            senderAvatarUrl: newMsg.senderAvatarUrl || copy[index].senderAvatarUrl,
          };
          return copy;
        }
        return [...prev, newMsg];
      });
    } else if (data.type === 'POD_SETTINGS_UPDATED') {
      const updatedPod = data.pod as MoodPodDto;
      if (updatedPod) {
        setPod((prev) => ({
          ...prev,
          title: updatedPod.title || prev.title,
          moodEmoji: updatedPod.moodEmoji || prev.moodEmoji,
          backgroundTheme: updatedPod.backgroundTheme || prev.backgroundTheme,
          customBackgroundImageUrl: updatedPod.customBackgroundImageUrl !== undefined ? updatedPod.customBackgroundImageUrl : prev.customBackgroundImageUrl,
          isPrivate: updatedPod.isPrivate !== undefined ? updatedPod.isPrivate : prev.isPrivate,
          allowParticipantsChangeTheme: updatedPod.allowParticipantsChangeTheme !== undefined ? updatedPod.allowParticipantsChangeTheme : prev.allowParticipantsChangeTheme,
          allowParticipantsPlayBgMusic: updatedPod.allowParticipantsPlayBgMusic !== undefined ? updatedPod.allowParticipantsPlayBgMusic : prev.allowParticipantsPlayBgMusic,
          allowOpenMic: updatedPod.allowOpenMic !== undefined ? updatedPod.allowOpenMic : prev.allowOpenMic,
        }));
      }
    } else if (data.type === 'MODERATION_ACTION') {
      const { targetUserId, action } = data as unknown as { targetUserId: string; action: string };
      if (targetUserId === currentPersona.id) {
        if (action === 'kick') {
          alert(isArabic ? 'تم إخراجك من الحجرة بواسطة المضيف.' : 'You have been removed from this mood pod by the host.');
          onBack?.();
          return;
        } else if (action === 'remote_mute') {
          if (!voiceEngine.isMuted) {
            voiceEngine.toggleMute();
          }
        }
      }
      if (action === 'promote_moderator') {
        setPod((prev) => ({
          ...prev,
          moderatorUserIds: [...(prev.moderatorUserIds || []), targetUserId],
        }));
      } else if (action === 'demote_moderator') {
        setPod((prev) => ({
          ...prev,
          moderatorUserIds: (prev.moderatorUserIds || []).filter((id) => id !== targetUserId),
        }));
      }
    } else {
      // Forward WebRTC signals, audio chunks, sound effects, speaking events, and DJ background music to voiceEngine
      voiceEngine.handleIncomingData(data);
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clean up recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const content = inputText.trim();
    setInputText('');
    setIsSending(true);

    try {
      const msg = await api.sendPodMessage(pod.id, content);
      setMessages((prev) => {
        const index = prev.findIndex((m) => m.id === msg.id);
        if (index >= 0) {
          const copy = [...prev];
          copy[index] = msg;
          return copy;
        }
        return [...prev, msg];
      });
    } catch (err) {
      console.error('Send message error:', err);
      setInputText(content);
    } finally {
      setIsSending(false);
    }
  };

  // Voice Note Recording Methods
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone for recording:', err);
      alert(
        isArabic
          ? 'تعذر الوصول إلى الميكروفون. يرجى التأكد من منح الإذن في المتصفح.'
          : 'Could not access microphone. Please grant mic permissions.'
      );
    }
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  const stopAndSendVoiceRecording = async () => {
    if (!mediaRecorderRef.current) return;

    setIsSending(true);
    const duration = recordingSeconds;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }

    mediaRecorderRef.current.onstop = async () => {
      try {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());

        // Upload voice recording to media endpoint
        let audioUrl = '';
        try {
          const uploadRes = await api.uploadMedia(audioBlob, `voice-pod-${Date.now()}.webm`);
          audioUrl = uploadRes.url;
        } catch {
          // Fallback: use inline Object URL
          audioUrl = URL.createObjectURL(audioBlob);
        }

        const msg = await api.sendPodMessage(
          pod.id,
          isArabic ? '🎙️ رسالة صوتية' : '🎙️ Voice note',
          undefined,
          audioUrl,
          duration || 1
        );
        setMessages((prev) => {
          const index = prev.findIndex((m) => m.id === msg.id);
          if (index >= 0) {
            const copy = [...prev];
            copy[index] = msg;
            return copy;
          }
          return [...prev, msg];
        });
      } catch (err) {
        console.error('Error sending voice message:', err);
      } finally {
        setIsRecording(false);
        setRecordingSeconds(0);
        setIsSending(false);
        audioChunksRef.current = [];
      }
    };

    mediaRecorderRef.current.stop();
  };

  const handleReactionBurst = async (emoji: string) => {
    addReaction(emoji);
    try {
      await api.sendPodReaction(pod.id, emoji, 1);
    } catch (err) {
      console.error('Reaction burst error:', err);
    }
  };

  const getThemeBackground = (theme?: string) => {
    switch (theme) {
      case 'cyber-neon':
        return 'from-cyan-50 via-white to-fuchsia-50/40 dark:from-zinc-950 dark:via-cyan-950/30 dark:to-fuchsia-950/30';
      case 'lofi-chill':
        return 'from-amber-50 via-white to-orange-50/40 dark:from-zinc-950 dark:via-amber-950/30 dark:to-stone-950/40';
      case 'rain-forest':
        return 'from-emerald-50 via-white to-teal-50/40 dark:from-zinc-950 dark:via-emerald-950/30 dark:to-teal-950/30';
      case 'neon-amber':
        return 'from-rose-50 via-white to-amber-50/40 dark:from-zinc-950 dark:via-rose-950/30 dark:to-amber-950/30';
      default:
        return 'from-purple-50 via-white to-indigo-50/40 dark:from-zinc-950 dark:via-purple-950/30 dark:to-indigo-950/30';
    }
  };

  const formatRecordTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`relative h-[calc(100vh-170px)] md:h-[680px] flex flex-col glass-panel rounded-3xl border border-zinc-200 dark:border-zinc-800/80 overflow-hidden text-zinc-900 dark:text-white bg-gradient-to-b ${getThemeBackground(
        pod.backgroundTheme
      )} shadow-2xl transition-colors`}
    >
      {/* Custom Wallpaper Background Overlay */}
      {pod.customBackgroundImageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center z-0 opacity-20 dark:opacity-25 pointer-events-none transition-all duration-700"
          style={{ backgroundImage: `url(${getMediaUrl(pod.customBackgroundImageUrl)})` }}
        />
      )}

      {/* Floating Emoji Particle Canvas */}
      <FloatingReactions />

      {/* Live Sound Effect Notification Pill */}
      <AnimatePresence>
        {activeSoundBanner && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-gradient-to-r from-fuchsia-600 via-purple-600 to-cyan-500 rounded-2xl text-white font-bold text-xs shadow-2xl flex items-center gap-2 border border-white/20"
          >
            <Sparkles className="w-4 h-4 animate-spin text-amber-300" />
            <span>{activeSoundBanner.senderName} {isArabic ? 'شغّل:' : 'played:'}</span>
            <span className="font-extrabold text-amber-200">{activeSoundBanner.effect}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pod Room Header */}
      <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/85 dark:bg-zinc-950/75 backdrop-blur-xl flex items-center justify-between z-10 gap-3 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <Tooltip content={isArabic ? 'العودة لقائمة الحجرات الصوتية' : 'Back to Mood Pods'} position="bottom">
              <button
                onClick={onBack}
                className="p-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300 transition-colors shrink-0 shadow-sm"
              >
                <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              </button>
            </Tooltip>
          )}

          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-fuchsia-600 to-cyan-500 p-0.5 flex items-center justify-center text-xl shadow-lg shrink-0">
            <div className="w-full h-full bg-white dark:bg-zinc-950 rounded-[14px] flex items-center justify-center">
              {pod.moodEmoji}
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">{pod.title}</h3>
              {pod.isPrivate && (
                <span className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-purple-600 dark:text-purple-300 text-[10px] font-black flex items-center gap-1 shrink-0">
                  <Lock className="w-3 h-3" />
                  <span>{isArabic ? 'خاصة' : 'Private'}</span>
                </span>
              )}
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                <span>{pod.activeParticipantCount} {isArabic ? 'متواجدين' : 'online'}</span>
              </span>
              <span>•</span>
              <span className="text-zinc-600 dark:text-zinc-400 font-medium">@{pod.hostUsername}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-mono">
                <Clock className="w-3 h-3" />
                <span>{pod.timeRemaining ? `${String(pod.timeRemaining).split('.')[0]}` : '24h'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Live DJ Background Audio Sharing, Soundboard & Moderation */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Moderation / Room Settings Button */}
          {(isHost || isModerator || pod.allowParticipantsChangeTheme) && (
            <Tooltip
              content={
                isHost
                  ? isArabic
                    ? 'إعدادات وإشراف الحجرة'
                    : 'Pod Settings & Moderation'
                  : isArabic
                  ? 'إعدادات الحجرة المتاحة'
                  : 'Pod Settings'
              }
              position="bottom"
            >
              <button
                type="button"
                onClick={() => setIsModerationDrawerOpen(true)}
                className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-cyan-600 dark:text-cyan-400 transition-colors shadow-sm"
              >
                {isHost || isModerator ? <Shield className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
              </button>
            </Tooltip>
          )}

          <Tooltip content={isArabic ? 'لوحة المؤثرات الصوتية التفاعلية المباشرة' : 'Live Interactive DJ Soundboard'} position="bottom">
            <button
              onClick={() => setShowSoundboard(!showSoundboard)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                showSoundboard
                  ? 'bg-fuchsia-600/20 text-fuchsia-600 dark:text-fuchsia-300 border-fuchsia-500/50 shadow-md'
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Music className="w-3.5 h-3.5 text-fuchsia-500 dark:text-fuchsia-400" />
              <span className="hidden sm:inline">
                {isArabic ? 'المؤثرات 🎵' : 'Soundboard 🎵'}
              </span>
            </button>
          </Tooltip>

          {/* Live Background Audio / Local Audio Sharing */}
          <PodBgMusicPlayer
            bgMusic={voiceEngine.bgMusic}
            bgMusicVolume={voiceEngine.bgMusicVolume}
            isBgMusicMuted={voiceEngine.isBgMusicMuted}
            onVolumeChange={voiceEngine.setBgMusicVolume}
            onToggleMute={voiceEngine.toggleBgMusicMute}
            onStartSharingFile={voiceEngine.startSharingLocalFile}
            onStartSharingSystem={voiceEngine.startSharingSystemAudio}
            onPause={voiceEngine.pauseBgMusic}
            onResume={voiceEngine.resumeBgMusic}
            onStopSharing={voiceEngine.stopSharingBgMusic}
          />
        </div>
      </div>

      {/* Live Voice Stage (Full WebRTC P2P Voice Mesh + Audio Visualizer) */}
      <div className="px-3 pt-3 z-10">
        <PodAudioStage
          podId={pod.id}
          hostUsername={pod.hostUsername}
          hostDisplayName={pod.hostDisplayName}
          hostAvatarUrl={pod.hostAvatarUrl}
          speakers={voiceEngine.speakers}
          isOnStage={voiceEngine.isOnStage}
          isMuted={voiceEngine.isMuted}
          micLevel={voiceEngine.micLevel}
          isHandRaised={voiceEngine.isHandRaised}
          handRaisedUsers={voiceEngine.handRaisedUsers}
          roomVolume={voiceEngine.roomVolume}
          isAudioMuted={voiceEngine.isAudioMuted}
          onJoinStage={voiceEngine.handleJoinStage}
          onLeaveStage={voiceEngine.handleLeaveStage}
          onToggleMute={voiceEngine.toggleMute}
          onToggleHandRaise={voiceEngine.toggleHandRaise}
          onInviteUser={voiceEngine.inviteUserToStage}
          onVolumeChange={voiceEngine.setRoomVolume}
          onToggleAudioMute={() => voiceEngine.setIsAudioMuted(!voiceEngine.isAudioMuted)}
        />
      </div>

      {/* Interactive Soundboard Drawer */}
      <AnimatePresence>
        {showSoundboard && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-950/90 backdrop-blur-xl z-20 overflow-hidden"
          >
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>{isArabic ? 'لوحة المؤثرات الحية (يسمعها الجميع فورا):' : 'Live Room Soundboard (Audible to Everyone):'}</span>
              </span>
              <button
                onClick={() => setShowSoundboard(false)}
                className="text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              >
                {isArabic ? 'إغلاق ✕' : 'Close ✕'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {SOUNDBOARD_EFFECTS.map((eff) => (
                <button
                  key={eff.id}
                  onClick={() => voiceEngine.triggerSoundEffect(eff.id)}
                  className="px-2.5 py-2 rounded-2xl bg-zinc-100 dark:bg-zinc-900/90 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800/90 hover:border-fuchsia-500/50 flex flex-col items-center gap-1 shadow-sm transition-all active:scale-95 group"
                >
                  <span className="text-xl group-hover:scale-125 transition-transform">{eff.emoji}</span>
                  <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 group-hover:text-fuchsia-600 dark:group-hover:text-fuchsia-300 truncate w-full text-center">
                    {isArabic ? eff.arName : eff.name}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages & Audio Stream */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-3 no-scrollbar z-10">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 dark:text-zinc-400 space-y-2">
            <Radio className="w-8 h-8 text-zinc-400 dark:text-zinc-600 animate-pulse" />
            <p className="text-xs font-semibold">
              {isArabic
                ? 'الحجرة هادئة حالياً. افتح المايك للتحدث لايف أو شغل مؤثرات صوتية!'
                : 'Room is quiet. Open your mic to speak live or drop a voice note!'}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe =
              msg.senderId === currentPersona.id || msg.senderUsername === currentPersona.username;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}
              >
                <img
                  src={
                    msg.senderAvatarUrl ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.senderUsername}`
                  }
                  alt={msg.senderUsername}
                  className="w-7 h-7 rounded-xl border border-zinc-300 dark:border-zinc-700 object-cover flex-shrink-0"
                />
                <div
                  className={`max-w-[80%] p-3 rounded-2xl text-xs space-y-1.5 shadow-md ${
                    isMe
                      ? 'bg-gradient-to-tr from-fuchsia-600 to-purple-600 text-white rounded-tr-none'
                      : 'bg-white/95 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-none'
                  }`}
                >
                  {!isMe && (
                    <span className="text-[10px] font-bold text-fuchsia-600 dark:text-fuchsia-400 block">
                      {msg.senderDisplayName || msg.senderUsername}
                    </span>
                  )}

                  {msg.text && (
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  )}

                  {/* Inline Audio Player if Message contains Voice Note */}
                  {msg.audioUrl && (
                    <PodAudioPlayer
                      audioUrl={msg.audioUrl}
                      durationSeconds={msg.durationSeconds}
                    />
                  )}
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Reaction Fountain Bar */}
      <div className="px-4 py-1.5 border-t border-zinc-200 dark:border-zinc-800/60 bg-white/90 dark:bg-zinc-950/85 backdrop-blur-md flex items-center justify-between gap-1 overflow-x-auto no-scrollbar z-10 transition-colors">
        <span className="text-[10px] font-bold text-zinc-500 flex-shrink-0">
          {isArabic ? 'تفاعل سريع:' : 'Burst:'}
        </span>
        {BURST_EMOJIS.map((emoji) => (
          <Tooltip key={emoji} content={`${isArabic ? 'إطلاق تفاعل' : 'Send burst'} ${emoji}`} position="top">
            <button
              onClick={() => handleReactionBurst(emoji)}
              className="text-xl p-1.5 hover:scale-125 active:scale-90 transition-transform rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/60 flex-shrink-0"
            >
              {emoji}
            </button>
          </Tooltip>
        ))}
      </div>

      {/* Message & Voice Note Input Bar */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 z-10 transition-colors">
        {isRecording ? (
          /* Live Audio Recording Status Bar */
          <div className="flex items-center justify-between gap-3 p-2 bg-rose-100 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800/60 rounded-2xl animate-pulse">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
              <span>{isArabic ? 'جاري التسجيل الصوتي...' : 'Recording Voice Note...'}</span>
              <span className="font-mono text-white bg-rose-600 dark:bg-rose-900/60 px-2 py-0.5 rounded-md">
                {formatRecordTime(recordingSeconds)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Tooltip content={isArabic ? 'إلغاء وحذف التسجيل' : 'Cancel recording'} position="top">
                <button
                  type="button"
                  onClick={cancelVoiceRecording}
                  className="p-2 text-zinc-500 hover:text-rose-600 dark:hover:text-rose-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-900 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Tooltip>

              <Tooltip content={isArabic ? 'إرسال الرسالة الصوتية للحجرة' : 'Send voice note to pod'} position="top">
                <button
                  type="button"
                  onClick={stopAndSendVoiceRecording}
                  disabled={isSending}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition-all active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'إرسال المقطع' : 'Send Voice'}</span>
                </button>
              </Tooltip>
            </div>
          </div>
        ) : (
          /* Standard Input Bar with Mic button */
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <Tooltip content={isArabic ? 'تسجيل رسالة صوتية ومشاركتها في الحجرة' : 'Record & share voice note in pod'} position="top">
              <button
                type="button"
                onClick={startVoiceRecording}
                className="p-2.5 bg-zinc-100 dark:bg-zinc-900 hover:bg-cyan-500/10 dark:hover:bg-cyan-600/20 text-cyan-600 dark:text-cyan-400 border border-zinc-200 dark:border-zinc-800 hover:border-cyan-500/40 rounded-2xl transition-all shadow-sm shrink-0"
              >
                <Mic className="w-4 h-4" />
              </button>
            </Tooltip>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                isArabic
                  ? 'اكتب رسالة أو افتح المايك للتحدث...'
                  : 'Drop a thought or open mic to talk live...'
              }
              className="flex-1 px-3.5 py-2.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 transition-colors"
            />

            <Tooltip content={isArabic ? 'إرسال الرسالة النصية' : 'Send text message'} position="top">
              <button
                type="submit"
                disabled={isSending || !inputText.trim()}
                className="p-2.5 bg-gradient-to-tr from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-2xl active:scale-95 transition-all shadow-lg shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </Tooltip>
          </form>
        )}
      </div>

      {/* Pod Moderation & Settings Drawer */}
      <PodModerationDrawer
        isOpen={isModerationDrawerOpen}
        onClose={() => setIsModerationDrawerOpen(false)}
        pod={pod}
        isHost={isHost}
        isModerator={isModerator}
        speakers={voiceEngine.speakers}
        onSettingsUpdated={(updated) => {
          setPod(updated);
        }}
      />
    </div>
  );
};
