import React, { useState, useEffect } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { PostDto, ReactionDto } from '../../types/api';
import { api, getMediaUrl } from '../../services/apiClient';
import { useCentrifugo } from '../../hooks/useCentrifugo';
import { CreatePostDrawer } from './CreatePostDrawer';
import { Tooltip } from '../ui/Tooltip';
import { FollowButton } from '../ui/FollowButton';
import {
  Flame,
  Palette,
  Hash,
  X,
  MessageCircle,
  Share2,
  Check,
  Copy,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PostCommentsDrawer } from './PostCommentsDrawer';

interface FeedViewProps {
  initialPosts: PostDto[];
  onOpenCanvas: () => void;
  selectedHashtag?: string | null;
  onSelectHashtag?: (tag: string) => void;
  onClearHashtag?: () => void;
  onOpenSearch?: () => void;
}

const REACTION_TYPES = [
  { type: 'fire', icon: '🔥', labelEn: 'Fire', labelAr: 'ناري' },
  { type: 'spark', icon: '⚡', labelEn: 'Spark', labelAr: 'شرارة' },
  { type: 'laugh', icon: '😂', labelEn: 'Funny', labelAr: 'مضحك' },
  { type: 'mindblown', icon: '🤯', labelEn: 'Mindblown', labelAr: 'مذهل' },
  { type: 'heart', icon: '❤️', labelEn: 'Love', labelAr: 'أحببته' },
];

