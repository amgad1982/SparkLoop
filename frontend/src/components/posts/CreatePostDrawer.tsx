import React, { useState, useRef } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { api } from '../../services/apiClient';
import { PostDto } from '../../types/api';
import { HashtagAutocomplete } from '../common/HashtagAutocomplete';
import { Tooltip } from '../ui/Tooltip';
import { Palette, Send, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CreatePostDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: (post: PostDto) => void;
  onOpenCanvas: () => void;
}

export const CreatePostDrawer: React.FC<CreatePostDrawerProps> = ({
  isOpen,
  onClose,
  onPostCreated,
  onOpenCanvas,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';
  const { currentPersona } = useAuthStore();

  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const maxChars = 280;
  const charsRemaining = maxChars - content.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const post = await api.createPost(content.trim(), mediaUrl.trim() || undefined);
      setContent('');
      setMediaUrl('');
      onPostCreated(post);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Post failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectHashtag = (newText: string, newCursor: number) => {
    setContent(newText);
    setCursorPosition(newCursor);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 0);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="w-full max-w-md bg-white dark:bg-[#131b28] border-t border-slate-200 dark:border-slate-800 rounded-t-3xl p-5 space-y-4 text-slate-900 dark:text-white shadow-xl transition-colors duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={currentPersona.avatarUrl}
                  alt={currentPersona.username}
                  className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-700 object-cover"
                />
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{currentPersona.displayName}</h3>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">@{currentPersona.username}</span>
                </div>
              </div>
              <Tooltip content={isArabic ? 'إغلاق' : 'Close'} position="bottom">
                <button
                  onClick={onClose}
                  className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  rows={4}
                  maxLength={maxChars}
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    setCursorPosition(e.target.selectionStart);
                  }}
                  onKeyUp={(e) => setCursorPosition((e.target as HTMLTextAreaElement).selectionStart)}
                  onClick={(e) => setCursorPosition((e.target as HTMLTextAreaElement).selectionStart)}
                  placeholder={
                    isArabic
                      ? 'ماذا يدور في ذهنك؟ اكتب # لاختيار أو كتابة وسم (<= 280 حرف)...'
                      : "What's happening? Type # to add hashtags (<= 280 chars)..."
                  }
                  className="w-full p-3 bg-slate-50 dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs text-slate-900 dark:text-white resize-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-sm"
                />

                {/* Hashtag Autocomplete Popup */}
                <HashtagAutocomplete
                  text={content}
                  cursorPosition={cursorPosition}
                  onSelectHashtag={handleSelectHashtag}
                  className="bottom-full mb-1 left-2 rtl:left-auto rtl:right-2"
                />

                <span
                  className={`absolute bottom-2.5 right-3 rtl:right-auto rtl:left-3 text-[11px] font-bold ${
                    charsRemaining < 20 ? 'text-amber-500' : 'text-slate-400'
                  }`}
                >
                  {charsRemaining}
                </span>
              </div>

              {/* Meme Canvas Shortcut */}
              <Tooltip content={isArabic ? 'فتح استوديو تصميم الميمز المتكامل' : 'Open Full Meme Canvas Studio'} position="top" className="w-full">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCanvas();
                  }}
                  className="w-full p-2.5 bg-slate-50 dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-700/80 hover:border-indigo-500/50 rounded-2xl flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 transition-colors shadow-sm"
                >
                  <span className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    <span>{isArabic ? 'فتح صانع الميم التفاعلي' : 'Draw Meme in Canvas Lab'}</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-bold border border-indigo-500/30">
                    {isArabic ? 'استوديو التصميم' : 'Meme Studio'}
                  </span>
                </button>
              </Tooltip>

              {error && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-300 rounded-xl">
                  {error}
                </div>
              )}

              <Tooltip content={isArabic ? 'نشر التدوينة للجميع' : 'Publish post to feed'} position="top" className="w-full">
                <button
                  type="submit"
                  disabled={isSubmitting || !content.trim()}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? (isArabic ? 'جاري النشر...' : 'Publishing...') : (isArabic ? 'نشر التدوينة ✨' : 'Publish Post ✨')}</span>
                </button>
              </Tooltip>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
