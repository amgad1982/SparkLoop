import React, { useState, useEffect, useRef } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { PodSpeaker } from '../../types/api';
import { api } from '../../services/apiClient';
import { Mic, MicOff, Radio, Sparkles, UserPlus, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PodAudioStageProps {
  podId: string;
  hostUsername: string;
  hostDisplayName: string;
  hostAvatarUrl?: string;
  speakers: PodSpeaker[];
  onSpeakersChange: (speakers: PodSpeaker[]) => void;
}

export const PodAudioStage: React.FC<PodAudioStageProps> = ({
  podId,
  hostUsername,
  hostDisplayName,
  hostAvatarUrl,
  speakers,
  onSpeakersChange,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';
  const { currentPersona } = useAuthStore();

  const [isOnStage, setIsOnStage] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSpeakingRef = useRef(false);

  const isUserOnStage = speakers.some((s) => s.userId === currentPersona.id);

  // Initialize stage with Host if empty
  useEffect(() => {
    if (speakers.length === 0) {
      const initialSpeaker: PodSpeaker = {
        userId: '11111111-1111-1111-1111-111111111111',
        username: hostUsername,
        displayName: hostDisplayName || hostUsername,
        avatarUrl: hostAvatarUrl,
        isSpeaking: false,
        isMuted: false,
        joinedAtUtc: Date.now(),
      };
      onSpeakersChange([initialSpeaker]);
    }
  }, [hostUsername, hostDisplayName, hostAvatarUrl, speakers.length, onSpeakersChange]);

  // Handle stepping on stage & setting up mic audio analysis
  const handleJoinStage = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsOnStage(true);
      setIsMuted(false);

      // Add to local speakers
      const mySpeaker: PodSpeaker = {
        userId: currentPersona.id,
        username: currentPersona.username,
        displayName: currentPersona.displayName,
        avatarUrl: currentPersona.avatarUrl,
        isSpeaking: false,
        isMuted: false,
        joinedAtUtc: Date.now(),
      };
      onSpeakersChange([...speakers.filter((s) => s.userId !== currentPersona.id), mySpeaker]);

      // Start audio monitoring loop
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const monitorAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));

        const speakingNow = avg > 15;
        if (speakingNow !== isSpeakingRef.current) {
          isSpeakingRef.current = speakingNow;
          updateSpeakingState(speakingNow);
        }

        animFrameRef.current = requestAnimationFrame(monitorAudio);
      };
      monitorAudio();
    } catch (err) {
      console.warn('Microphone permission or audio stage error:', err);
      // Fallback: join stage in virtual mode
      setIsOnStage(true);
      const mySpeaker: PodSpeaker = {
        userId: currentPersona.id,
        username: currentPersona.username,
        displayName: currentPersona.displayName,
        avatarUrl: currentPersona.avatarUrl,
        isSpeaking: true,
        isMuted: false,
        joinedAtUtc: Date.now(),
      };
      onSpeakersChange([...speakers.filter((s) => s.userId !== currentPersona.id), mySpeaker]);
    }
  };

  const handleLeaveStage = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsOnStage(false);
    setMicLevel(0);
    isSpeakingRef.current = false;

    // Broadcast speaking status false
    api.setPodSpeakingStatus(podId, false, true).catch(() => {});

    onSpeakersChange(speakers.filter((s) => s.userId !== currentPersona.id));
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !nextMuted;
      });
    }

    onSpeakersChange(
      speakers.map((s) => (s.userId === currentPersona.id ? { ...s, isMuted: nextMuted, isSpeaking: false } : s))
    );

    api.setPodSpeakingStatus(podId, false, nextMuted).catch(() => {});
  };

  const updateSpeakingState = (speaking: boolean) => {
    onSpeakersChange(
      speakers.map((s) => (s.userId === currentPersona.id ? { ...s, isSpeaking: speaking && !isMuted } : s))
    );

    api.setPodSpeakingStatus(podId, speaking && !isMuted, isMuted).catch(() => {});
  };

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="p-3.5 rounded-3xl bg-zinc-950/70 border border-zinc-800/80 backdrop-blur-md space-y-3">
      {/* Stage Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>{isArabic ? 'المسرح الصوتي المباشر' : 'Live Voice Stage'}</span>
          </div>
          <span className="text-[11px] text-zinc-400">
            {speakers.length} {isArabic ? 'متحدثين' : 'speakers'}
          </span>
        </div>

        {/* Join / Leave Stage Action */}
        {!isUserOnStage ? (
          <button
            type="button"
            onClick={handleJoinStage}
            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>{isArabic ? 'طلب المايك 🎙️' : 'Grab Mic 🎙️'}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className={`p-1.5 rounded-xl border transition-all ${
                isMuted
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                  : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 animate-pulse'
              }`}
              title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={handleLeaveStage}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition-colors"
            >
              {isArabic ? 'مغادرة المسرح' : 'Leave'}
            </button>
          </div>
        )}
      </div>

      {/* Speakers Grid / Halo Avatars */}
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
        {speakers.map((speaker) => {
          const isHost = speaker.username === hostUsername;
          return (
            <motion.div
              key={speaker.userId}
              layout
              className="flex flex-col items-center gap-1.5 shrink-0 min-w-[70px]"
            >
              <div className="relative">
                {/* Speaking Wave Halo Glow */}
                {speaker.isSpeaking && (
                  <span className="absolute -inset-1.5 rounded-full bg-emerald-400/40 animate-ping" />
                )}

                <div
                  className={`w-12 h-12 rounded-2xl p-0.5 transition-all ${
                    speaker.isSpeaking
                      ? 'ring-2 ring-emerald-400 bg-gradient-to-tr from-emerald-500 to-cyan-400 shadow-lg shadow-emerald-500/40 scale-105'
                      : speaker.isMuted
                      ? 'ring-1 ring-zinc-700 bg-zinc-800 opacity-70'
                      : 'ring-1 ring-zinc-700 bg-zinc-800'
                  }`}
                >
                  <img
                    src={speaker.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${speaker.username}`}
                    alt={speaker.username}
                    className="w-full h-full rounded-[14px] object-cover bg-zinc-950"
                  />
                </div>

                {/* Mic Status Badge */}
                <div
                  className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] border border-zinc-900 ${
                    speaker.isMuted ? 'bg-rose-600 text-white' : speaker.isSpeaking ? 'bg-emerald-500 text-zinc-950 animate-bounce' : 'bg-zinc-700 text-zinc-300'
                  }`}
                >
                  {speaker.isMuted ? <MicOff className="w-2.5 h-2.5" /> : <Mic className="w-2.5 h-2.5" />}
                </div>
              </div>

              <div className="text-center max-w-[70px]">
                <span className="text-[11px] font-bold text-zinc-200 block truncate">
                  {speaker.displayName || speaker.username}
                </span>
                {isHost && (
                  <span className="text-[9px] text-fuchsia-400 font-bold uppercase tracking-wider block">
                    Host
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Live Mic Waveform Bar for Active User */}
      {isUserOnStage && !isMuted && (
        <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/60 text-[10px] text-zinc-400">
          <span className="text-emerald-400 font-bold shrink-0">{isArabic ? 'صوتك لايف:' : 'Live Mic:'}</span>
          <div className="flex-1 h-1.5 bg-zinc-900 rounded-full overflow-hidden flex items-center">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-75 rounded-full"
              style={{ width: `${Math.max(5, micLevel)}%` }}
            />
          </div>
          <span className="font-mono text-zinc-500 shrink-0">{micLevel}%</span>
        </div>
      )}
    </div>
  );
};
