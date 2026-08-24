import React, { useState, useEffect } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { SparkDto, SparkSubmissionDto } from '../../types/api';
import { useCentrifugo } from '../../hooks/useCentrifugo';
import { VoteButton } from './VoteButton';
import { api } from '../../services/apiClient';
import { Clock, Crown, Flame, Plus, Sparkles, Trophy, Upload } from 'lucide-react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';

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
      const sub = await api.submitSparkEntry(spark.id, quickCaption.trim());
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
    <div className="space-y-4 text-white">
      {/* 24h Daily Challenge Hero Banner */}
      <div className="relative rounded-3xl p-5 overflow-hidden bg-gradient-to-br from-fuchsia-950/70 via-purple-950/40 to-zinc-900 border border-fuchsia-500/30 shadow-2xl">
        {/* Background glow effects */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-fuchsia-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-md shadow-orange-500/20">
                {isArabic ? 'تحدي الـ 24 ساعة اليومي' : '24H DAILY SPARK'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                {spark.category}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold bg-amber-950/50 border border-amber-500/30 px-2.5 py-1 rounded-xl">
              <Clock className="w-3.5 h-3.5" />
              <span>{isCompleted ? (isArabic ? 'انتهى التحدي' : 'Ended') : (isArabic ? '23:45 متبقي' : '23h 45m left')}</span>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-white">{spark.title}</h2>
            <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{spark.prompt}</p>
          </div>

          {/* Winner Banner if Completed */}
          {isCompleted && spark.winnerUsername && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-3 bg-gradient-to-r from-amber-500/20 via-fuchsia-500/20 to-purple-500/20 border border-amber-500/40 rounded-2xl flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <Trophy className="w-6 h-6 text-amber-400 animate-bounce" />
                <div>
                  <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider block">
                    {isArabic ? 'بطل التحدي المتوّج 🏆' : 'Crown Champion 🏆'}
                  </span>
                  <span className="text-xs font-bold text-white">@{spark.winnerUsername}</span>
                </div>
              </div>
              <span className="text-[10px] px-2 py-1 bg-amber-500 text-black font-extrabold rounded-lg">
                +100 REP
              </span>
            </motion.div>
          )}

          {/* CTA Buttons */}
          <div className="flex items-center gap-2.5 pt-1">
            <button
              onClick={onOpenCanvas}
              className="flex-1 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all spark-glow"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{isArabic ? 'رسم ميم والتسليم بالكانفاس' : 'Open Meme Canvas 🎨'}</span>
            </button>

            <button
              onClick={() => setIsSubmittingQuick(!isSubmittingQuick)}
              className="py-2.5 px-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-300 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>{isArabic ? 'مشاركة سريعة' : 'Quick Text'}</span>
            </button>

            {!isCompleted && (
              <button
                disabled={isResolving}
                onClick={handleResolveWinner}
                className="py-2.5 px-2.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-400 hover:text-amber-300 text-xs font-bold"
                title="Resolve Winner (Demo/Cron)"
              >
                <Crown className="w-4 h-4" />
              </button>
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
                className="space-y-2 pt-2"
              >
                <input
                  type="text"
                  value={quickCaption}
                  onChange={(e) => setQuickCaption(e.target.value)}
                  placeholder={isArabic ? 'اكتب إجابتك أو نكتتك هنا...' : 'Type your quick entry...'}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-fuchsia-500"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs rounded-xl"
                >
                  {isArabic ? 'إرسال المشاركة 🚀' : 'Submit Entry 🚀'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Leaderboard Stream */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>{isArabic ? 'المشاركات الأكثر تصويتاً' : 'Live Submission Leaderboard'}</span>
          </div>
          <span className="text-[11px] text-zinc-500">
            {sortedSubmissions.length} {isArabic ? 'مشاركة' : 'entries'}
          </span>
        </div>

        <div className="space-y-3">
          {sortedSubmissions.map((sub, index) => {
            const isWinner = spark.winnerSubmissionId === sub.id;
            const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;

            return (
              <motion.div
                key={sub.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className={`glass-card rounded-3xl p-4 space-y-3 border transition-all ${
                  isWinner
                    ? 'border-amber-500/80 bg-amber-950/20 shadow-lg shadow-amber-500/10'
                    : 'border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                {/* Author Info & Rank */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base font-black w-6 text-center">{rankEmoji}</span>
                    <img
                      src={sub.authorAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${sub.authorUsername}`}
                      alt={sub.authorUsername}
                      className="w-8 h-8 rounded-full border border-zinc-700 object-cover"
                    />
                    <div>
                      <span className="font-bold text-xs text-zinc-200 block">
                        {sub.authorDisplayName || sub.authorUsername}
                      </span>
                      <span className="text-[10px] text-zinc-500">@{sub.authorUsername}</span>
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
                  <div className="rounded-2xl overflow-hidden border border-zinc-800/80 max-h-80 bg-zinc-950 flex items-center justify-center">
                    <img
                      src={sub.mediaUrl.startsWith('/') ? `http://localhost:5000${sub.mediaUrl}` : sub.mediaUrl}
                      alt={sub.caption}
                      className="w-full h-auto object-cover max-h-80"
                    />
                  </div>
                )}

                {/* Caption */}
                {sub.caption && (
                  <p className="text-xs text-zinc-200 leading-relaxed font-medium">
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
