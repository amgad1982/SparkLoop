import React, { useEffect } from 'react';
import { usePodStore } from '../../stores/usePodStore';
import { motion, AnimatePresence } from 'framer-motion';

export const FloatingReactions: React.FC = () => {
  const { reactions, removeOldReactions } = usePodStore();

  useEffect(() => {
    const interval = setInterval(() => {
      removeOldReactions();
    }, 1000);
    return () => clearInterval(interval);
  }, [removeOldReactions]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.div
            key={reaction.id}
            initial={{
              y: 0,
              x: `${reaction.xOffset}%`,
              scale: 0.8,
              opacity: 1,
            }}
            animate={{
              y: -280,
              scale: 1.4,
              opacity: [1, 1, 0.8, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 2.4,
              ease: 'easeOut',
            }}
            className="absolute bottom-20 text-3xl select-none"
          >
            {reaction.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
