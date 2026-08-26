import React, { useState, useRef, useEffect } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { api } from '../../services/apiClient';
import { ChainDto } from '../../types/api';
import { GitBranch, Plus, X, Mic, Square, Play, Pause, Trash2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CreateChainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChainCreated: (chain: ChainDto) => void;
}

export const CreateChainModal: React.FC<CreateChainModalProps> = ({
  isOpen,
  onClose,
  onChainCreated,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('Cyberpunk');
  const [maxSteps, setMaxSteps] = useState<number>(10);
  const [initialContent, setInitialContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const maxAudioSeconds = 15;

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

  const startRecording = async () => {
    setError(null);
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
      setError(
        isArabic
          ? 'تعذر الوصول إلى الميكروفون. يرجى منح الإذن للتسجيل.'
          : 'Microphone access denied. Please grant microphone permissions.'
      );
    }
  };

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

    audio.onended = () => setIsPlayingPreview(false);
    audio.onerror = () => setIsPlayingPreview(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || (!initialContent.trim() && !audioBlob)) return;

    setIsSubmitting(true);
    setError(null);

    try {
      let finalAudioUrl: string | undefined = undefined;
      let finalDurationSeconds: number | undefined = undefined;

      if (audioBlob) {
        finalAudioUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });
        finalDurationSeconds = Math.max(1, Math.min(maxAudioSeconds, recordingSeconds));
      }

      const created = await api.createChain(
        title.trim(),
        theme.trim(),
        maxSteps,
        initialContent.trim(),
        finalAudioUrl,
        finalDurationSeconds
      );
      onChainCreated(created);
      discardAudio();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Creation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-white dark:bg-[#131b28] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 text-slate-900 dark:text-white shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                <h3 className="font-bold text-lg">
                  {isArabic ? 'بدء سلسلة قصة جديدة' : 'Start a New Story Chain'}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  {isArabic ? 'عنوان السلسلة' : 'Story Title'}
                </label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isArabic ? 'مثال: لغز المختبر المفقود' : 'e.g. The Midnight Glitch'}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                    {isArabic ? 'الثيم / النوع' : 'Theme'}
                  </label>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Cyberpunk">Cyberpunk / خيال علمي</option>
                    <option value="Comedy">Comedy Improv / كوميديا</option>
                    <option value="Mystery">Mystery / غموض وتشويق</option>
                    <option value="Fantasy">Fantasy / مغامرات وسحر</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                    {isArabic ? 'عدد الأدوار' : 'Max Steps Limit'}
                  </label>
                  <div className="flex gap-2">
                    {[5, 10, 20].map((steps) => (
                      <button
                        type="button"
                        key={steps}
                        onClick={() => setMaxSteps(steps)}
                        className={`flex-1 py-2 rounded-xl font-bold border transition-colors ${
                          maxSteps === steps
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 dark:bg-[#0b0f17] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {steps}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  {isArabic ? 'الجملة الافتتاحية (الدور 1)' : 'Opening Sentence (Turn #1)'}
                </label>
                <textarea
                  rows={2}
                  maxLength={100}
                  value={initialContent}
                  onChange={(e) => setInitialContent(e.target.value)}
                  placeholder={
                    isArabic
                      ? 'اكتب الجملة الأولى لتشعل القصة (أقل من 100 حرف)...'
                      : 'Write the opening beat (max 100 chars)...'
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white resize-none focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Audio Note Studio */}
              <div className="p-3 bg-slate-50 dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-2">
                {isRecording ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                      <span className="text-xs font-bold text-rose-500">
                        {isArabic ? 'جاري التسجيل...' : 'Recording...'}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                        {recordingSeconds}s / {maxAudioSeconds}s
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={stopRecording}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm active:scale-95"
                    >
                      <Square className="w-3.5 h-3.5 fill-white" />
                      <span>{isArabic ? 'إيقاف' : 'Stop'}</span>
                    </button>
                  </div>
                ) : audioBlob ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={togglePlayPreview}
                        className="w-8 h-8 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 flex items-center justify-center transition-transform active:scale-95 shrink-0 shadow-sm"
                        title={isPlayingPreview ? 'Pause' : 'Play'}
                      >
                        {isPlayingPreview ? (
                          <Pause className="w-4 h-4 fill-slate-950" />
                        ) : (
                          <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
                        )}
                      </button>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-sky-600 dark:text-sky-300">
                            {isArabic ? 'ملاحظة صوتية جاهزة' : 'Audio Note Ready'}
                          </span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded border border-sky-500/30">
                            {recordingSeconds}s
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {isArabic ? 'انقر للاستماع قبل الإطلاق' : 'Click play to review recording'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={discardAudio}
                      className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl text-slate-500 hover:text-rose-500 transition-colors"
                      title={isArabic ? 'حذف وإعادة التسجيل' : 'Discard & Re-record'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <Mic className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                      <span className="text-slate-600 dark:text-slate-300">
                        {isArabic ? 'إرفاق صوت للدور الأول (اختياري)' : 'Attach 15s Voice Note (Optional)'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={startRecording}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-sky-600 dark:text-sky-300 flex items-center gap-1.5 transition-colors shadow-sm active:scale-95"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>{isArabic ? 'تسجيل' : 'Record'}</span>
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !title.trim() || (!initialContent.trim() && !audioBlob)}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>
                  {isSubmitting
                    ? isArabic
                      ? 'جاري الإنشاء...'
                      : 'Creating...'
                    : isArabic
                    ? 'إطلاق السلسلة 🚀'
                    : 'Launch Chain 🚀'}
                </span>
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
