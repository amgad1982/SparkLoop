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
  Search,
} from 'lucide-react';
import { motion } from 'framer-motion';

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
  onOpenSearch,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';
  const { currentPersona } = useAuthStore();

  const [posts, setPosts] = useState<PostDto[]>(initialPosts);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  // Real-time subscription to feed channel for instant reactions and new posts
  useCentrifugo('feed:global', (data) => {
    if (data.type === 'POST_CREATED' && data.post) {
      const newPost = data.post as PostDto;
      setPosts((prev) => {
        if (prev.some((p) => p.id === newPost.id)) return prev;
        return [newPost, ...prev];
      });
    } else if (data.type === 'POST_REACTED') {
      const { postId, userId, username, reactionType, reactionCount, reactions } = data as unknown as {
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

          // If backend provided authoritative reactions array, use it
          if (reactions && Array.isArray(reactions)) {
            return {
              ...p,
              reactionCount: reactionCount ?? reactions.length,
              reactions,
            };
          }

          // Fallback optimistic delta calculation
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
                id: `rt-${Date.now()}`,
                userId,
                username: username || '',
                type: reactionType,
                createdAtUtc: new Date().toISOString(),
              },
            ];
          }

          return {
            ...p,
            reactionCount: reactionCount ?? newReactions.length,
            reactions: newReactions,
          };
        })
      );
    }
  });

  const handleReact = async (postId: string, reactionType: string) => {
    // 1. Optimistic UI update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const currentReactions = p.reactions || [];
        const existing = currentReactions.find((r) => r.userId === currentPersona.id);
        let updatedReactions: ReactionDto[];

        if (existing) {
          if (existing.type.toLowerCase() === reactionType.toLowerCase()) {
            // Toggle off
            updatedReactions = currentReactions.filter((r) => r.userId !== currentPersona.id);
          } else {
            // Switch reaction type
            updatedReactions = currentReactions.map((r) =>
              r.userId === currentPersona.id ? { ...r, type: reactionType } : r
            );
          }
        } else {
          // Add new reaction
          updatedReactions = [
            ...currentReactions,
            {
              id: `temp-${Date.now()}`,
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

    // 2. Network call to backend
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
            className="font-semibold text-zinc-900 dark:text-white cursor-pointer hover:opacity-75 active:scale-95 transition-all inline-block hover:underline"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const displayedPosts = selectedHashtag
    ? posts.filter((p) => p.content.toLowerCase().includes('#' + selectedHashtag.toLowerCase()))
    : posts;

  return (
    <div className="h-full flex flex-col overflow-hidden text-zinc-900 dark:text-white transition-colors duration-200">
      {/* 1. Isolated Fixed Creator Bar & Active Filter Bar */}
      <div className="shrink-0 pb-3 z-10 space-y-2">
        <div className="glass-panel bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-2xl p-2.5 sm:p-3 border border-zinc-200 dark:border-zinc-800/90 flex items-center justify-between gap-2.5 shadow-md">
          <img
            src={currentPersona.avatarUrl}
            alt={currentPersona.username}
            className="w-8 h-8 rounded-full border border-zinc-300 dark:border-zinc-700 object-cover flex-shrink-0"
          />
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex-1 px-3.5 py-2 bg-zinc-100 dark:bg-zinc-950/80 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800/80 rounded-xl text-left rtl:text-right text-xs text-zinc-500 dark:text-zinc-400 font-medium transition-colors truncate"
          >
            {isArabic ? 'ماذا في بالك؟ اكتب تدوينة <= 280 حرف...' : 'Share a thought or story beat (<= 280 chars)...'}
          </button>
          <Tooltip content={isArabic ? 'فتح استوديو تصميم الميمز' : 'Open Meme Studio Canvas'} position="bottom">
            <button
              onClick={onOpenCanvas}
              className="p-2 bg-fuchsia-500/10 dark:bg-fuchsia-600/20 hover:bg-fuchsia-500/20 dark:hover:bg-fuchsia-600/30 text-fuchsia-600 dark:text-fuchsia-300 border border-fuchsia-500/30 rounded-xl flex-shrink-0 transition-colors shadow-sm"
            >
              <Palette className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>

        {/* Active Hashtag Filter Banner */}
        {selectedHashtag && (
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-gradient-to-r from-fuchsia-500/10 to-purple-500/10 border border-fuchsia-500/30 text-xs text-zinc-900 dark:text-white animate-in fade-in slide-in-from-top duration-200">
            <div className="flex items-center gap-2">
              <span className="font-bold flex items-center gap-1 text-fuchsia-600 dark:text-fuchsia-400">
                <Hash className="w-3.5 h-3.5" />
                {selectedHashtag}
              </span>
              <span className="text-zinc-500 text-[11px]">
                ({displayedPosts.length} {isArabic ? 'منشور' : 'posts'})
              </span>
            </div>
            <button
              onClick={onClearHashtag}
              className="px-2.5 py-1 rounded-lg bg-zinc-200/80 dark:bg-zinc-800 hover:bg-rose-500 hover:text-white text-zinc-700 dark:text-zinc-300 text-[10px] font-bold transition-colors flex items-center gap-1 active:scale-95"
            >
              <X className="w-3 h-3" />
              <span>{isArabic ? 'إلغاء التصفية' : 'Clear filter'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Isolated Scrollable Posts Stream */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-3 pr-0.5 pb-24 md:pb-8">
        {displayedPosts.length === 0 && selectedHashtag && (
          <div className="glass-panel p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-center space-y-3 my-6">
            <Hash className="w-8 h-8 text-fuchsia-500 mx-auto opacity-60" />
            <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
              {isArabic ? `لا توجد منشورات تحمل الوسم #${selectedHashtag}` : `No posts found with #${selectedHashtag}`}
            </h4>
            <button
              onClick={onClearHashtag}
              className="px-3.5 py-1.5 rounded-xl bg-fuchsia-600 text-white text-xs font-bold hover:bg-fuchsia-500 transition-colors"
            >
              {isArabic ? 'عرض كل المنشورات' : 'Show all posts'}
            </button>
          </div>
        )}

        {displayedPosts.map((post) => (
          <motion.article
            key={post.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl p-3.5 sm:p-4 space-y-2.5 border border-zinc-200/80 dark:border-zinc-800/70 hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-all shadow-sm"
          >
            {/* Author Header */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={post.authorAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${post.authorUsername}`}
                  alt={post.authorUsername}
                  className="w-8 h-8 rounded-full border border-zinc-300 dark:border-zinc-700 object-cover shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                      {post.authorDisplayName || post.authorUsername}
                    </span>
                    <span className="text-[10px] text-zinc-500 truncate">@{post.authorUsername}</span>
                  </div>
                  <span className="text-[9px] text-zinc-500 block">
                    {new Date(post.createdAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {post.authorId !== currentPersona.id &&
                post.authorUsername.toLowerCase() !== currentPersona.username.toLowerCase() && (
                  <FollowButton
                    targetUserId={post.authorId}
                    targetUsername={post.authorUsername}
                    size="xs"
                  />
                )}
            </div>

            {/* Post Content with styled hashtags */}
            <p className="text-xs sm:text-[13px] text-zinc-800 dark:text-zinc-100 leading-snug font-normal whitespace-pre-wrap px-0.5">
              {renderFormattedContent(post.content)}
            </p>

            {/* Media Attachment (WebP meme or image) */}
            {post.media?.url && (
              <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800/70 bg-zinc-100 dark:bg-zinc-950/80 flex items-center justify-center p-1.5">
                <img
                  src={getMediaUrl(post.media.url)}
                  alt="Post media"
                  className="w-full h-auto max-h-[420px] object-contain rounded-lg"
                  loading="lazy"
                />
              </div>
            )}

            {/* Quick Reactions Bar */}
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1 flex-wrap">
                {REACTION_TYPES.map((r) => {
                  const reactions = post.reactions || [];
                  const hasReacted = reactions.some(
                    (item) => item.userId === currentPersona.id && item.type.toLowerCase() === r.type.toLowerCase()
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
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border transition-all ${
                          hasReacted
                            ? 'bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-600 dark:text-fuchsia-300 scale-105 shadow-sm'
                            : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <span>{r.icon}</span>
                        {countForType > 0 && <span className="text-[10px] font-bold">{countForType}</span>}
                      </button>
                    </Tooltip>
                  );
                })}
              </div>

              <Tooltip content={isArabic ? 'إجمالي التفاعلات' : 'Total Reactions'} position="top">
                <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
                  <span className="flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    <span className="font-bold text-zinc-700 dark:text-zinc-300 text-xs">{post.reactionCount}</span>
                  </span>
                </div>
              </Tooltip>
            </div>
          </motion.article>
        ))}
      </div>

      <CreatePostDrawer
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onPostCreated={(newPost) => setPosts([newPost, ...posts])}
        onOpenCanvas={onOpenCanvas}
      />
    </div>
  );
};
