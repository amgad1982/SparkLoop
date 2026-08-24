import React, { useState, useRef, useEffect } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { ChainDto } from '../../types/api';
import { api } from '../../services/apiClient';
import { Mic, Send, Square, Play, Pause, Trash2, Volume2, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TurnInputDrawerProps {
  chain: ChainDto;
  isOpen: boolean;
  onClose: () => void;
  onStepSubmitted: (updatedChain: ChainDto) => void;
}

export const TurnInputDrawer: React.FC<TurnInputDrawerProps> = ({
  chain,
  isOpen,
  onClose,
  onStepSubmitted,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';
  const { currentPersona } = useAuthStore();

  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const maxChars = 100;
  const charsRemaining = maxChars - content.length;
  const maxAudioSeconds = 15;

  // Cleanup on unmount or modal close
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
      }
    };
  }, [audioPreviewUrl]);

  // Start microphone recording
  const startRecording = async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioPreviewUrl(url);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      // Start elapsed timer (auto-stops at maxAudioSeconds)
      const startTime = Date.now();
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordingSeconds(elapsed);
        if (elapsed >= maxAudioSeconds) {
          stopRecording();
        }
      }, 200);
    } catch (err: unknown) {
      console.error('Microphone access error:', err);
      setErrorMessage(
        isArabic
          ? 'تعذر الوصول إلى الميكروفون. يرجى منح الإذن للتسجيل.'
          : 'Microphone access denied. Please grant microphone permissions.'
      );
    }
  };

  // Stop microphone recording
  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // Discard recorded audio
  const discardAudio = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
    }
    setAudioBlob(null);
    setAudioPreviewUrl(null);
    setRecordingSeconds(0);
    setIsPlayingPreview(false);
  };

  // Toggle playback of recorded preview
  const togglePlayPreview = () => {
    if (!audioPreviewUrl) return;

    if (isPlayingPreview && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
      return;
    }

    const audio = new Audio(audioPreviewUrl);
    previewAudioRef.current = audio;
    setIsPlayingPreview(true);

    audio.play().catch((err) => {
      console.error('Audio playback error:', err);
      setIsPlayingPreview(false);
    });

    audio.onended = () => {
      setIsPlayingPreview(false);
    };

    audio.onerror = () => {
      setIsPlayingPreview(false);
    };
  };

  // Submit step
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !audioBlob) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let finalAudioUrl: string | undefined = undefined;
      let finalDurationSeconds: number | undefined = undefined;

      if (audioBlob) {
        // Convert blob to base64 data URL
        finalAudioUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });
        finalDurationSeconds = Math.max(1, Math.min(maxAudioSeconds, recordingSeconds));
      }

      const updated = await api.submitChainStep(
        chain.id,
        content.trim(),
        finalAudioUrl,
        finalDurationSeconds,
        chain.rowVersion
      );

      setContent('');
      discardAudio();
      onStepSubmitted(updated);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit step';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full max-w-md bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-5 space-y-4 text-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 bg-fuchsia-500/20 text-fuchsia-300 rounded-md border border-fuchsia-500/30">
                  {isArabic ? `الدور رقم ${chain.currentStepCount + 1}` : `Turn #${chain.currentStepCount + 1}`}
                </span>
                <h3 className="font-bold text-base mt-1 truncate max-w-[280px]">
                  {chain.title}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-white rounded-full bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Persona reminder */}
            <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
              <img
                src={currentPersona.avatarUrl}
                alt={currentPersona.username}
                className="w-6 h-6 rounded-full border border-zinc-700 object-cover"
              />
              <span className="text-zinc-300">
                {isArabic ? 'تكتب الآن بصفتك: ' : 'Submitting as: '}
                <strong className="text-white">{currentPersona.displayName}</strong>
              </span>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <textarea
                  rows={3}
                  maxLength={maxChars}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    isArabic
                      ? 'أكمل القصة بما لا يتجاوز 100 حرف...'
                      : 'Add the next beat of the story (max 100 chars)...'
                  }
                  className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-2xl text-xs text-white resize-none focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500"
                />
                <span
                  className={`absolute bottom-2.5 right-3 text-[11px] font-bold ${
                    charsRemaining < 15 ? 'text-amber-400' : 'text-zinc-500'
                  }`}
                >
                  {charsRemaining}
                </span>
              </div>

              {/* Real Microphone Recording Studio */}
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-2">
                {isRecording ? (
                  /* Recording in Progress */
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                      <span className="text-xs font-bold text-rose-400">
                        {isArabic ? 'جاري التسجيل...' : 'Recording...'}
                      </span>
                      <span className="text-xs font-mono font-bold text-zinc-300">
                        {recordingSeconds}s / {maxAudioSeconds}s
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={stopRecording}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-rose-600/30 active:scale-95"
                    >
                      <Square className="w-3.5 h-3.5 fill-white" />
                      <span>{isArabic ? 'إيقاف' : 'Stop'}</span>
                    </button>
                  </div>
                ) : audioBlob ? (
                  /* Audio Recorded & Ready Preview */
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={togglePlayPreview}
                        className="w-8 h-8 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black flex items-center justify-center transition-transform active:scale-95 shrink-0"
                        title={isPlayingPreview ? 'Pause' : 'Play'}
                      >
                        {isPlayingPreview ? (
                          <Pause className="w-4 h-4 fill-black" />
                        ) : (
                          <Play className="w-4 h-4 fill-black ml-0.5" />
                        )}
                      </button>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-cyan-300">
                            {isArabic ? 'ملاحظة صوتية جاهزة' : 'Audio Note Ready'}
                          </span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-cyan-950 text-cyan-400 rounded border border-cyan-800">
                            {recordingSeconds}s
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400">
                          {isArabic ? 'انقر للاستماع قبل الإرسال' : 'Click play to review recording'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={discardAudio}
                      className="p-2 hover:bg-zinc-850 rounded-xl text-zinc-500 hover:text-rose-400 transition-colors"
                      title={isArabic ? 'حذف وإعادة التسجيل' : 'Discard & Re-record'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  /* Initial Idle State: Start Recording Button */
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <Mic className="w-4 h-4 text-cyan-400" />
                      <span className="text-zinc-300">
                        {isArabic ? 'تسجيل مقطع صوتي (15 ثانية)' : 'Record 15s Voice Note'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={startRecording}
                      className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 hover:border-cyan-500/50 text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 transition-all active:scale-95"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>{isArabic ? 'بدء التسجيل' : 'Record Mic'}</span>
                    </button>
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="p-2.5 bg-rose-950/50 border border-rose-800 text-xs text-rose-300 rounded-xl">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || (!content.trim() && !audioBlob)}
                className="w-full py-3 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>
                  {isSubmitting
                    ? isArabic
                      ? 'جاري الإرسال وتمرير المايك...'
                      : 'Passing the Mic...'
                    : isArabic
                    ? 'تمرير المايك والتسليم 🎤'
                    : 'Pass The Mic 🎤'}
                </span>
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
