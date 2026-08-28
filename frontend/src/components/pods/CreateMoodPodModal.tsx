import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useThemeStore } from '../../stores/useThemeStore';
import { api } from '../../services/apiClient';
import { MoodPodDto } from '../../types/api';
import { Clock, Globe, Lock, Mic, Music, Palette, Radio, Shield, Sparkles, X, Infinity as InfinityIcon } from 'lucide-react';
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
    name: 'Nordic Indigo',
    nameAr: 'نورديك إنديجو',
    gradient: 'from-indigo-50 via-white to-slate-50/80 border-indigo-200/90 dark:from-[#131b28] dark:via-[#0f1724] dark:to-[#0b0f17] dark:border-indigo-500/30',
    accent: 'text-indigo-600 dark:text-indigo-400',
    textColor: 'text-slate-900 dark:text-white',
  },
  {
    id: 'cyber-neon',
    name: 'Deep Slate',
    nameAr: 'رمادي عميق',
    gradient: 'from-sky-50 via-white to-slate-50/80 border-sky-200/90 dark:from-[#0e1726] dark:via-[#0c1420] dark:to-[#0b0f17] dark:border-sky-500/30',
    accent: 'text-sky-600 dark:text-sky-400',
    textColor: 'text-slate-900 dark:text-white',
  },
  {
    id: 'lofi-chill',
    name: 'Warm Amber',
    nameAr: 'عنبر دافئ',
    gradient: 'from-amber-50 via-white to-stone-50/80 border-amber-200/90 dark:from-[#1a1512] dark:via-[#14100e] dark:to-[#0b0f17] dark:border-amber-500/30',
    accent: 'text-amber-600 dark:text-amber-400',
    textColor: 'text-slate-900 dark:text-white',
  },
  {
    id: 'rain-forest',
    name: 'Nordic Forest',
    nameAr: 'غابة شمالية',
    gradient: 'from-emerald-50 via-white to-teal-50/80 border-emerald-200/90 dark:from-[#0d1a16] dark:via-[#0b1411] dark:to-[#0b0f17] dark:border-emerald-500/30',
    accent: 'text-emerald-600 dark:text-emerald-400',
    textColor: 'text-slate-900 dark:text-white',
  },
  {
    id: 'neon-amber',
    name: 'Sunset Rose',
    nameAr: 'غروب هادئ',
    gradient: 'from-rose-50 via-white to-amber-50/80 border-rose-200/90 dark:from-[#1c1116] dark:via-[#160e12] dark:to-[#0b0f17] dark:border-rose-500/30',
    accent: 'text-rose-600 dark:text-rose-400',
    textColor: 'text-slate-900 dark:text-white',
  },
];

