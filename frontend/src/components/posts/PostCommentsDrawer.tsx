import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Trash2, MessageCircle, AlertCircle, Loader2 } from 'lucide-react';
import { PostDto, PostCommentDto } from '../../types/api';
import { api } from '../../services/apiClient';
import { useAuthStore } from '../../stores/useAuthStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { Tooltip } from '../ui/Tooltip';

interface PostCommentsDrawerProps {
  isOpen: boolean;
  post: PostDto | null;
  onClose: () => void;
  onCommentCountChange?: (postId: string, newCount: number) => void;
}

export const PostCommentsDrawer: React.FC<PostCommentsDrawerProps> = ({
  isOpen,
  post,
  onClose,
  onCommentCountChange,
}) => {
  const { currentPersona } = useAuthStore();
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  const [comments, setComments] = useState<PostCommentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const commentsEndRef = useRef<HTMLDivElement | null>(null);

  const maxChars = 500;

  useEffect(() => {
    if (!isOpen || !post) {
      setComments([]);
      setCommentText('');
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    api
      .getPostComments(post.id)
      .then((data) => {
        if (isMounted) {
          setComments(data);
          onCommentCountChange?.(post.id, data.length);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load comments:', err);
          setError(isArabic ? 'فشل تحميل التعليقات' : 'Failed to load comments');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, post?.id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleAddComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!post || !commentText.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const newComment = await api.addPostComment(post.id, commentText.trim());
      const updated = [...comments, newComment];
      setComments(updated);
      setCommentText('');
      onCommentCountChange?.(post.id, updated.length);
      scrollToBottom();
    } catch (err: any) {
      console.error('Failed to post comment:', err);
      setError(err?.message || (isArabic ? 'فشل إرسال التعليق' : 'Failed to post comment'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!post) return;
    try {
      await api.deletePostComment(post.id, commentId);
      const updated = comments.filter((c) => c.id !== commentId);
      setComments(updated);
      onCommentCountChange?.(post.id, updated.length);
    } catch (err) {
      console.error('Failed to delete comment:', err);
      setError(isArabic ? 'فشل حذف التعليق' : 'Failed to delete comment');
    }
  };

  const formatRelativeTime = (utcDateStr: string) => {
    try {
      const date = new Date(utcDateStr);
      const now = new Date();
      const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (diffSecs < 60) return isArabic ? 'الآن' : 'just now';
      if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}${isArabic ? ' د' : 'm'}`;
      if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}${isArabic ? ' س' : 'h'}`;
      return `${Math.floor(diffSecs / 86400)}${isArabic ? ' ي' : 'd'}`;
    } catch {
      return '';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && post && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="w-full sm:max-w-lg bg-white dark:bg-[#131b28] border border-slate-200 dark:border-slate-800 sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh] h-[650px] overflow-hidden text-slate-900 dark:text-slate-100 transition-colors"
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-900/50 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>{isArabic ? 'التعليقات' : 'Comments'}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                      {comments.length}
                    </span>
                  </h3>
                  <span className="text-[11px] text-slate-500 truncate block max-w-[260px]">
                    {isArabic ? 'منشور بواسطة' : 'Post by'} @{post.authorUsername}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Post Snippet Banner */}
            <div className="px-4 py-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/30 flex items-start gap-2.5 shrink-0 text-xs">
              <img
                src={post.authorAvatarUrl || `https://api.dicebear.com/10.x/bottts/svg?seed=${post.authorUsername}`}
                alt={post.authorUsername}
                className="w-6 h-6 rounded-full border border-indigo-300 dark:border-indigo-700 shrink-0 mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">
                  {post.authorDisplayName}
                </span>
                <p className="text-slate-600 dark:text-slate-400 line-clamp-2 text-[11.5px] leading-snug">
                  {post.content}
                </p>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mx-4 mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Comments Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  <span className="text-xs">{isArabic ? 'جاري تحميل التعليقات...' : 'Loading comments...'}</span>
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2 text-center text-slate-400 px-6">
                  <MessageCircle className="w-10 h-10 opacity-30 text-indigo-500" />
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {isArabic
                      ? 'لا توجد تعليقات حتى الآن. شارك برأيك أولاً!'
                      : 'No comments yet. Be the first to spark a discussion!'}
                  </p>
                </div>
              ) : (
                comments.map((c) => {
                  const isAuthor = currentPersona && (c.authorId === currentPersona.id || c.authorUsername.toLowerCase() === currentPersona.username.toLowerCase());
                  const isPostOwner = currentPersona && (post.authorId === currentPersona.id || post.authorUsername.toLowerCase() === currentPersona.username.toLowerCase());
                  const canDelete = isAuthor || isPostOwner;

                  return (
                    <div
                      key={c.id}
                      className="group flex items-start gap-2.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700/80 transition-all text-xs"
                    >
                      <img
                        src={c.authorAvatarUrl || `https://api.dicebear.com/10.x/bottts/svg?seed=${c.authorUsername}`}
                        alt={c.authorUsername}
                        className="w-7 h-7 rounded-full border border-slate-300 dark:border-slate-700 object-cover shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-bold text-slate-900 dark:text-slate-100 truncate text-[11.5px]">
                              {c.authorDisplayName}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate">@{c.authorUsername}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9.5px] text-slate-400 font-mono">
                              {formatRelativeTime(c.createdAtUtc)}
                            </span>
                            {canDelete && (
                              <Tooltip content={isArabic ? 'حذف التعليق' : 'Delete comment'} position="top">
                                <button
                                  onClick={() => handleDeleteComment(c.id)}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed break-words whitespace-pre-wrap text-xs">
                          {c.content}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* Bottom Input Field */}
            <form
              onSubmit={handleAddComment}
              className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#131b28]/95 backdrop-blur-md shrink-0 flex items-center gap-2"
            >
              <img
                src={currentPersona?.avatarUrl || 'https://api.dicebear.com/10.x/bottts/svg?seed=guest'}
                alt={currentPersona?.username || 'You'}
                className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-700 shrink-0 object-cover"
              />
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  maxLength={maxChars}
                  placeholder={
                    isArabic
                      ? 'اكتب تعليقك هنا...'
                      : 'Write a comment...'
                  }
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors pr-12 rtl:pr-3.5 rtl:pl-12"
                />
                <span className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-mono pointer-events-none">
                  {maxChars - commentText.length}
                </span>
              </div>
              <button
                type="submit"
                disabled={!commentText.trim() || submitting}
                className="p-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white shadow-sm transition-all active:scale-95 shrink-0"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
