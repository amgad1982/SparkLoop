import React, { useState, useEffect } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { PostDto } from '../../types/api';
import { api } from '../../services/apiClient';
import { CreatePostDrawer } from './CreatePostDrawer';
import { Flame, Heart, Lightbulb, MessageCircle, MessageSquarePlus, Palette, Repeat, Share2, Sparkles, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

interface FeedViewProps {
  initialPosts: PostDto[];
  onOpenCanvas: () => void;
}

const REACTION_TYPES = [
  { type: 'fire', icon: '🔥', label: 'Fire' },
  { type: 'spark', icon: '⚡', label: 'Spark' },
  { type: 'laugh', icon: '😂', label: 'Funny' },
  { type: 'mindblown', icon: '🤯', label: 'Mindblown' },
  { type: 'heart', icon: '❤️', label: 'Love' },
];

export const FeedView: React.FC<FeedViewProps> = ({ initialPosts, onOpenCanvas }) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';
  const { currentPersona } = useAuthStore();

  const [posts, setPosts] = useState<PostDto[]>(initialPosts);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  const handleReact = async (postId: string, reactionType: string) => {
    try {
      const updated = await api.reactToPost(postId, reactionType);
      setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
    } catch (err) {
      console.error('React error:', err);
    }
  };

  return (
    <div className="space-y-4 text-white">
      {/* Feed Quick Creator Bar */}
      <div className="glass-card rounded-3xl p-3.5 border border-zinc-800/80 flex items-center justify-between gap-3 shadow-lg">
        <img
          src={currentPersona.avatarUrl}
          alt={currentPersona.username}
          className="w-9 h-9 rounded-full border border-zinc-700 object-cover flex-shrink-0"
        />
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex-1 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 rounded-2xl text-left rtl:text-right text-xs text-zinc-400 font-medium transition-colors"
        >
          {isArabic ? 'ماذا في بالك؟ اكتب تدوينة <= 280 حرف...' : 'Share a thought or story beat (<= 280 chars)...'}
        </button>
        <button
          onClick={onOpenCanvas}
          className="p-2.5 bg-fuchsia-600/20 hover:bg-fuchsia-600/30 text-fuchsia-300 border border-fuchsia-500/30 rounded-2xl flex-shrink-0 transition-colors"
          title="Open Meme Canvas"
        >
          <Palette className="w-4 h-4" />
        </button>
      </div>

      {/* Posts Stream */}
      <div className="space-y-4">
        {posts.map((post) => (
          <motion.article
            key={post.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-3xl p-4.5 space-y-3 border border-zinc-800/80 hover:border-zinc-700/80 transition-all shadow-md"
          >
            {/* Author Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img
                  src={post.authorAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${post.authorUsername}`}
                  alt={post.authorUsername}
                  className="w-9 h-9 rounded-full border border-zinc-700 object-cover"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-zinc-100">
                      {post.authorDisplayName || post.authorUsername}
                    </span>
                    <span className="text-[10px] text-zinc-500">@{post.authorUsername}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">
                    {new Date(post.createdAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Post Content */}
            <p className="text-xs text-zinc-100 leading-relaxed font-normal whitespace-pre-wrap">
              {post.content}
            </p>

            {/* Media Attachment (WebP meme or image) */}
            {post.media?.url && (
              <div className="rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-950 max-h-96 flex items-center justify-center">
                <img
                  src={post.media.url.startsWith('/') ? `http://localhost:5000${post.media.url}` : post.media.url}
                  alt="Post media"
                  className="w-full h-auto object-cover max-h-96"
                />
              </div>
            )}

            {/* Quick Reactions Bar */}
            <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                {REACTION_TYPES.map((r) => {
                  const hasReacted = post.reactions.some(
                    (item) => item.userId === currentPersona.id && item.type === r.type
                  );
                  const countForType = post.reactions.filter((item) => item.type === r.type).length;

                  return (
                    <button
                      key={r.type}
                      onClick={() => handleReact(post.id, r.type)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                        hasReacted
                          ? 'bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-300 scale-105'
                          : 'bg-zinc-900 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                      }`}
                    >
                      <span>{r.icon}</span>
                      {countForType > 0 && <span className="text-[10px] font-bold">{countForType}</span>}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 text-zinc-500 text-xs">
                <span className="flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-bold text-zinc-300">{post.reactionCount}</span>
                </span>
              </div>
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
