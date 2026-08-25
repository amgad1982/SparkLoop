import React, { useState, useEffect } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { SparkDto, SparkSubmissionDto } from '../../types/api';
import { useCentrifugo } from '../../hooks/useCentrifugo';
import { VoteButton } from './VoteButton';
import { api, getMediaUrl } from '../../services/apiClient';
import { Tooltip } from '../ui/Tooltip';
import { Clock, Crown, Flame, Plus, Sparkles, Trophy, Upload } from 'lucide-react';
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

  useEffect(() => {
    setSpark(initialSpark);
  }, [initialSpark]);

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

        // 1. Rich dark cyber gradient
        const grad = ctx.createLinearGradient(0, 0, 450, 450);
        grad.addColorStop(0, '#180b2b');
        grad.addColorStop(0.5, '#2e1065');
        grad.addColorStop(1, '#09090b');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 450, 450);

        // 2. Ambient neon glow orbs
        ctx.save();
        ctx.beginPath();
        ctx.arc(380, 70, 110, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(217, 70, 239, 0.18)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(70, 380, 100, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
        ctx.fill();
        ctx.restore();

        // 3. Challenge Badge
        ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(24, 24, 150, 30, 15);
        ctx.fill();
        ctx.stroke();

        ctx.font = "bold 12px 'Cairo', 'Inter', sans-serif";
        ctx.fillStyle = '#FBBF24';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡ DAILY SPARK', 99, 39);

        // 4. Spark Category / Title preview
        ctx.font = "bold 13px 'Cairo', 'Inter', sans-serif";
        ctx.fillStyle = '#A1A1AA';
        ctx.textAlign = 'left';
        const displayTitle = spark.title.length > 36 ? spark.title.slice(0, 36) + '...' : spark.title;
        ctx.fillText(displayTitle, 24, 78);

        // 5. User Submission Text in High-Impact Meme Typography
        const text = quickCaption.trim();
        const fontCss = isArabic ? "'Cairo', sans-serif" : "Impact, 'Inter', sans-serif";
        const fontSize = text.length > 80 ? 22 : text.length > 40 ? 26 : 30;
        ctx.font = `900 ${fontSize}px ${fontCss}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Word wrap lines
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > 390 && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);

        const lineHeight = fontSize * 1.35;
        const startY = 240 - ((lines.length - 1) * lineHeight) / 2;

        lines.forEach((line, idx) => {
          const y = startY + idx * lineHeight;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 5;
          ctx.lineJoin = 'round';
          ctx.strokeText(line, 225, y, 400);

          ctx.fillStyle = idx === 0 ? '#FFFFFF' : '#FACC15';
          ctx.fillText(line, 225, y, 400);
          ctx.shadowBlur = 0;
        });

        // 6. Watermark Footer
        ctx.font = "11px 'Inter', sans-serif";
        ctx.fillStyle = '#71717A';
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
    <div className="space-y-6 text-white">
      {/* 24h Daily Challenge Hero Banner */}
      <div className="relative rounded-3xl p-6 sm:p-7 overflow-hidden bg-gradient-to-br from-fuchsia-950/70 via-purple-950/40 to-zinc-900 border border-fuchsia-500/30 shadow-2xl">
        {/* Background glow effects */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-fuchsia-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-md shadow-orange-500/20">
                {isArabic ? 'تحدي الـ 24 ساعة اليومي' : '24H DAILY SPARK'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                {spark.category}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold bg-amber-950/50 border border-amber-500/30 px-3 py-1 rounded-xl">
              <Clock className="w-3.5 h-3.5" />
              <span>{isCompleted ? (isArabic ? 'انتهى التحدي' : 'Ended') : (isArabic ? '23:45 متبقي' : '23h 45m left')}</span>
            </div>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">{spark.title}</h2>
            <p className="text-xs sm:text-sm text-zinc-300 mt-1.5 leading-relaxed">{spark.prompt}</p>
          </div>

          {/* Winner Banner if Completed */}
          {isCompleted && spark.winnerUsername && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/20 via-fuchsia-500/20 to-purple-500/20 border border-amber-500/40 rounded-2xl flex items-center justify-between"
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
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-95 transition-all spark-glow"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>{isArabic ? 'رسم ميم والتسليم بالكانفاس' : 'Open Meme Canvas 🎨'}</span>
              </button>
            </Tooltip>

            <Tooltip content={isArabic ? 'مشاركة سريعة بتوليد بطاقة ميم تلقائية' : 'Quick text submission with auto-styled card'} position="top">
              <button
                onClick={() => setIsSubmittingQuick(!isSubmittingQuick)}
                className="py-3 px-4 rounded-2xl bg-zinc-900/90 dark:bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 dark:border-zinc-800 text-xs sm:text-sm font-bold text-zinc-100 dark:text-zinc-300 flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4 text-cyan-400" />
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
                className="p-4 bg-zinc-950/70 border border-zinc-800/80 rounded-2xl space-y-3 pt-3 relative"
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
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-fuchsia-500"
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
                  className="w-full py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors shadow-lg"
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
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-zinc-300">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>{isArabic ? 'المشاركات الأكثر تصويتاً' : 'Live Submission Leaderboard'}</span>
          </div>
          <span className="text-xs text-zinc-500">
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
                    ? 'border-amber-500/80 bg-amber-950/20 shadow-lg shadow-amber-500/10'
                    : 'border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                {/* Author Info & Rank */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black w-6 text-center">{rankEmoji}</span>
                    <img
                      src={sub.authorAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${sub.authorUsername}`}
                      alt={sub.authorUsername}
                      className="w-9 h-9 rounded-full border border-zinc-700 object-cover"
                    />
                    <div>
                      <span className="font-bold text-xs sm:text-sm text-zinc-200 block">
                        {sub.authorDisplayName || sub.authorUsername}
                      </span>
                      <span className="text-[11px] text-zinc-500">@{sub.authorUsername}</span>
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
                  <div className="rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-950/80 flex items-center justify-center p-2">
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
                  <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-medium px-1">
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
