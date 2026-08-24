import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useThemeStore } from '../../stores/useThemeStore';
import { api } from '../../services/apiClient';
import { MoodPodDto } from '../../types/api';
import { Clock, Radio, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CreateMoodPodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPodCreated: (pod: MoodPodDto) => void;
}

const EMOJI_PRESETS = ['🌙', '🎧', '⚡', '☕', '🎮', '🔥', '🌈', '🧪', '🍿', '💤', '🚀', '💻', '🧠', '🎨', '🍕'];

const THEMES = [
  {
    id: 'cosmic-purple',
    name: 'Cosmic Nebula',
    nameAr: 'سديم كوني',
    gradient: 'from-purple-950 via-indigo-950 to-zinc-950 border-purple-500/40',
    accent: 'text-purple-400',
  },
  {
    id: 'cyber-neon',
    name: 'Cyberpunk Synth',
    nameAr: 'سايبر بانك نيون',
    gradient: 'from-cyan-950 via-fuchsia-950 to-zinc-950 border-cyan-500/40',
    accent: 'text-cyan-400',
  },
  {
    id: 'lofi-chill',
    name: 'Late Night Lo-Fi',
    nameAr: 'مقهى لو-فاي هادئ',
    gradient: 'from-amber-950 via-stone-900 to-zinc-950 border-amber-500/40',
    accent: 'text-amber-400',
  },
  {
    id: 'rain-forest',
    name: 'Rainy Night',
    nameAr: 'أمطار هادئة',
    gradient: 'from-emerald-950 via-teal-950 to-zinc-950 border-emerald-500/40',
    accent: 'text-emerald-400',
  },
  {
    id: 'neon-amber',
    name: 'Electric Amber',
    nameAr: 'كهرباء ذهبية',
    gradient: 'from-rose-950 via-amber-950 to-zinc-950 border-rose-500/40',
    accent: 'text-rose-400',
  },
];

export const CreateMoodPodModal: React.FC<CreateMoodPodModalProps> = ({
  isOpen,
  onClose,
  onPodCreated,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  const [title, setTitle] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🎧');
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0].id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(isArabic ? 'يرجى إدخال عنوان للحجرة' : 'Please enter a room title');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const newPod = await api.createPod(title.trim(), selectedEmoji, selectedTheme);
      onPodCreated(newPod);
      setTitle('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create mood pod';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return typeof document !== 'undefined'
    ? createPortal(
        <AnimatePresence>
          {isOpen && (
            <div
              className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
              onClick={onClose}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl text-white space-y-4 relative z-10"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 flex items-center justify-center">
                      <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                        <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-base">
                        {isArabic ? 'إنشاء حجرة مزاج مؤقتة (24 ساعة)' : 'Create Ephemeral Mood Pod'}
                      </h3>
                      <p className="text-[11px] text-zinc-400">
                        {isArabic ? 'غرفة صوت ودردشة تفاعلية تنتهي تلقائياً بعد 24 ساعة' : '24h real-time room with ambient sound & live reactions'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 text-zinc-400 hover:text-white rounded-full bg-zinc-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {error && (
                  <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-800 text-xs text-rose-300">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Room Title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">
                      {isArabic ? 'عنوان الحجرة / موضوع النقاش' : 'Room Title & Topic'} <span className="text-fuchsia-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={isArabic ? 'مثال: سهرة برمجة وتصميم مع موسيقى هادئة 🎧' : 'e.g. Late Night Coding & Synthwave Chill 🎧'}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-cyan-500 rounded-2xl text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Mood Emoji Picker */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">
                      {isArabic ? 'أيقونة المزاج' : 'Mood Emoji'}
                    </label>
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                      {EMOJI_PRESETS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setSelectedEmoji(emoji)}
                          className={`text-xl p-2.5 rounded-2xl border transition-all shrink-0 ${
                            selectedEmoji === emoji
                              ? 'bg-cyan-500/20 border-cyan-400 scale-110 shadow-lg shadow-cyan-500/20'
                              : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Theme Picker */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">
                      {isArabic ? 'السمة البصرية والصوتية' : 'Ambient Visual & Sound Theme'}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {THEMES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTheme(t.id)}
                          className={`p-3 rounded-2xl border text-left rtl:text-right bg-gradient-to-r ${t.gradient} transition-all flex items-center justify-between ${
                            selectedTheme === t.id
                              ? 'ring-2 ring-cyan-400 border-cyan-400 shadow-md'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold text-white">
                              {isArabic ? t.nameAr : t.name}
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              {isArabic ? 'خلفية ومؤثر صوتي مدمج' : 'Background & soundscape'}
                            </div>
                          </div>
                          {selectedTheme === t.id && (
                            <Sparkles className={`w-4 h-4 ${t.accent}`} />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Expiration Banner */}
                  <div className="p-3 bg-zinc-950/80 rounded-2xl border border-zinc-800 flex items-center gap-2.5 text-xs text-zinc-400">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      {isArabic
                        ? 'ستظل الحجرة نشطة لمدة 24 ساعة، ثم تُغلق وتُحذف تلقائياً.'
                        : 'This room will remain active for 24 hours and will be closed automatically.'}
                    </span>
                  </div>

                  {/* Submit Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-semibold text-zinc-300"
                    >
                      {isArabic ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-cyan-600/30"
                    >
                      <Radio className="w-4 h-4" />
                      <span>{isSubmitting ? (isArabic ? 'جاري الإنشاء...' : 'Creating...') : (isArabic ? 'إطلاق الحجرة الآن' : 'Launch Mood Pod')}</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )
    : null;
};
