import React, { useState } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { api } from '../../services/apiClient';
import { PostDto } from '../../types/api';
import { Image, Palette, Send, Sparkles, X } from 'lucide-react';
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm">
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="w-full max-w-md bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-5 space-y-4 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={currentPersona.avatarUrl}
                  alt={currentPersona.username}
                  className="w-8 h-8 rounded-full border border-zinc-700 object-cover"
                />
                <div>
                  <h3 className="font-bold text-sm text-zinc-100">{currentPersona.displayName}</h3>
                  <span className="text-[10px] text-zinc-400">@{currentPersona.username}</span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-zinc-400 hover:text-white rounded-full bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <textarea
                  rows={4}
                  maxLength={maxChars}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    isArabic
                      ? 'ماذا يدور في ذهنك؟ شارك ميم أو فكرة سريعة (<= 280 حرف)...'
                      : "What's happening? Share a meme or thought (<= 280 chars)..."
                  }
                  className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-2xl text-xs text-white resize-none focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500"
                />
                <span
                  className={`absolute bottom-2.5 right-3 text-[11px] font-bold ${
                    charsRemaining < 20 ? 'text-amber-400' : 'text-zinc-500'
                  }`}
                >
                  {charsRemaining}
                </span>
              </div>

              {/* Meme Canvas Shortcut */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCanvas();
                }}
                className="w-full p-2.5 bg-zinc-950 border border-zinc-800 hover:border-fuchsia-500/50 rounded-2xl flex items-center justify-between text-xs text-zinc-300 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-fuchsia-400" />
                  <span>{isArabic ? 'فتح صانع الميم التفاعلي' : 'Draw Meme in Canvas Lab'}</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300 font-bold">
                  {isArabic ? 'صيغة WebP' : 'WebP'}
                </span>
              </button>

              {error && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-800 text-xs text-rose-300 rounded-xl">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !content.trim()}
                className="w-full py-3 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg spark-glow"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? (isArabic ? 'جاري النشر...' : 'Publishing...') : (isArabic ? 'نشر التدوينة ✨' : 'Publish Post ✨')}</span>
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
