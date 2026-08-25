import React, { useState } from 'react';
import { Flame, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { Tooltip } from '../ui/Tooltip';
import { useThemeStore } from '../../stores/useThemeStore';

interface VoteButtonProps {
  initialCount: number;
  hasVoted: boolean;
  onVote: () => Promise<void>;
}

export const VoteButton: React.FC<VoteButtonProps> = ({ initialCount, hasVoted, onVote }) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(hasVoted);
  const [isVoting, setIsVoting] = useState(false);

  const handleClick = async () => {
    if (isVoting) return;
    setIsVoting(true);

    // Optimistic update
    const previousVoted = voted;
    const previousCount = count;
    setVoted(true);
    setCount((prev) => prev + (previousVoted ? 0 : 1));

    try {
      await onVote();
    } catch {
      // Revert if failed
      setVoted(previousVoted);
      setCount(previousCount);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <Tooltip content={voted ? (isArabic ? 'تم التصويت لهذه المشاركة' : 'You voted for this entry') : (isArabic ? 'صوّت لهذه المشاركة' : 'Vote for this spark submission')} position="top">
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={handleClick}
        disabled={isVoting}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-bold transition-all ${
          voted
            ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-500 dark:text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10'
            : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-700'
        }`}
      >
        <motion.div animate={voted ? { scale: [1, 1.3, 1] } : {}}>
          <Flame className={`w-4 h-4 ${voted ? 'text-amber-500 dark:text-amber-400 fill-amber-500 dark:fill-amber-400' : ''}`} />
        </motion.div>
        <span>{count}</span>
      </motion.button>
    </Tooltip>
  );
};
