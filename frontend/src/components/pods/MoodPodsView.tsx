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
  Sparkles,
  Users,
  Volume2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, getMediaUrl } from '../../services/apiClient';
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
        return 'from-cyan-50 via-white to-fuchsia-50/50 dark:from-cyan-950/60 dark:via-zinc-900 dark:to-fuchsia-950/40 border-cyan-300/80 dark:border-cyan-500/40 hover:border-cyan-500 dark:hover:border-cyan-400 text-zinc-900 dark:text-white shadow-cyan-500/5';
      case 'lofi-chill':
        return 'from-amber-50 via-white to-orange-50/50 dark:from-amber-950/60 dark:via-zinc-900 dark:to-stone-950/60 border-amber-300/80 dark:border-amber-500/40 hover:border-amber-500 dark:hover:border-amber-400 text-zinc-900 dark:text-white shadow-amber-500/5';
      case 'rain-forest':
        return 'from-emerald-50 via-white to-teal-50/50 dark:from-emerald-950/60 dark:via-zinc-900 dark:to-teal-950/40 border-emerald-300/80 dark:border-emerald-500/40 hover:border-emerald-500 dark:hover:border-emerald-400 text-zinc-900 dark:text-white shadow-emerald-500/5';
      case 'neon-amber':
        return 'from-rose-50 via-white to-amber-50/50 dark:from-rose-950/60 dark:via-zinc-900 dark:to-amber-950/40 border-rose-300/80 dark:border-rose-500/40 hover:border-rose-500 dark:hover:border-rose-400 text-zinc-900 dark:text-white shadow-rose-500/5';
      default:
        return 'from-purple-50 via-white to-indigo-50/50 dark:from-purple-950/60 dark:via-zinc-900 dark:to-indigo-950/40 border-purple-300/80 dark:border-purple-500/40 hover:border-purple-500 dark:hover:border-purple-400 text-zinc-900 dark:text-white shadow-purple-500/5';
    }
  };

  // If a pod room is currently active, show the room view!
  if (selectedPod) {
    return (
      <div className="space-y-4">
        {/* Quick Pod Switcher Bar */}
        {pods.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setActivePodId(null)}
              className="px-3 py-1.5 rounded-2xl text-xs font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white shrink-0 transition-colors shadow-sm"
            >
              {isArabic ? '← جميع الحجرات' : '← All Pods'}
            </button>
            {pods.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePodId(p.id)}
                className={`px-3 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 border transition-all shrink-0 shadow-sm ${
                  activePodId === p.id
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-700 dark:text-cyan-300 shadow-md'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <span>{p.moodEmoji}</span>
                <span className="truncate max-w-[120px]">{p.title}</span>
              </button>
            ))}
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="p-1.5 rounded-xl bg-cyan-600/10 dark:bg-cyan-600/20 border border-cyan-500/40 text-cyan-600 dark:text-cyan-300 hover:bg-cyan-600/20 dark:hover:bg-cyan-600/30 shrink-0"
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

  // Otherwise, show the Pods Explorer Grid!
  return (
    <div className="space-y-5 text-zinc-900 dark:text-white">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 flex items-center justify-center shadow-lg">
            <div className="w-full h-full bg-white dark:bg-zinc-950 rounded-[14px] flex items-center justify-center">
              <Radio className="w-4 h-4 text-cyan-500 dark:text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <h2 className="font-black text-base sm:text-lg tracking-tight text-zinc-900 dark:text-white">
              {isArabic ? 'حجرات المزاج اللحظية (Mood Pods)' : 'Ephemeral Mood Pods'}
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {isArabic ? 'غرف صوت ومحادثة مؤقتة تنتهي بعد 24 ساعة مع مؤثرات محيطية' : '24h real-time rooms with ambient soundscapes & live reaction bursts'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsJoinCodeModalOpen(true)}
            className="px-3.5 py-2.5 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <Key className="w-3.5 h-3.5 text-purple-500" />
            <span>{isArabic ? 'دخول بكود 🔑' : 'Join with Code 🔑'}</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-xl shadow-cyan-600/25 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{isArabic ? 'إنشاء حجرة جديدة' : 'Launch Mood Pod'}</span>
          </button>
        </div>
      </div>

      {/* Pods Grid */}
      {pods.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center space-y-4 border border-zinc-200 dark:border-zinc-800/80">
          <div className="w-16 h-16 rounded-3xl bg-cyan-100 dark:bg-cyan-950/60 border border-cyan-300 dark:border-cyan-800/60 flex items-center justify-center mx-auto text-3xl">
            🎧
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              {isArabic ? 'لا توجد حجرات نشطة حالياً' : 'No Active Mood Pods'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
              {isArabic
                ? 'كن أول من ينشئ حجرة مزاج مؤقتة لجمع المبدعين حول موضوع أو مقطوعة صوتية هادئة!'
                : 'Start the first ephemeral room to gather creators around a mood, topic, or lo-fi audio session!'}
            </p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-5 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs sm:text-sm rounded-2xl transition-all shadow-lg"
          >
            {isArabic ? 'إطلاق أول حجرة الآن 🚀' : 'Launch First Mood Pod 🚀'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {pods.map((pod) => (
            <motion.div
              key={pod.id}
              whileHover={{ y: -3 }}
              onClick={() => setActivePodId(pod.id)}
              className={`p-6 sm:p-7 rounded-3xl border bg-gradient-to-br ${getThemeCardStyle(
                pod.backgroundTheme
              )} shadow-lg cursor-pointer transition-all space-y-4.5 relative overflow-hidden group`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <span className="text-3xl p-3.5 bg-white dark:bg-zinc-950/80 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-inner shrink-0 group-hover:scale-110 transition-transform">
                    {pod.moodEmoji}
                  </span>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-950 dark:group-hover:text-white leading-snug line-clamp-1">
                      {pod.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      <img
                        src={pod.hostAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${pod.hostUsername}`}
                        alt={pod.hostUsername}
                        className="w-5 h-5 rounded-full border border-zinc-300 dark:border-zinc-700 object-cover"
                      />
                      <span className="text-zinc-700 dark:text-zinc-300 font-medium">@{pod.hostUsername}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {pod.isPrivate && (
                    <div className="flex items-center gap-1 px-2.5 py-1 bg-purple-500/15 text-purple-700 dark:text-purple-300 rounded-full border border-purple-500/30 text-[10px] font-black uppercase">
                      <Lock className="w-3 h-3 text-purple-500" />
                      <span>{isArabic ? 'خاصة' : 'Private'}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 px-3 py-1 bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 rounded-full border border-cyan-500/30 text-[10px] font-black uppercase">
                    <Radio className="w-3 h-3 text-cyan-500 dark:text-cyan-400 animate-pulse" />
                    <span>LIVE</span>
                  </div>
                </div>
              </div>

              {/* Recent Message Snippet Preview */}
              {pod.recentMessages.length > 0 ? (
                <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800/80 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 space-y-1 shadow-sm">
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span className="font-semibold">{pod.recentMessages[pod.recentMessages.length - 1].senderDisplayName || pod.recentMessages[pod.recentMessages.length - 1].senderUsername}:</span>
                    <MessageSquare className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600" />
                  </div>
                  <p className="line-clamp-1 italic text-zinc-800 dark:text-zinc-200">
                    "{pod.recentMessages[pod.recentMessages.length - 1].text}"
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-white/50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800/50 text-xs text-zinc-500 italic">
                  {isArabic ? 'الحجرة هادئة وجاهزة للدردشة والموسيقى...' : 'Room is quiet and ready for chat & lo-fi vibes...'}
                </div>
              )}

              {/* Bottom Meta & Join Button */}
              <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800/60 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                <div className="flex items-center gap-3.5">
                  <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 font-bold">
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
                  className="px-4 py-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 group-hover:bg-cyan-600 group-hover:text-white border border-zinc-200 dark:border-zinc-800 group-hover:border-cyan-500 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
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
                  className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      <Key className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                        {isArabic ? 'الانضمام لحجرة خاصة بكود' : 'Join Private Pod with Code'}
                      </h3>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
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
                      className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-center font-mono font-bold text-sm uppercase focus:outline-none focus:border-purple-500"
                    />

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsJoinCodeModalOpen(false)}
                        className="px-3.5 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold"
                      >
                        {isArabic ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        type="submit"
                        disabled={isJoiningWithCode || !joinCodeInput.trim()}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-all shadow-md active:scale-95"
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
