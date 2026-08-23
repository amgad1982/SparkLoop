import React, { useState } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { MoodPodDto } from '../../types/api';
import { MoodPodRoom } from './MoodPodRoom';
import { CreateMoodPodModal } from './CreateMoodPodModal';
import {
  Clock,
  MessageSquare,
  Plus,
  Radio,
  Sparkles,
  Users,
  Volume2,
} from 'lucide-react';
import { motion } from 'framer-motion';

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

  const getThemeCardStyle = (theme?: string) => {
    switch (theme) {
      case 'cyber-neon':
        return 'from-cyan-950/60 via-zinc-900 to-fuchsia-950/40 border-cyan-500/40 hover:border-cyan-400';
      case 'lofi-chill':
        return 'from-amber-950/60 via-zinc-900 to-stone-950/60 border-amber-500/40 hover:border-amber-400';
      case 'rain-forest':
        return 'from-emerald-950/60 via-zinc-900 to-teal-950/40 border-emerald-500/40 hover:border-emerald-400';
      case 'neon-amber':
        return 'from-rose-950/60 via-zinc-900 to-amber-950/40 border-rose-500/40 hover:border-rose-400';
      default:
        return 'from-purple-950/60 via-zinc-900 to-indigo-950/40 border-purple-500/40 hover:border-purple-400';
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
              className="px-3 py-1.5 rounded-2xl text-xs font-bold bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white shrink-0 transition-colors"
            >
              {isArabic ? '← جميع الحجرات' : '← All Pods'}
            </button>
            {pods.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePodId(p.id)}
                className={`px-3 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 border transition-all shrink-0 ${
                  activePodId === p.id
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>{p.moodEmoji}</span>
                <span className="truncate max-w-[120px]">{p.title}</span>
              </button>
            ))}
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="p-1.5 rounded-xl bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-600/30 shrink-0"
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
    <div className="space-y-5 text-white">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 flex items-center justify-center shadow-lg">
            <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
              <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <h2 className="font-black text-base sm:text-lg tracking-tight">
              {isArabic ? 'حجرات المزاج اللحظية (Mood Pods)' : 'Ephemeral Mood Pods'}
            </h2>
            <p className="text-[11px] text-zinc-400">
              {isArabic ? 'غرف صوت ومحادثة مؤقتة تنتهي بعد 24 ساعة مع مؤثرات محيطية' : '24h real-time rooms with ambient soundscapes & live reaction bursts'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-xl shadow-cyan-600/25 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>{isArabic ? 'إنشاء حجرة جديدة' : 'Launch Mood Pod'}</span>
        </button>
      </div>

      {/* Pods Grid */}
      {pods.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center space-y-4 border border-zinc-800/80">
          <div className="w-16 h-16 rounded-3xl bg-cyan-950/60 border border-cyan-800/60 flex items-center justify-center mx-auto text-3xl">
            🎧
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-zinc-100">
              {isArabic ? 'لا توجد حجرات نشطة حالياً' : 'No Active Mood Pods'}
            </h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              {isArabic
                ? 'كن أول من ينشئ حجرة مزاج مؤقتة لجمع المبدعين حول موضوع أو مقطوعة صوتية هادئة!'
                : 'Start the first ephemeral room to gather creators around a mood, topic, or lo-fi audio session!'}
            </p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-2xl transition-all shadow-lg"
          >
            {isArabic ? 'إطلاق أول حجرة الآن 🚀' : 'Launch First Mood Pod 🚀'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pods.map((pod) => (
            <motion.div
              key={pod.id}
              whileHover={{ y: -3 }}
              onClick={() => setActivePodId(pod.id)}
              className={`p-5 rounded-3xl border bg-gradient-to-br ${getThemeCardStyle(
                pod.backgroundTheme
              )} shadow-xl cursor-pointer transition-all space-y-4 relative overflow-hidden group`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl p-3 bg-zinc-950/80 rounded-2xl border border-zinc-800 shadow-inner shrink-0 group-hover:scale-110 transition-transform">
                    {pod.moodEmoji}
                  </span>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-100 group-hover:text-white leading-snug line-clamp-1">
                      {pod.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
                      <img
                        src={pod.hostAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${pod.hostUsername}`}
                        alt={pod.hostUsername}
                        className="w-4 h-4 rounded-full border border-zinc-700 object-cover"
                      />
                      <span className="text-zinc-300">@{pod.hostUsername}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30 text-[10px] font-black uppercase shrink-0">
                  <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
                  <span>LIVE</span>
                </div>
              </div>

              {/* Recent Message Snippet Preview */}
              {pod.recentMessages.length > 0 ? (
                <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 text-xs text-zinc-300 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-zinc-500">
                    <span className="font-semibold">{pod.recentMessages[pod.recentMessages.length - 1].senderDisplayName || pod.recentMessages[pod.recentMessages.length - 1].senderUsername}:</span>
                    <MessageSquare className="w-3 h-3 text-zinc-600" />
                  </div>
                  <p className="line-clamp-1 italic text-zinc-300">
                    "{pod.recentMessages[pod.recentMessages.length - 1].text}"
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-zinc-950/40 border border-zinc-800/50 text-[11px] text-zinc-500 italic">
                  {isArabic ? 'الحجرة هادئة وجاهزة للدردشة والموسيقى...' : 'Room is quiet and ready for chat & lo-fi vibes...'}
                </div>
              )}

              {/* Bottom Meta & Join Button */}
              <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 text-xs text-zinc-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-cyan-400 font-bold">
                    <Users className="w-3.5 h-3.5" />
                    <span>{pod.activeParticipantCount}</span>
                  </span>

                  <span className="flex items-center gap-1 text-amber-400 font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{pod.timeRemaining ? `${String(pod.timeRemaining).split('.')[0]}` : '24h TTL'}</span>
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePodId(pod.id);
                  }}
                  className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 group-hover:bg-cyan-600 group-hover:text-white border border-zinc-800 group-hover:border-cyan-500 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-md"
                >
                  <Volume2 className="w-3.5 h-3.5" />
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
    </div>
  );
};
