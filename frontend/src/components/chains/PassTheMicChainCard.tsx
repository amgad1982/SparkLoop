import React, { useState } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { ChainDto, ChainStepDto } from '../../types/api';
import { getMediaUrl } from '../../services/apiClient';
import { useCentrifugo } from '../../hooks/useCentrifugo';
import { TurnInputDrawer } from './TurnInputDrawer';
import { CheckCircle2, GitBranch, Lock, Mic, Play, Sparkles, UserCheck, Volume2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';

interface PassTheMicChainCardProps {
  initialChain: ChainDto;
  onRefresh?: () => void;
}

export const PassTheMicChainCard: React.FC<PassTheMicChainCardProps> = ({
  initialChain,
  onRefresh,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';
  const { currentPersona } = useAuthStore();

  const [chain, setChain] = useState<ChainDto>(initialChain);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const activeAudioRef = React.useRef<HTMLAudioElement | null>(null);

  // Real-Time Centrifugo Subscription for this specific chain
  useCentrifugo(`chain:${chain.id}`, (data) => {
    if (data.type === 'STEP_ADDED' && data.step) {
      const newStep = data.step as ChainStepDto;
      setChain((prev) => {
        if (prev.steps.some((s) => s.id === newStep.id)) return prev;
        const updatedSteps = [...prev.steps, newStep];
        return {
          ...prev,
          currentStepCount: updatedSteps.length,
          rowVersion: prev.rowVersion + 1,
          steps: updatedSteps,
        };
      });
    } else if (data.type === 'CHAIN_COMPLETED') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
      setChain((prev) => ({
        ...prev,
        status: 'Completed',
      }));
    }
  });

  const lastStep = chain.steps[chain.steps.length - 1];
  const isCompleted = chain.status === 'Completed' || chain.currentStepCount >= chain.maxSteps;
  const isLastAuthor = lastStep?.authorId === currentPersona.id;
  const canSubmit = !isCompleted && !isLastAuthor;

  const progressPercent = Math.min(100, Math.round((chain.currentStepCount / chain.maxSteps) * 100));

  const playAudio = (stepId: string, audioUrl?: string) => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }

    if (playingAudioId === stepId) {
      setPlayingAudioId(null);
      return;
    }

    if (!audioUrl) return;

    setPlayingAudioId(stepId);
    const audio = new Audio(getMediaUrl(audioUrl));
    activeAudioRef.current = audio;

    audio.play().catch((err) => {
      console.error('Audio playback error:', err);
      setPlayingAudioId(null);
      activeAudioRef.current = null;
    });

    audio.onended = () => {
      setPlayingAudioId(null);
      activeAudioRef.current = null;
    };

    audio.onerror = () => {
      setPlayingAudioId(null);
      activeAudioRef.current = null;
    };
  };

  return (
    <>
      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4.5 border border-zinc-800/80 text-white relative overflow-hidden transition-all hover:border-zinc-700/80 shadow-lg">
        {/* Top Header & Theme */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {chain.theme}
              </span>
              <span className="text-xs text-zinc-400 font-medium">
                {isArabic ? `أنشأها @${chain.createdByUsername}` : `by @${chain.createdByUsername}`}
              </span>
            </div>
            <h3 className="font-bold text-base sm:text-lg tracking-tight text-zinc-100">{chain.title}</h3>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold shrink-0">
            <GitBranch className="w-3.5 h-3.5 text-fuchsia-400" />
            <span className="text-zinc-200">
              {chain.currentStepCount}/{chain.maxSteps}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.8 }}
              className={`h-full rounded-full ${
                isCompleted
                  ? 'bg-emerald-400'
                  : 'bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-400'
              }`}
            />
          </div>
          <div className="flex justify-between text-[11px] text-zinc-400 font-medium">
            <span>{isArabic ? 'تقدم السلسلة' : 'Chain Progress'}</span>
            <span>
              {isCompleted
                ? isArabic
                  ? 'مكتملة ومقفلة 🏆'
                  : 'Completed 🏆'
                : isArabic
                ? `متبقي ${chain.maxSteps - chain.currentStepCount} أدوار`
                : `${chain.maxSteps - chain.currentStepCount} turns left`}
            </span>
          </div>
        </div>

        {/* Steps Stream / Bubbles */}
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1 no-scrollbar pt-1">
          {chain.steps.map((step) => {
            const isStepAuthorMe = step.authorId === currentPersona.id;
            const isAudioPlaying = playingAudioId === step.id;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3.5 sm:p-4 rounded-2xl border text-xs sm:text-sm space-y-2 ${
                  isStepAuthorMe
                    ? 'bg-fuchsia-950/30 border-fuchsia-500/30 ml-4 rtl:ml-0 rtl:mr-4'
                    : 'bg-zinc-900/60 border-zinc-800/80 mr-4 rtl:mr-0 rtl:ml-4'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={step.authorAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${step.authorUsername}`}
                      alt={step.authorUsername}
                      className="w-6 h-6 rounded-full border border-zinc-700 object-cover"
                    />
                    <span className="font-semibold text-zinc-200">
                      {step.authorDisplayName || step.authorUsername}
                    </span>
                    <span className="text-[10px] font-bold text-fuchsia-400 px-1.5 py-0.5 rounded bg-fuchsia-950/60">
                      #{step.stepNumber}
                    </span>
                  </div>
                  {step.audioUrl && (
                    <button
                      onClick={() => playAudio(step.id, step.audioUrl)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                        isAudioPlaying
                          ? 'bg-cyan-500 text-black border-cyan-400 shadow-lg shadow-cyan-500/25'
                          : 'bg-zinc-800/90 text-cyan-300 border-cyan-500/30 hover:bg-zinc-750'
                      }`}
                    >
                      <Volume2 className={`w-3 h-3 ${isAudioPlaying ? 'animate-bounce text-black' : 'text-cyan-400'}`} />
                      <span>
                        {isAudioPlaying
                          ? isArabic
                            ? 'تشغيل...'
                            : 'Playing...'
                          : `${step.durationSeconds ? `${step.durationSeconds}s` : '15s'} Audio`}
                      </span>
                    </button>
                  )}
                </div>

                <p className="text-zinc-200 leading-relaxed font-medium pl-8 rtl:pl-0 rtl:pr-8">
                  {step.content}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Turn Action / Invariant Status Bar */}
        <div className="pt-3.5 border-t border-zinc-800/70">
          {isCompleted ? (
            <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{isArabic ? 'اكتملت القصة التفاعلية وتم تتويج المساهمين! 🎉' : 'Story Completed & Sealed! 🎉'}</span>
            </div>
          ) : isLastAuthor ? (
            <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 flex items-center justify-between text-xs sm:text-sm text-amber-300">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <span className="font-semibold">
                  {isArabic
                    ? 'كتبت الدور السابق! مرر المايك لشخص آخر'
                    : 'Turn locked: Cannot submit consecutively!'}
                </span>
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded bg-amber-500/20 font-bold">
                {isArabic ? 'دور كاتب آخر' : 'Wait for next'}
              </span>
            </div>
          ) : (
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-purple-600 to-cyan-500 hover:from-fuchsia-500 hover:to-cyan-400 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 text-white active:scale-98 transition-all spark-glow shadow-lg"
            >
              <Mic className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>{isArabic ? 'دورك الآن! مرر المايك وأكمل القصة 🎤' : 'Your Turn! Take The Mic & Add Step 🎤'}</span>
            </button>
          )}
        </div>
      </div>

      <TurnInputDrawer
        chain={chain}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onStepSubmitted={(updated) => {
          setChain(updated);
          if (onRefresh) onRefresh();
        }}
      />
    </>
  );
};