const DURATION_OPTIONS = [
  { value: 1, labelEn: '1 Hour', labelAr: 'ساعة واحدة' },
  { value: 6, labelEn: '6 Hours', labelAr: '6 ساعات' },
  { value: 12, labelEn: '12 Hours', labelAr: '12 ساعة' },
  { value: 24, labelEn: '24 Hours (1 Day)', labelAr: '24 ساعة (يوم)' },
  { value: 72, labelEn: '3 Days', labelAr: '3 أيام' },
  { value: 168, labelEn: '7 Days', labelAr: '7 أيام' },
  { value: -1, labelEn: 'Permanent (Never) ♾️', labelAr: 'دائمة بلا إغلاق ♾️' },
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
  const [durationHours, setDurationHours] = useState<number>(24);
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
        durationHours,
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
              className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-hidden"
              onClick={onClose}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg max-h-[90vh] sm:max-h-[86vh] flex flex-col bg-white dark:bg-[#131b28] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl text-slate-900 dark:text-white relative z-10 transition-colors overflow-hidden"
              >
                {/* 1. Modal Header (Fixed at top) */}
                <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white/95 dark:bg-[#131b28]/95 backdrop-blur-md">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-2xl bg-indigo-600 p-0.5 flex items-center justify-center shrink-0 shadow-sm">
                      <Radio className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                        {isArabic ? 'إطلاق حجرة مزاج صوتية' : 'Launch Live Mood Pod'}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {isArabic ? 'حجرة تفاعلية بصوت لايف وموسيقى ومؤثرات' : 'Real-time voice stage with ambient synth & DJ soundboard'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 2. Scrollable Form Content (Flex-1) */}
                <form id="create-pod-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
                  {error && (
                    <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                      {error}
                    </div>
                  )}

                  {/* Room Title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isArabic ? 'عنوان الحجرة / موضوع النقاش' : 'Room Title & Topic'} <span className="text-indigo-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={isArabic ? 'مثال: سهرة برمجة وتصميم مع موسيقى هادئة 🎧' : 'e.g. Late Night Coding & Synthwave Chill 🎧'}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-700/80 focus:border-indigo-500 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Mood Emoji Picker */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isArabic ? 'أيقونة المزاج' : 'Mood Emoji'}
                    </label>
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                      {EMOJI_PRESETS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setSelectedEmoji(emoji)}
                          className={`text-xl p-2.5 rounded-2xl border transition-all shrink-0 cursor-pointer ${
                            selectedEmoji === emoji
                              ? 'bg-indigo-500/20 border-indigo-500 scale-105 shadow-sm'
                              : 'bg-slate-50 dark:bg-[#0b0f17] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Theme Picker */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isArabic ? 'السمة البصرية والصوتية' : 'Ambient Visual & Sound Theme'}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {THEMES.map((theme) => {
                        const isSelected = selectedTheme === theme.id;
                        return (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() => setSelectedTheme(theme.id)}
                            className={`p-2.5 rounded-2xl border text-left rtl:text-right transition-all flex flex-col justify-between h-20 relative overflow-hidden cursor-pointer ${
                              isSelected
                                ? 'border-indigo-500 ring-2 ring-indigo-500/40 shadow-sm'
                                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-90`} />
                            <div className="relative z-10 flex items-center justify-between w-full">
                              <span className={`text-[11px] font-extrabold ${theme.textColor}`}>
                                {isArabic ? theme.nameAr : theme.name}
                              </span>
                              {isSelected && (
                                <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              )}
                            </div>
                            <div className="relative z-10 flex items-center gap-1 text-[9px] text-slate-600 dark:text-slate-400">
                              <Palette className="w-3 h-3" />
                              <span>{isArabic ? 'موسيقى تفاعلية' : 'Synth ambient'}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Room Duration / Lifetime Selector */}
                  <div className="p-3.5 bg-slate-50 dark:bg-[#0b0f17] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>{isArabic ? 'مدة بقاء الحجرة' : 'Room Lifetime & Duration'}</span>
                      </div>
                      <span className="text-[10.5px] font-mono text-amber-600 dark:text-amber-400 font-bold">
                        {DURATION_OPTIONS.find((d) => d.value === durationHours)?.[isArabic ? 'labelAr' : 'labelEn']}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                      {DURATION_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setDurationHours(opt.value)}
                          className={`py-2 px-1.5 rounded-xl text-[10.5px] font-bold border transition-colors text-center cursor-pointer ${
                            durationHours === opt.value
                              ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                          }`}
                        >
                          {isArabic ? opt.labelAr : opt.labelEn}
                        </button>
                      ))}
                    </div>

                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-0.5">
                      {durationHours === -1 ? (
                        <>
                          <InfinityIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>{isArabic ? 'ستظل هذه الحجرة نشطة ومفتوحة دائماً دون إغلاق تلقائي.' : 'This room will remain open permanently with no auto-expiration.'}</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>
                            {isArabic
                              ? `ستُغلق الحجرة وتختفي تلقائياً بعد مرور ${DURATION_OPTIONS.find((d) => d.value === durationHours)?.labelAr}.`
                              : `This room will automatically close after ${DURATION_OPTIONS.find((d) => d.value === durationHours)?.labelEn}.`}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  {/* Privacy Selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isArabic ? 'خصوصية الحجرة' : 'Room Privacy'}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIsPrivate(false)}
                        className={`p-3 rounded-2xl border text-left rtl:text-right transition-colors flex items-center gap-2.5 cursor-pointer ${
                          !isPrivate
                            ? 'bg-indigo-500/10 border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/40 shadow-sm'
                            : 'bg-slate-50 dark:bg-[#0b0f17] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <Globe className="w-4 h-4 shrink-0 text-indigo-500" />
                        <div>
                          <div className="text-xs font-bold">{isArabic ? 'عامة 🌐' : 'Public 🌐'}</div>
                          <div className="text-[10px] opacity-80">{isArabic ? 'متاحة للجميع بالخلاصة' : 'Visible on feed'}</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsPrivate(true)}
                        className={`p-3 rounded-2xl border text-left rtl:text-right transition-colors flex items-center gap-2.5 cursor-pointer ${
                          isPrivate
                            ? 'bg-indigo-500/10 border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/40 shadow-sm'
                            : 'bg-slate-50 dark:bg-[#0b0f17] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <Lock className="w-4 h-4 shrink-0 text-indigo-500" />
                        <div>
                          <div className="text-xs font-bold">{isArabic ? 'خاصة 🔒' : 'Private 🔒'}</div>
                          <div className="text-[10px] opacity-80">{isArabic ? 'بالدعوات وكود الدخول' : 'Invite code only'}</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Host Moderation & Participant Permissions */}
                  <div className="p-3.5 bg-slate-50 dark:bg-[#0b0f17] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                      <Shield className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{isArabic ? 'صلاحيات الحضور والإدارة' : 'Participant & Host Permissions'}</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <label className="flex items-center justify-between cursor-pointer p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <span className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Palette className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{isArabic ? 'السماح للحضور بتغيير الثيم وخلفية الغرفة' : 'Allow participants to change visual theme'}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={allowParticipantsChangeTheme}
                          onChange={(e) => setAllowParticipantsChangeTheme(e.target.checked)}
                          className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                        />
                      </label>

                      <label className="flex items-center justify-between cursor-pointer p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <span className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Music className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{isArabic ? 'السماح للحضور بتشغيل ومشاركة موسيقى الخلفية (DJ)' : 'Allow participants to DJ background music'}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={allowParticipantsPlayBgMusic}
                          onChange={(e) => setAllowParticipantsPlayBgMusic(e.target.checked)}
                          className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                        />
                      </label>

                      <label className="flex items-center justify-between cursor-pointer p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <span className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Mic className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{isArabic ? 'مسرح مايك مفتوح (أو يتطلب رفع اليد والموافقة)' : 'Open mic stage (vs. Hand-raise approval)'}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={allowOpenMic}
                          onChange={(e) => setAllowOpenMic(e.target.checked)}
                          className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>
                </form>

                {/* 3. Sticky Footer Action Buttons (Always visible at bottom) */}
                <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#131b28]/95 backdrop-blur-md flex items-center justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    {isArabic ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    form="create-pod-form"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Radio className="w-4 h-4" />
                    <span>{isSubmitting ? (isArabic ? 'جاري الإنشاء...' : 'Creating...') : (isArabic ? 'إطلاق الحجرة الآن 🚀' : 'Launch Mood Pod 🚀')}</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )
    : null;
};
