import React, { useState } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { MoodPodDto } from '../../types/api';
import { MoodPodRoom } from './MoodPodRoom';
import { CreateMoodPodModal } from './CreateMoodPodModal';
import {
  Clock,
  Key,
  Lock,
  MessageSquare,
  Plus,
  Radio,
  Users,
  Volume2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../services/apiClient';
import { createPortal } from 'react-dom';

interface MoodPodsViewProps {
  pods: MoodPodDto[];
  onRefreshPods: () => void;
  selectedPodId?: string | null;
  onSelectPodId?: (id: string | null) => void;
}

export const MoodPodsView: React.FC<MoodPodsViewProps> = ({
  pods = [],
  onRefreshPods,
  selectedPodId: externalSelectedPodId,
  onSelectPodId: setExternalSelectedPodId,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  const [internalSelectedPodId, setInternalSelectedPodId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinCodeModalOpen, setIsJoinCodeModalOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoiningWithCode, setIsJoiningWithCode] = useState(false);
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null);

  const activePodId = externalSelectedPodId !== undefined ? externalSelectedPodId : internalSelectedPodId;
  const setActivePodId = (id: string | null) => {
    if (setExternalSelectedPodId) {
      setExternalSelectedPodId(id);
    } else {
      setInternalSelectedPodId(id);
    }
  };

  const selectedPod = activePodId ? pods.find((p) => p.id === activePodId) : null;

  const handlePodCreated = (newPod: MoodPodDto) => {
    onRefreshPods();
    setActivePodId(newPod.id);
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;

    setIsJoiningWithCode(true);
    setJoinCodeError(null);
    try {
      const unlocked = await api.joinPodByCode(joinCodeInput.trim());
      onRefreshPods();
      setActivePodId(unlocked.id);
      setIsJoinCodeModalOpen(false);
      setJoinCodeInput('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid room code';
      setJoinCodeError(msg);
    } finally {
      setIsJoiningWithCode(false);
    }
  };

  const getThemeCardStyle = (theme?: string) => {
    switch (theme) {
      case 'cyber-neon':
        return 'from-sky-50/90 via-white to-slate-50/80 border-sky-200/90 hover:border-sky-300 dark:from-[#0e1726] dark:via-[#0c1420] dark:to-[#0b0f17] dark:border-sky-500/30 dark:hover:border-sky-500/50 text-slate-900 dark:text-white';
      case 'lofi-chill':
        return 'from-amber-50/90 via-white to-stone-50/80 border-amber-200/90 hover:border-amber-300 dark:from-[#1a1512] dark:via-[#14100e] dark:to-[#0b0f17] dark:border-amber-500/30 dark:hover:border-amber-500/50 text-slate-900 dark:text-white';
      case 'rain-forest':
        return 'from-emerald-50/90 via-white to-teal-50/80 border-emerald-200/90 hover:border-emerald-300 dark:from-[#0d1a16] dark:via-[#0b1411] dark:to-[#0b0f17] dark:border-emerald-500/30 dark:hover:border-emerald-500/50 text-slate-900 dark:text-white';
      case 'neon-amber':
        return 'from-rose-50/90 via-white to-amber-50/80 border-rose-200/90 hover:border-rose-300 dark:from-[#1c1116] dark:via-[#160e12] dark:to-[#0b0f17] dark:border-rose-500/30 dark:hover:border-rose-500/50 text-slate-900 dark:text-white';
      default:
        return 'from-indigo-50/90 via-white to-slate-50/80 border-indigo-200/90 hover:border-indigo-300 dark:from-[#131b28] dark:via-[#0f1724] dark:to-[#0b0f17] dark:border-indigo-500/30 dark:hover:border-indigo-500/50 text-slate-900 dark:text-white';
    }
  };

  if (selectedPod) {
    return (
      <div className="space-y-4">
        {/* Quick Pod Switcher Bar */}
        {pods.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setActivePodId(null)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 shrink-0 transition-colors shadow-sm"
            >
              {isArabic ? '← جميع الحجرات' : '← All Pods'}
            </button>
            {pods.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePodId(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors shrink-0 shadow-sm ${
                  activePodId === p.id
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{p.moodEmoji}</span>
                <span className="truncate max-w-[120px]">{p.title}</span>
              </button>
            ))}
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="p-1.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 shrink-0 shadow-sm"
              title="Create Pod"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}

        <MoodPodRoom
          key={selectedPod.id}
          initialPod={selectedPod}
          onBack={() => setActivePodId(null)}
        />

        <CreateMoodPodModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onPodCreated={handlePodCreated}
        />
      </div>
    );
  }

  // Pods Explorer Grid
  return (
    <div className="space-y-5 text-slate-900 dark:text-white">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-500 to-sky-500 p-0.5 flex items-center justify-center shadow-sm">
            <div className="w-full h-full bg-white dark:bg-[#0e1520] rounded-[14px] flex items-center justify-center">
              <Radio className="w-4 h-4 text-indigo-500 dark:text-indigo-400 animate-pulse" />
            </div>
          </div>
          <div>
            <h2 className="font-black text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
              {isArabic ? 'حجرات المزاج اللحظية (Mood Pods)' : 'Ephemeral Mood Pods'}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isArabic ? 'غرف صوت ومحادثة مؤقتة تنتهي بعد 24 ساعة مع مؤثرات محيطية' : '24h real-time rooms with ambient soundscapes & live reaction bursts'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsJoinCodeModalOpen(true)}
            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition-colors"
          >
            <Key className="w-3.5 h-3.5 text-indigo-500" />
            <span>{isArabic ? 'دخول بكود 🔑' : 'Join with Code 🔑'}</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{isArabic ? 'إنشاء حجرة جديدة' : 'Launch Mood Pod'}</span>
          </button>
        </div>
      </div>

      {/* Pods Grid */}
      {pods.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center space-y-4 border border-slate-200 dark:border-slate-800/80 shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center mx-auto text-3xl">
            🎧
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {isArabic ? 'لا توجد حجرات نشطة حالياً' : 'No Active Mood Pods'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {isArabic
                ? 'كن أول من ينشئ حجرة مزاج مؤقتة لجمع المبدعين حول موضوع أو مقطوعة صوتية هادئة!'
                : 'Start the first ephemeral room to gather creators around a mood, topic, or lo-fi audio session!'}
            </p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors shadow-sm"
          >
            {isArabic ? 'إطلاق أول حجرة الآن 🚀' : 'Launch First Mood Pod 🚀'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {pods.map((pod) => (
            <motion.div
              key={pod.id}
              whileHover={{ y: -2 }}
              onClick={() => setActivePodId(pod.id)}
              className={`p-6 sm:p-7 rounded-3xl border bg-gradient-to-br ${getThemeCardStyle(
                pod.backgroundTheme
              )} shadow-sm cursor-pointer transition-all space-y-4 relative overflow-hidden group`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <span className="text-3xl p-3 bg-white dark:bg-[#131b28] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                    {pod.moodEmoji}
                  </span>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-snug line-clamp-1">
                      {pod.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <img
                        src={pod.hostAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${pod.hostUsername}`}
                        alt={pod.hostUsername}
                        className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700 object-cover"
                      />
                      <span className="text-slate-700 dark:text-slate-300 font-medium">@{pod.hostUsername}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {pod.isPrivate && (
                    <div className="flex items-center gap-1 px-2.5 py-1 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-500/30 text-[10px] font-black uppercase">
                      <Lock className="w-3 h-3 text-indigo-500" />
                      <span>{isArabic ? 'خاصة' : 'Private'}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 px-3 py-1 bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-300 rounded-full border border-sky-500/30 text-[10px] font-black uppercase">
                    <Radio className="w-3 h-3 text-sky-500 animate-pulse" />
                    <span>LIVE</span>
                  </div>
                </div>
              </div>

              {/* Recent Message Snippet Preview */}
              {pod.recentMessages.length > 0 ? (
                <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-[#0b0f17]/70 border border-slate-200/80 dark:border-slate-800 text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-1 shadow-sm">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{pod.recentMessages[pod.recentMessages.length - 1].senderDisplayName || pod.recentMessages[pod.recentMessages.length - 1].senderUsername}:</span>
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <p className="line-clamp-1 italic text-slate-800 dark:text-slate-200">
                    "{pod.recentMessages[pod.recentMessages.length - 1].text}"
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-white/60 dark:bg-[#0b0f17]/50 border border-slate-200/80 dark:border-slate-800/60 text-xs text-slate-500 dark:text-slate-400 italic">
                  {isArabic ? 'الحجرة هادئة وجاهزة للدردشة والموسيقى...' : 'Room is quiet and ready for chat & lo-fi vibes...'}
                </div>
              )}

              {/* Bottom Meta & Join Button */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800/80 text-xs sm:text-sm text-slate-500">
                <div className="flex items-center gap-3.5">
                  <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-bold">
                    <Users className="w-4 h-4" />
                    <span>{pod.activeParticipantCount}</span>
                  </span>

                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-mono">
                    <Clock className="w-4 h-4" />
                    <span>{pod.timeRemaining ? `${String(pod.timeRemaining).split('.')[0]}` : '24h'}</span>
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePodId(pod.id);
                  }}
                  className="px-3.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>{isArabic ? 'دخول الحجرة' : 'Enter Pod'}</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Pod Modal */}
      <CreateMoodPodModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onPodCreated={handlePodCreated}
      />

      {/* Join Private Pod by Code Modal */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isJoinCodeModalOpen && (
              <div
                className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
                onClick={() => setIsJoinCodeModalOpen(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-sm bg-white dark:bg-[#131b28] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-4"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <Key className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        {isArabic ? 'الانضمام لحجرة خاصة بكود' : 'Join Private Pod with Code'}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {isArabic ? 'أدخل كود الدعوة المكون من 8 أحرف' : 'Enter the 8-character invite code'}
                      </p>
                    </div>
                  </div>

                  {joinCodeError && (
                    <div className="p-3 bg-rose-500/15 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-500/30 text-xs">
                      {joinCodeError}
                    </div>
                  )}

                  <form onSubmit={handleJoinByCode} className="space-y-3">
                    <input
                      type="text"
                      placeholder="e.g. POD-ABCD or 8-digit code"
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-700 rounded-xl text-center font-mono font-bold text-sm uppercase focus:outline-none focus:border-indigo-500"
                    />

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsJoinCodeModalOpen(false)}
                        className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
                      >
                        {isArabic ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        type="submit"
                        disabled={isJoiningWithCode || !joinCodeInput.trim()}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors shadow-sm active:scale-95"
                      >
                        {isJoiningWithCode ? (isArabic ? 'جاري التحقق...' : 'Verifying...') : (isArabic ? 'دخول 🚀' : 'Join 🚀')}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};
