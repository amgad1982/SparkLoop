import React, { useState } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { ChainDto } from '../../types/api';
import { api } from '../../services/apiClient';
import { Mic, Send, Volume2, X } from 'lucide-react';
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
  const [includeAudio, setIncludeAudio] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const maxChars = 100;
  const charsRemaining = maxChars - content.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !includeAudio) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const audioUrl = includeAudio
        ? 'https://actions.google.com/sounds/v1/human_voices/applause_crowd_cheering.ogg'
        : undefined;
      const durationSeconds = includeAudio ? 5 : undefined;

      const updated = await api.submitChainStep(
        chain.id,
        content.trim(),
        audioUrl,
        durationSeconds,
        chain.rowVersion
      );

      setContent('');
      setIncludeAudio(false);
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

              {/* Audio Note Toggle */}
              <div className="flex items-center justify-between p-2.5 bg-zinc-950 border border-zinc-800 rounded-2xl">
                <div className="flex items-center gap-2 text-xs">
                  <Mic className="w-4 h-4 text-cyan-400" />
                  <span className="text-zinc-300">
                    {isArabic ? 'إرفاق تسجيل صوتي 15 ثانية' : 'Attach 15s Audio Note'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIncludeAudio(!includeAudio)}
                  className={`px-3 py-1 text-xs font-bold rounded-xl transition-colors ${
                    includeAudio
                      ? 'bg-cyan-500 text-black'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {includeAudio ? (isArabic ? 'مرفق ✓' : 'Attached ✓') : (isArabic ? 'إضافة' : '+ Add')}
                </button>
              </div>

              {errorMessage && (
                <div className="p-2.5 bg-rose-950/50 border border-rose-800 text-xs text-rose-300 rounded-xl">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || (!content.trim() && !includeAudio)}
                className="w-full py-3 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? (isArabic ? 'جاري الإرسال...' : 'Passing the Mic...') : (isArabic ? 'تمرير المايك والتسليم 🎤' : 'Pass The Mic 🎤')}</span>
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
