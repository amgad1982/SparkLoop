import React, { useState, useEffect } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { SparkDto, SparkSubmissionDto } from '../../types/api';
import { useCentrifugo } from '../../hooks/useCentrifugo';
import { VoteButton } from './VoteButton';
import { api, getMediaUrl } from '../../services/apiClient';
import { Tooltip } from '../ui/Tooltip';
import { Clock, Crown, Flame, Plus, Sparkles, Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { HashtagAutocomplete } from '../common/HashtagAutocomplete';

interface SparkHeroCardProps {
  initialSpark: SparkDto;
  onOpenCanvas?: () => void;
}

export const SparkHeroCard: React.FC<SparkHeroCardProps> = ({
  initialSpark,
  onOpenCanvas,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  const [spark, setSpark] = useState<SparkDto>(initialSpark);
  const [isSubmittingQuick, setIsSubmittingQuick] = useState(false);
  const [quickCaption, setQuickCaption] = useState('');
  const [quickCursorPos, setQuickCursorPos] = useState<number | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [countdown, setCountdown] = useState<string>('24:00:00');

  useEffect(() => {
    setSpark(initialSpark);
  }, [initialSpark]);

  useEffect(() => {
    const updateCountdown = () => {
      if (!spark) {
        setCountdown('24:00:00');
        return;
      }

      if (spark.status === 'Completed') {
        setCountdown(isArabic ? 'انتهى التحدي' : 'Ended');
        return;
      }

      if (spark.activeUntilUtc) {
        const target = new Date(spark.activeUntilUtc).getTime();
        if (!isNaN(target)) {
          const diffMs = target - Date.now();
          if (diffMs <= 0) {
            setCountdown(isArabic ? 'انتهى التحدي' : '00:00:00');
            return;
          }
          const totalSec = Math.floor(diffMs / 1000);
          const hours = Math.floor(totalSec / 3600);
          const minutes = Math.floor((totalSec % 3600) / 60);
          const seconds = totalSec % 60;
          setCountdown(
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
          );
          return;
        }
      }

      if (spark.timeRemaining) {
        setCountdown(String(spark.timeRemaining).split('.')[0]);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [spark?.activeUntilUtc, spark?.status, spark?.timeRemaining, isArabic]);

  // Real-Time Centrifugo Subscription for "sparks:daily"
  useCentrifugo('sparks:daily', (data) => {
    if (data.type === 'SPARK_SUBMISSION_ADDED' && data.submission) {
      const newSub = data.submission as SparkSubmissionDto;
      setSpark((prev) => {
        if (prev.submissions.some((s) => s.id === newSub.id)) return prev;
        return {
          ...prev,
          submissions: [newSub, ...prev.submissions],
        };
      });
    } else if (data.type === 'SPARK_VOTE_CAST') {
      const { submissionId, newVoteCount } = data as unknown as { submissionId: string; newVoteCount: number };
      setSpark((prev) => ({
        ...prev,
        submissions: prev.submissions.map((s) =>
          s.id === submissionId ? { ...s, voteCount: newVoteCount } : s
        ),
      }));
    } else if (data.type === 'SPARK_WINNER_SELECTED') {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.5 },
      });
      const { winnerUserId, winnerUsername, winnerSubmissionId } = data as unknown as {
        winnerUserId: string;
        winnerUsername: string;
        winnerSubmissionId: string;
      };
      setSpark((prev) => ({
        ...prev,
        status: 'Completed',
        winnerUserId,
        winnerUsername,
        winnerSubmissionId,
      }));
    }
  });

  const handleVote = async (submissionId: string) => {
    await api.voteSparkSubmission(spark.id, submissionId);
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCaption.trim()) return;

    try {
      // Automatically generate a stylized meme card image with the user's text
      const canvas = document.createElement('canvas');
      canvas.width = 450;
      canvas.height = 450;
      const ctx = canvas.getContext('2d');
      let mediaUrl: string | undefined = undefined;

      if (ctx) {
        if (document.fonts) {
          try {
            await document.fonts.ready;
          } catch {
            // font ready fallback
          }
        }

        // 1. Nordic dark slate gradient
        const bgGrad = ctx.createLinearGradient(0, 0, 450, 450);
        bgGrad.addColorStop(0, '#0b0f17');
        bgGrad.addColorStop(0.5, '#131b28');
        bgGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 450, 450);

        // 2. Subtle Indigo mesh accents
        const radGrad = ctx.createRadialGradient(400, 50, 10, 400, 50, 200);
        radGrad.addColorStop(0, 'rgba(99, 102, 241, 0.25)');
        radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = radGrad;
        ctx.fillRect(0, 0, 450, 450);

        // 3. Card Border
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
        ctx.lineWidth = 4;
        ctx.strokeRect(12, 12, 426, 426);

        // 4. Header Badge
        ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
        ctx.fillRect(24, 24, 402, 44);
        ctx.font = "bold 13px 'Inter', 'Cairo', sans-serif";
        ctx.fillStyle = '#818cf8';
        ctx.textAlign = 'left';
        ctx.fillText(`⚡ DAILY SPARK CHALLENGE`, 40, 52);

        // 5. Main Text wrapping
        const words = quickCaption.trim().split(' ');
        const lines: string[] = [];
        let curLine = '';

        ctx.font = "bold 20px 'Inter', 'Cairo', sans-serif";
        for (const w of words) {
          const testLine = curLine ? `${curLine} ${w}` : w;
          if (ctx.measureText(testLine).width > 380) {
            lines.push(curLine);
            curLine = w;
          } else {
            curLine = testLine;
          }
        }
        if (curLine) lines.push(curLine);

        const startY = 170 - (lines.length * 15);
        lines.forEach((line, idx) => {
          const y = startY + idx * 34;
          ctx.textAlign = 'center';
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#000000';
          ctx.strokeText(line, 225, y, 400);

          ctx.fillStyle = idx === 0 ? '#FFFFFF' : '#38BDF8';
          ctx.fillText(line, 225, y, 400);
          ctx.shadowBlur = 0;
        });

        // 6. Watermark Footer
        ctx.font = "11px 'Inter', sans-serif";
        ctx.fillStyle = '#94A3B8';
        ctx.textAlign = 'center';
        ctx.fillText('SparkLoop ✨ 24h Daily Sparks', 225, 426);

        try {
          const dataUrl = canvas.toDataURL('image/webp', 0.95);
          mediaUrl = dataUrl;
          const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/webp', 0.95));
          const uploadRes = await api.uploadMedia(blob, `quick_spark_${Date.now()}.webp`);
          if (uploadRes?.url) {
            mediaUrl = uploadRes.url;
          }
        } catch (uploadErr) {
          console.warn('Quick spark upload fallback to dataUrl:', uploadErr);
        }
      }

      const sub = await api.submitSparkEntry(spark.id, quickCaption.trim(), mediaUrl);
      setSpark((prev) => ({
        ...prev,
        submissions: [sub, ...prev.submissions],
      }));
      setQuickCaption('');
      setIsSubmittingQuick(false);
    } catch (err) {
      console.error('Spark submission error:', err);
    }
  };

  const handleResolveWinner = async () => {
    setIsResolving(true);
    try {
      const resolved = await api.resolveSparkWinner(spark.id);
      setSpark(resolved);
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.5 },
      });
    } catch (err) {
      console.error('Resolve winner error:', err);
    } finally {
      setIsResolving(false);
    }
  };

  // Sort submissions by votes
  const sortedSubmissions = [...spark.submissions].sort((a, b) => b.voteCount - a.voteCount);
  const isCompleted = spark.status === 'Completed';

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* 24h Daily Challenge Hero Banner */}
      <div className="relative rounded-3xl p-6 sm:p-7 overflow-hidden bg-gradient-to-br from-[#131b28] via-[#162030] to-[#0e1520] border border-slate-700/60 shadow-xl text-white">
        {/* Background subtle glow effects */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-sm">
                {isArabic ? 'تحدي الـ 24 ساعة اليومي' : '24H DAILY SPARK'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                {spark.category}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold bg-amber-950/40 border border-amber-500/30 px-3 py-1 rounded-xl">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-mono">{countdown}</span>
            </div>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">{spark.title}</h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">{spark.prompt}</p>
          </div>

          {/* Winner Banner if Completed */}
          {isCompleted && spark.winnerUsername && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/20 via-indigo-500/20 to-sky-500/20 border border-amber-500/40 rounded-2xl flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Trophy className="w-7 h-7 text-amber-400 animate-bounce" />
                <div>
                  <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider block">
                    {isArabic ? 'بطل التحدي المتوّج 🏆' : 'Crown Champion 🏆'}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-white">@{spark.winnerUsername}</span>
                </div>
              </div>
              <span className="text-[10px] px-2.5 py-1 bg-amber-500 text-black font-extrabold rounded-lg">
                +100 REP
              </span>
            </motion.div>
          )}

          {/* CTA Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Tooltip content={isArabic ? 'تصميم ميم رسومي كامل للتحدي اليومي' : 'Create full meme artwork for challenge'} position="top" className="flex-1">
              <button
                onClick={onOpenCanvas}
                className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>{isArabic ? 'رسم ميم والتسليم بالكانفاس' : 'Open Meme Canvas 🎨'}</span>
              </button>
            </Tooltip>

            <Tooltip content={isArabic ? 'مشاركة سريعة بتوليد بطاقة ميم تلقائية' : 'Quick text submission with auto-styled card'} position="top">
              <button
                onClick={() => setIsSubmittingQuick(!isSubmittingQuick)}
                className="py-3 px-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4 text-sky-400" />
                <span>{isArabic ? 'مشاركة سريعة' : 'Quick Text'}</span>
              </button>
            </Tooltip>

            {!isCompleted && (
              <Tooltip content={isArabic ? 'تتويج الفائز صاحب أعلى تصويت فوراً' : 'Crown the top-voted champion now'} position="top">
                <button
                  disabled={isResolving}
                  onClick={handleResolveWinner}
                  className="py-3 px-3 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-400 hover:text-amber-300 text-xs font-bold transition-colors shadow-sm"
                >
                  <Crown className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
          </div>

          {/* Quick Text Submission Drawer */}
          <AnimatePresence>
            {isSubmittingQuick && (
              <motion.form
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                onSubmit={handleQuickSubmit}
                className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3 pt-3 relative"
              >
                <div className="relative">
                  <input
                    type="text"
                    value={quickCaption}
                    onChange={(e) => {
                      setQuickCaption(e.target.value);
                      setQuickCursorPos(e.target.selectionStart);
                    }}
                    onKeyUp={(e) => setQuickCursorPos((e.target as HTMLInputElement).selectionStart)}
                    onClick={(e) => setQuickCursorPos((e.target as HTMLInputElement).selectionStart)}
                    placeholder={isArabic ? 'اكتب إجابتك هنا... (اكتب # للوسوم)' : 'Type your quick entry... (type # for hashtags)'}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
                  />

                  <HashtagAutocomplete
                    text={quickCaption}
                    cursorPosition={quickCursorPos}
                    onSelectHashtag={(newText, newCursor) => {
                      setQuickCaption(newText);
                      setQuickCursorPos(newCursor);
                    }}
                    className="bottom-full mb-1 left-2 rtl:left-auto rtl:right-2"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors shadow-md"
                >
                  {isArabic ? 'إرسال المشاركة 🚀' : 'Submit Entry 🚀'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Leaderboard Stream */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
            <Flame className="w-4 h-4 text-amber-500" />
            <span>{isArabic ? 'المشاركات الأكثر تصويتاً' : 'Live Submission Leaderboard'}</span>
          </div>
          <span className="text-xs text-slate-500">
            {sortedSubmissions.length} {isArabic ? 'مشاركة' : 'entries'}
          </span>
        </div>

        <div className="space-y-4">
          {sortedSubmissions.map((sub, index) => {
            const isWinner = spark.winnerSubmissionId === sub.id;
            const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;

            return (
              <motion.div
                key={sub.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className={`glass-card rounded-3xl p-5 sm:p-6 space-y-4 border transition-all ${
                  isWinner
                    ? 'border-amber-500/80 bg-amber-950/20 shadow-md shadow-amber-500/10'
                    : 'border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Author Info & Rank */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black w-6 text-center">{rankEmoji}</span>
                    <img
                      src={sub.authorAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${sub.authorUsername}`}
                      alt={sub.authorUsername}
                      className="w-9 h-9 rounded-full border border-slate-300 dark:border-slate-700 object-cover"
                    />
                    <div>
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 block">
                        {sub.authorDisplayName || sub.authorUsername}
                      </span>
                      <span className="text-[11px] text-slate-500">@{sub.authorUsername}</span>
                    </div>
                  </div>

                  <VoteButton
                    initialCount={sub.voteCount}
                    hasVoted={sub.hasVoted}
                    onVote={() => handleVote(sub.id)}
                  />
                </div>

                {/* Media Meme Preview if available */}
                {sub.mediaUrl && (
                  <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800/80 bg-slate-100 dark:bg-[#0b0f17]/90 flex items-center justify-center p-2">
                    <img
                      src={getMediaUrl(sub.mediaUrl)}
                      alt={sub.caption}
                      className="w-full h-auto max-h-[520px] object-contain rounded-xl"
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Caption */}
                {sub.caption && (
                  <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium px-1">
                    {sub.caption}
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
