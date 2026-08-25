import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useThemeStore } from '../../stores/useThemeStore';
import { api } from '../../services/apiClient';
import { MoodPodDto } from '../../types/api';
import { Clock, Globe, Lock, Mic, Music, Palette, Radio, Shield, Sparkles, X } from 'lucide-react';
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
    gradient: 'from-purple-100 via-indigo-50 to-white dark:from-purple-950 dark:via-indigo-950 dark:to-zinc-950 border-purple-300 dark:border-purple-500/40',
    accent: 'text-purple-600 dark:text-purple-400',
    textColor: 'text-purple-950 dark:text-white',
  },
  {
    id: 'cyber-neon',
    name: 'Cyberpunk Synth',
    nameAr: 'سايبر بانك نيون',
    gradient: 'from-cyan-100 via-fuchsia-50 to-white dark:from-cyan-950 dark:via-fuchsia-950 dark:to-zinc-950 border-cyan-300 dark:border-cyan-500/40',
    accent: 'text-cyan-600 dark:text-cyan-400',
    textColor: 'text-cyan-950 dark:text-white',
  },
  {
    id: 'lofi-chill',
    name: 'Late Night Lo-Fi',
    nameAr: 'مقهى لو-فاي هادئ',
    gradient: 'from-amber-100 via-stone-50 to-white dark:from-amber-950 dark:via-stone-900 dark:to-zinc-950 border-amber-300 dark:border-amber-500/40',
    accent: 'text-amber-600 dark:text-amber-400',
    textColor: 'text-amber-950 dark:text-white',
  },
  {
    id: 'rain-forest',
    name: 'Rainy Night',
    nameAr: 'أمطار هادئة',
    gradient: 'from-emerald-100 via-teal-50 to-white dark:from-emerald-950 dark:via-teal-950 dark:to-zinc-950 border-emerald-300 dark:border-emerald-500/40',
    accent: 'text-emerald-600 dark:text-emerald-400',
    textColor: 'text-emerald-950 dark:text-white',
  },
  {
    id: 'neon-amber',
    name: 'Electric Amber',
    nameAr: 'كهرباء ذهبية',
    gradient: 'from-rose-100 via-amber-50 to-white dark:from-rose-950 dark:via-amber-950 dark:to-zinc-950 border-rose-300 dark:border-rose-500/40',
    accent: 'text-rose-600 dark:text-rose-400',
    textColor: 'text-rose-950 dark:text-white',
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
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowParticipantsChangeTheme, setAllowParticipantsChangeTheme] = useState(false);
  const [allowParticipantsPlayBgMusic, setAllowParticipantsPlayBgMusic] = useState(true);
  const [allowOpenMic, setAllowOpenMic] = useState(true);
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
      const newPod = await api.createPod({
        title: title.trim(),
        moodEmoji: selectedEmoji,
        backgroundTheme: selectedTheme,
        isPrivate,
        allowParticipantsChangeTheme,
        allowParticipantsPlayBgMusic,
        allowOpenMic,
      });
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
              className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md"
              onClick={onClose}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl text-zinc-900 dark:text-white space-y-4 relative z-10 transition-colors"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 flex items-center justify-center">
                      <div className="w-full h-full bg-white dark:bg-zinc-950 rounded-[14px] flex items-center justify-center">
                        <Radio className="w-4 h-4 text-cyan-500 dark:text-cyan-400 animate-pulse" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                        {isArabic ? 'إنشاء حجرة مزاج مؤقتة (24 ساعة)' : 'Create Ephemeral Mood Pod'}
                      </h3>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {isArabic ? 'غرفة صوت ودردشة تفاعلية تنتهي تلقائياً بعد 24 ساعة' : '24h real-time room with ambient sound & live reactions'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full bg-zinc-100 dark:bg-zinc-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {error && (
                  <div className="p-3 rounded-2xl bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Room Title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      {isArabic ? 'عنوان الحجرة / موضوع النقاش' : 'Room Title & Topic'} <span className="text-fuchsia-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={isArabic ? 'مثال: سهرة برمجة وتصميم مع موسيقى هادئة 🎧' : 'e.g. Late Night Coding & Synthwave Chill 🎧'}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 rounded-2xl text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Mood Emoji Picker */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
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
                              ? 'bg-cyan-500/20 border-cyan-500 scale-110 shadow-md shadow-cyan-500/20'
                              : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Theme Picker */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
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
                              ? 'ring-2 ring-cyan-500 border-cyan-500 shadow-md'
                              : 'opacity-85 hover:opacity-100'
                          }`}
                        >
                          <div>
                            <div className={`text-xs font-bold ${t.textColor}`}>
                              {isArabic ? t.nameAr : t.name}
                            </div>
                            <div className="text-[10px] text-zinc-600 dark:text-zinc-400">
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

                  {/* Privacy Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      {isArabic ? 'خصوصية الحجرة' : 'Room Privacy'}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIsPrivate(false)}
                        className={`p-3 rounded-2xl border text-left rtl:text-right transition-all flex items-center gap-2.5 ${
                          !isPrivate
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/40 shadow-sm'
                            : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <Globe className="w-4 h-4 shrink-0 text-emerald-500" />
                        <div>
                          <div className="text-xs font-bold">{isArabic ? 'عامة 🌐' : 'Public 🌐'}</div>
                          <div className="text-[10px] opacity-80">{isArabic ? 'مفتوحة للجميع في المستكشف' : 'Open to everyone'}</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsPrivate(true)}
                        className={`p-3 rounded-2xl border text-left rtl:text-right transition-all flex items-center gap-2.5 ${
                          isPrivate
                            ? 'bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/40 shadow-sm'
                            : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <Lock className="w-4 h-4 shrink-0 text-purple-500" />
                        <div>
                          <div className="text-xs font-bold">{isArabic ? 'خاصة 🔒' : 'Private 🔒'}</div>
                          <div className="text-[10px] opacity-80">{isArabic ? 'بالدعوات وكود الدخول فقط' : 'Invites & code only'}</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Host Moderation & Participant Permissions */}
                  <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/80 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-white">
                      <Shield className="w-3.5 h-3.5 text-cyan-500" />
                      <span>{isArabic ? 'صلاحيات الحضور وإعدادات الموديريشن' : 'Participant & Host Permissions'}</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <label className="flex items-center justify-between cursor-pointer p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                        <span className="text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                          <Palette className="w-3.5 h-3.5 text-fuchsia-500" />
                          <span>{isArabic ? 'السماح للحضور بتغيير الثيم وخلفية الغرفة' : 'Allow participants to change visual theme'}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={allowParticipantsChangeTheme}
                          onChange={(e) => setAllowParticipantsChangeTheme(e.target.checked)}
                          className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                        />
                      </label>

                      <label className="flex items-center justify-between cursor-pointer p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                        <span className="text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                          <Music className="w-3.5 h-3.5 text-cyan-500" />
                          <span>{isArabic ? 'السماح للحضور بتشغيل ومشاركة موسيقى الخلفية (DJ)' : 'Allow participants to DJ background music'}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={allowParticipantsPlayBgMusic}
                          onChange={(e) => setAllowParticipantsPlayBgMusic(e.target.checked)}
                          className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                        />
                      </label>

                      <label className="flex items-center justify-between cursor-pointer p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                        <span className="text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                          <Mic className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{isArabic ? 'مسرح مايك مفتوح (أو يتطلب رفع اليد والموافقة)' : 'Open mic stage (vs. Hand-raise approval)'}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={allowOpenMic}
                          onChange={(e) => setAllowOpenMic(e.target.checked)}
                          className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Expiration Banner */}
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-950/80 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-center gap-2.5 text-xs text-zinc-600 dark:text-zinc-400">
                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
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
                      className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors"
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
