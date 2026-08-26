import React, { useState } from 'react';
import { Flame } from 'lucide-react';
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
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={handleClick}
        disabled={isVoting}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs transition-colors duration-150 ${
          voted
            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-600 font-bold shadow-sm'
            : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium shadow-sm'
        }`}
      >
        <motion.div animate={voted ? { scale: [1, 1.25, 1] } : {}}>
          <Flame className={`w-4 h-4 ${voted ? 'text-slate-950 fill-slate-950' : 'text-amber-500'}`} />
        </motion.div>
        <span>{count}</span>
      </motion.button>
    </Tooltip>
  );
};
