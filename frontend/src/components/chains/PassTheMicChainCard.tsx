import React, { useState } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { ChainDto, ChainStepDto } from '../../types/api';
import { getMediaUrl } from '../../services/apiClient';
import { useCentrifugo } from '../../hooks/useCentrifugo';
import { TurnInputDrawer } from './TurnInputDrawer';
import { Tooltip } from '../ui/Tooltip';
import { CheckCircle2, GitBranch, Lock, Mic, Volume2 } from 'lucide-react';
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
      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4 border border-slate-200 dark:border-slate-800/80 text-slate-900 dark:text-white relative overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-sm">
        {/* Top Meta Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <GitBranch className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {chain.theme}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">
              {chain.currentStepCount} / {chain.maxSteps} {isArabic ? 'أدوار' : 'turns'}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                isCompleted
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
              }`}
            >
              {isCompleted ? (isArabic ? 'مكتملة' : 'Completed') : (isArabic ? 'نشطة' : 'Active')}
            </span>
          </div>
        </div>

        {/* Chain Title & Progress */}
        <div className="space-y-2">
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
            {chain.title}
          </h3>

          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
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
                    ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-500/30 ml-4 rtl:ml-0 rtl:mr-4'
                    : 'bg-slate-50 dark:bg-[#0b0f17]/60 border-slate-200 dark:border-slate-800/80 mr-4 rtl:mr-0 rtl:ml-4'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={step.authorAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${step.authorUsername}`}
                      alt={step.authorUsername}
                      className="w-6 h-6 rounded-full border border-slate-300 dark:border-slate-700 object-cover"
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {step.authorDisplayName || step.authorUsername}
                    </span>
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60">
                      #{step.stepNumber}
                    </span>
                  </div>
                  {step.audioUrl && (
                    <Tooltip content={isAudioPlaying ? (isArabic ? 'إيقاف التسجيل الصوتي' : 'Pause audio') : (isArabic ? 'استماع للتسجيل الصوتي' : 'Play voice turn')} position="left">
                      <button
                        onClick={() => playAudio(step.id, step.audioUrl)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border transition-colors shadow-sm ${
                          isAudioPlaying
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        <Volume2 className={`w-3 h-3 ${isAudioPlaying ? 'animate-bounce text-white' : 'text-indigo-500 dark:text-indigo-400'}`} />
                        <span>
                          {isAudioPlaying
                            ? isArabic
                              ? 'تشغيل...'
                              : 'Playing...'
                            : `${step.durationSeconds ? `${step.durationSeconds}s` : '15s'} Audio`}
                        </span>
                      </button>
                    </Tooltip>
                  )}
                </div>

                <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium pl-8 rtl:pl-0 rtl:pr-8">
                  {step.content}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Turn Action / Invariant Status Bar */}
        <div className="pt-3.5 border-t border-slate-200 dark:border-slate-800/70">
          {isCompleted ? (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <span>{isArabic ? 'اكتملت القصة التفاعلية وتم تتويج المساهمين! 🎉' : 'Story Completed & Sealed! 🎉'}</span>
            </div>
          ) : isLastAuthor ? (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs sm:text-sm text-amber-600 dark:text-amber-300">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-500 dark:text-amber-400" />
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
            <Tooltip content={isArabic ? 'إضافة دور جديد نصي أو صوتي في السلسلة' : 'Add text or voice note for your turn'} position="top" className="w-full">
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 text-white transition-colors shadow-sm"
              >
                <Mic className="w-4 h-4 text-white" />
                <span>{isArabic ? 'دورك الآن! مرر المايك وأكمل القصة 🎤' : 'Your Turn! Take The Mic & Add Step 🎤'}</span>
              </button>
            </Tooltip>
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
