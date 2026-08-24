import React, { useState, useEffect, useRef } from 'react';
import { HashtagDto } from '../../types/api';
import { api } from '../../services/apiClient';
import { Hash, Flame, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface HashtagAutocompleteProps {
  text: string;
  cursorPosition: number | null;
  onSelectHashtag: (newText: string, newCursorPosition: number) => void;
  className?: string;
}

export const HashtagAutocomplete: React.FC<HashtagAutocompleteProps> = ({
  text,
  cursorPosition,
  onSelectHashtag,
  className = '',
}) => {
  const [suggestions, setSuggestions] = useState<HashtagDto[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeRange, setActiveRange] = useState<{ start: number; end: number; query: string } | null>(null);

  useEffect(() => {
    if (cursorPosition === null) {
      setIsOpen(false);
      return;
    }

    const textBeforeCursor = text.slice(0, cursorPosition);
    // Match # followed by word chars at the end of the text before cursor
    const match = textBeforeCursor.match(/(?:^|\s)(#([a-zA-Z0-9_\u0600-\u06FF]*))$/);

    if (match) {
      const fullMatch = match[1]; // e.g. '#tag' or '#'
      const query = match[2]; // e.g. 'tag' or ''
      const startIndex = textBeforeCursor.length - fullMatch.length;

      setActiveRange({
        start: startIndex,
        end: cursorPosition,
        query,
      });

      // Query suggestions from backend
      api.searchHashtags(query, 6)
        .then((tags) => {
          if (tags && tags.length > 0) {
            setSuggestions(tags);
            setIsOpen(true);
            setSelectedIndex(0);
          } else {
            setIsOpen(false);
          }
        })
        .catch(() => {
          setIsOpen(false);
        });
    } else {
      setIsOpen(false);
      setActiveRange(null);
    }
  }, [text, cursorPosition]);

  const handleSelect = (tag: string) => {
    if (!activeRange) return;

    const before = text.slice(0, activeRange.start);
    const after = text.slice(activeRange.end);
    const replacement = `#${tag} `;
    const newText = before + replacement + after;
    const newCursor = activeRange.start + replacement.length;

    onSelectHashtag(newText, newCursor);
    setIsOpen(false);
  };

  // Keyboard navigation handler to be attached to inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || suggestions.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (suggestions[selectedIndex]) {
          e.preventDefault();
          handleSelect(suggestions[selectedIndex].tag);
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, suggestions, selectedIndex, activeRange]);

  if (!isOpen || suggestions.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 6, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.96 }}
        transition={{ duration: 0.15 }}
        className={`absolute z-50 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl p-1.5 shadow-2xl space-y-1 min-w-[200px] max-w-xs ${className}`}
      >
        <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between border-b border-zinc-800/80">
          <span className="flex items-center gap-1 text-fuchsia-400">
            <Hash className="w-3 h-3" />
            <span>Trending Hashtags</span>
          </span>
          <span className="text-[9px] text-zinc-500">Tab / Enter ↵</span>
        </div>

        <div className="max-h-48 overflow-y-auto no-scrollbar space-y-0.5">
          {suggestions.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={item.tag}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent input blur
                  handleSelect(item.tag);
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left rtl:text-right transition-colors text-xs ${
                  isSelected
                    ? 'bg-fuchsia-600/30 text-white font-bold border border-fuchsia-500/50'
                    : 'text-zinc-300 hover:bg-zinc-800/80 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-fuchsia-400 font-bold text-xs">#</span>
                  <span className="truncate">{item.tag}</span>
                </div>

                <div className="flex items-center gap-1 text-[10px] text-zinc-400 shrink-0 font-medium">
                  <Flame className="w-2.5 h-2.5 text-amber-400" />
                  <span>{item.count}</span>
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