export const FeedView: React.FC<FeedViewProps> = ({
  initialPosts,
  onOpenCanvas,
  selectedHashtag,
  onSelectHashtag,
  onClearHashtag,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';
  const { currentPersona } = useAuthStore();

  const normalizePosts = (input: unknown): PostDto[] => {
    if (Array.isArray(input)) return input;
    if (input && typeof input === 'object' && Array.isArray((input as any).items)) {
      return (input as any).items;
    }
    return [];
  };

  const [posts, setPosts] = useState<PostDto[]>(() => normalizePosts(initialPosts));
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCommentPost, setSelectedCommentPost] = useState<PostDto | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  const [copiedTextPostId, setCopiedTextPostId] = useState<string | null>(null);

  const handleCopyPostLink = (postId: string) => {
    const url = `${window.location.origin}/#post-${postId}`;
    navigator.clipboard.writeText(url);
    setCopiedPostId(postId);
    setTimeout(() => setCopiedPostId(null), 2000);
  };

  const handleCopyPostText = (text: string, postId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTextPostId(postId);
    setTimeout(() => setCopiedTextPostId(null), 2000);
  };

  const handleCommentCountChange = (postId: string, newCount: number) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, commentCount: newCount } : p))
    );
  };

  useEffect(() => {
    setPosts(normalizePosts(initialPosts));
  }, [initialPosts]);

  // Real-time subscription to feed channel for instant reactions and new posts
  useCentrifugo('feed:global', (data) => {
    if (data.type === 'POST_CREATED' && data.post) {
      const newPost = data.post as PostDto;
      setPosts((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        if (safePrev.some((p) => p.id === newPost.id)) return safePrev;
        return [newPost, ...safePrev];
      });
    } else if (data.type === 'POST_REACTED') {
      const { postId, userId, reactionType, reactionCount, reactions } = data as unknown as {
        postId: string;
        userId: string;
        username?: string;
        reactionType: string;
        reactionCount: number;
        reactions?: ReactionDto[];
      };

      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;

          if (reactions && Array.isArray(reactions)) {
            return {
              ...p,
              reactionCount: reactionCount ?? reactions.length,
              reactions,
            };
          }

          const existing = (p.reactions || []).find((r) => r.userId === userId);
          let newReactions: ReactionDto[];

          if (existing) {
            if (existing.type.toLowerCase() === reactionType.toLowerCase()) {
              newReactions = (p.reactions || []).filter((r) => r.userId !== userId);
            } else {
              newReactions = (p.reactions || []).map((r) =>
                r.userId === userId ? { ...r, type: reactionType } : r
              );
            }
          } else {
            newReactions = [
              ...(p.reactions || []),
              {
                id: Math.random().toString(),
                userId,
                username: 'User',
                type: reactionType,
                createdAtUtc: new Date().toISOString(),
              },
            ];
          }

          return {
            ...p,
            reactionCount: newReactions.length,
            reactions: newReactions,
          };
        })
      );
    } else if (data.type === 'POST_COMMENT_ADDED') {
      const { postId, commentCount } = data as unknown as { postId: string; commentCount: number };
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, commentCount } : p))
      );
    } else if (data.type === 'POST_COMMENT_DELETED') {
      const { postId, commentCount } = data as unknown as { postId: string; commentCount: number };
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, commentCount } : p))
      );
    }
  });

  const handleReact = async (postId: string, reactionType: string) => {
    if (currentPersona.username === 'guest') {
      return;
    }

    // Optimistic UI Update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;

        const currentReactions = p.reactions || [];
        const existingIdx = currentReactions.findIndex(
          (r) => r.userId === currentPersona.id && r.type.toLowerCase() === reactionType.toLowerCase()
        );

        let updatedReactions: ReactionDto[];
        if (existingIdx > -1) {
          updatedReactions = currentReactions.filter((_, idx) => idx !== existingIdx);
        } else {
          updatedReactions = [
            ...currentReactions.filter((r) => r.userId !== currentPersona.id),
            {
              id: `opt-${Date.now()}`,
              userId: currentPersona.id,
              username: currentPersona.username,
              type: reactionType,
              createdAtUtc: new Date().toISOString(),
            },
          ];
        }

        return {
          ...p,
          reactionCount: updatedReactions.length,
          reactions: updatedReactions,
        };
      })
    );

    // Network call to backend
    try {
      await api.reactToPost(postId, reactionType);
    } catch (err) {
      console.error('Failed to record reaction:', err);
    }
  };

  const renderFormattedContent = (content: string) => {
    const parts = content.split(/(#\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('#')) {
        const cleanTag = part.replace(/^#/, '');
        return (
          <span
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              if (onSelectHashtag) {
                onSelectHashtag(cleanTag);
              }
            }}
            className="font-semibold text-indigo-600 dark:text-indigo-400 cursor-pointer hover:opacity-75 active:scale-95 transition-all inline-block hover:underline"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const safePosts = Array.isArray(posts)
    ? posts
    : (posts && typeof posts === 'object' && Array.isArray((posts as any).items)
      ? (posts as any).items
      : []);

  const displayedPosts: PostDto[] = Array.isArray(safePosts)
    ? (selectedHashtag
      ? safePosts.filter((p) => p && typeof p.content === 'string' && p.content.toLowerCase().includes('#' + selectedHashtag.toLowerCase()))
      : safePosts)
    : [];

  const postList = Array.isArray(displayedPosts) ? displayedPosts : [];

  return (
    <div className="h-full flex flex-col overflow-hidden text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Isolated Fixed Creator Bar & Active Filter Bar */}
      <div className="shrink-0 pb-3 z-10 space-y-2">
        <div className="glass-panel bg-white/95 dark:bg-[#131b28]/95 backdrop-blur-xl rounded-2xl p-2.5 sm:p-3 border border-slate-200 dark:border-slate-800/90 flex items-center justify-between gap-2.5 shadow-sm">
          <img
            src={currentPersona?.avatarUrl || 'https://api.dicebear.com/10.x/bottts/svg?seed=guest'}
            alt={currentPersona?.username || 'Guest'}
            className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 object-cover flex-shrink-0"
          />
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex-1 px-3.5 py-2 bg-slate-100 dark:bg-[#0b0f17]/90 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-left rtl:text-right text-xs text-slate-500 dark:text-slate-400 font-medium transition-colors truncate"
          >
            {isArabic ? 'ماذا في بالك؟ اكتب تدوينة <= 280 حرف...' : 'Share a thought or story beat (<= 280 chars)...'}
          </button>
          <Tooltip content={isArabic ? 'فتح استوديو تصميم الميمز' : 'Open Meme Studio Canvas'} position="bottom">
            <button
              onClick={onOpenCanvas}
              className="p-2 bg-indigo-500/10 dark:bg-indigo-600/20 hover:bg-indigo-500/20 dark:hover:bg-indigo-600/30 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 rounded-xl flex-shrink-0 transition-colors shadow-sm"
            >
              <Palette className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>

        {/* Active Hashtag Filter Banner */}
        {selectedHashtag && (
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs text-slate-900 dark:text-white animate-in fade-in slide-in-from-top duration-200">
            <div className="flex items-center gap-2">
              <span className="font-bold flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                <Hash className="w-3.5 h-3.5" />
                {selectedHashtag}
              </span>
              <span className="text-slate-500 text-[11px]">
                ({postList.length} {isArabic ? 'منشور' : 'posts'})
              </span>
            </div>
            <button
              onClick={onClearHashtag}
              className="px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-800 hover:bg-rose-500 hover:text-white text-slate-700 dark:text-slate-300 text-[10px] font-bold transition-colors flex items-center gap-1 active:scale-95"
            >
              <X className="w-3 h-3" />
              <span>{isArabic ? 'إلغاء التصفية' : 'Clear filter'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Isolated Scrollable Posts Stream */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-3 pr-0.5 pb-24 md:pb-8">
        {postList.length === 0 && selectedHashtag && (
          <div className="glass-panel p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3 my-6">
            <Hash className="w-8 h-8 text-indigo-500 mx-auto opacity-60" />
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              {isArabic ? `لا توجد منشورات تحمل الوسم #${selectedHashtag}` : `No posts found with #${selectedHashtag}`}
            </h4>
            <button
              onClick={onClearHashtag}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-colors"
            >
              {isArabic ? 'عرض كل المنشورات' : 'Show all posts'}
            </button>
          </div>
        )}

        {postList.map((post) => {
          if (!post || !post.id) return null;
          return (
            <motion.article
              key={post.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-2xl p-3.5 sm:p-4 space-y-2.5 border border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700/80 transition-all shadow-sm"
            >
              {/* Author Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={post.authorAvatarUrl || `https://api.dicebear.com/10.x/bottts/svg?seed=${post.authorUsername}`}
                    alt={post.authorUsername}
                    className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                        {post.authorDisplayName || post.authorUsername}
                      </span>
                      <span className="text-[10px] text-slate-500 truncate">@{post.authorUsername}</span>
                    </div>
                    <span className="text-[9px] text-slate-500 block">
                      {new Date(post.createdAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {currentPersona && post.authorId !== currentPersona.id &&
                    post.authorUsername.toLowerCase() !== (currentPersona.username || '').toLowerCase() && (
                      <FollowButton
                        targetUserId={post.authorId}
                        targetUsername={post.authorUsername}
                        size="xs"
                      />
                    )}
                  <Tooltip content={isArabic ? 'نسخ نص المنشور' : 'Copy post text'} position="top">
                    <button
                      onClick={() => handleCopyPostText(post.content, post.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      {copiedTextPostId === post.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </Tooltip>
                </div>
              </div>

              {/* Post Content with styled hashtags */}
              <p className="text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 leading-snug font-normal whitespace-pre-wrap px-0.5">
                {renderFormattedContent(post.content)}
              </p>

              {/* Media Attachment (WebP meme or image) */}
              {post.media?.url && (
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800/80 bg-slate-100 dark:bg-[#0b0f17]/90 flex items-center justify-center p-1.5">
                  <img
                    src={getMediaUrl(post.media.url)}
                    alt="Post media"
                    className="w-full h-auto max-h-[420px] object-contain rounded-lg"
                    loading="lazy"
                  />
                </div>
              )}

              {/* Quick Reactions & Action Controls Bar */}
              <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-800/60 flex items-center justify-between gap-2 text-xs flex-wrap">
                <div className="flex items-center gap-1 flex-wrap">
                  {REACTION_TYPES.map((r) => {
                    const reactions = post.reactions || [];
                    const hasReacted = reactions.some(
                      (item) => currentPersona && item.userId === currentPersona.id && item.type.toLowerCase() === r.type.toLowerCase()
                    );
                    const countForType = reactions.filter(
                      (item) => item.type.toLowerCase() === r.type.toLowerCase()
                    ).length;

                    return (
                      <Tooltip
                        key={r.type}
                        content={`${isArabic ? r.labelAr : r.labelEn} (${r.icon})`}
                        position="top"
                      >
                        <button
                          onClick={() => handleReact(post.id, r.type)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border transition-all ${hasReacted
                              ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-700 dark:text-indigo-300 scale-105 shadow-sm'
                              : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                        >
                          <span>{r.icon}</span>
                          {countForType > 0 && <span className="text-[10px] font-bold">{countForType}</span>}
                        </button>
                      </Tooltip>
                    );
                  })}
                </div>

                {/* Action Controls: Comments, Share, Total Reactions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Comments Trigger */}
                  <Tooltip content={isArabic ? 'عرض التعليقات والمناقشة' : 'View comments & discussion'} position="top">
                    <button
                      onClick={() => {
                        setSelectedCommentPost(post);
                        setIsCommentsOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800/80 hover:bg-indigo-500/10 dark:hover:bg-indigo-600/20 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700/80 hover:border-indigo-500/30 transition-all active:scale-95 shadow-sm"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span className="font-bold text-[11px]">{post.commentCount || 0}</span>
                    </button>
                  </Tooltip>

                  {/* Share Link Button */}
                  <Tooltip content={isArabic ? 'مشاركة رابط المنشور' : 'Share post link'} position="top">
                    <button
                      onClick={() => handleCopyPostLink(post.id)}
                      className="p-1.5 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/80 transition-all active:scale-95 shadow-sm"
                    >
                      {copiedPostId === post.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Share2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </Tooltip>

                  {/* Total Reactions Flame Badge */}
                  <Tooltip content={isArabic ? 'إجمالي التفاعلات' : 'Total Reactions'} position="top">
                    <div className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
                      <Flame className="w-3.5 h-3.5" />
                      <span>{post.reactionCount}</span>
                    </div>
                  </Tooltip>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>

      <CreatePostDrawer
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onPostCreated={(newPost) => setPosts((prev) => [newPost, ...(Array.isArray(prev) ? prev : [])])}
        onOpenCanvas={onOpenCanvas}
      />

      <PostCommentsDrawer
        isOpen={isCommentsOpen}
        post={selectedCommentPost}
        onClose={() => {
          setIsCommentsOpen(false);
          setSelectedCommentPost(null);
        }}
        onCommentCountChange={handleCommentCountChange}
      />
    </div>
  );
};
