import React, { useState, useEffect, useRef } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { api } from '../../services/apiClient';
import { GlobalSearchResultDto, HashtagDto } from '../../types/api';
import { FollowButton } from '../ui/FollowButton';
import { TabType } from '../layout/BottomNavBar';
import {
  Search,
  X,
  Clock,
  TrendingUp,
  MessageSquare,
  Users,
  Radio,
  GitBranch,
  Flame,
  Hash,
  Loader2,
  Lock,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: TabType | 'profile') => void;
  onNavigateProfile?: (username: string) => void;
  onSelectHashtag: (tag: string) => void;
  onSelectPodId?: (podId: string) => void;
  initialQuery?: string;
}

type SearchCategory = 'all' | 'posts' | 'users' | 'pods' | 'chains' | 'hashtags';

const RECENT_SEARCHES_KEY = 'sparkloop_recent_searches';

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onNavigateProfile,
  onSelectHashtag,
  onSelectPodId,
  initialQuery = '',
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  const [query, setQuery] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState<SearchCategory>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<GlobalSearchResultDto | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      return saved ? JSON.parse(saved) : ['#sparkloop', '#meme', '#design', 'alice'];
    } catch {
      return ['#sparkloop', '#meme', '#design', 'alice'];
    }
  });

  const [trendingTags, setTrendingTags] = useState<HashtagDto[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync initial query if passed
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);

      // Load trending tags
      api.getTrendingHashtags(6)
        .then((tags) => setTrendingTags(tags || []))
        .catch(() => {});
    }
  }, [isOpen]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search query
  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const data = await api.globalSearch(query.trim(), activeCategory);
        setResults(data);

        // Save to recent searches
        if (query.trim().length >= 2) {
          setRecentSearches((prev) => {
            const clean = query.trim();
            const filtered = prev.filter((s) => s.toLowerCase() !== clean.toLowerCase());
            const next = [clean, ...filtered].slice(0, 8);
            try {
              localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
            } catch {}
            return next;
          });
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [query, activeCategory]);

  const handleClearRecent = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {}
  };

  const handleRemoveRecentItem = (item: string) => {
    setRecentSearches((prev) => {
      const next = prev.filter((s) => s !== item);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleHashtagClick = (tag: string) => {
    const cleanTag = tag.replace(/^#/, '');
    onSelectHashtag(cleanTag);
    onNavigateTab('feed');
    onClose();
  };

  const handlePodClick = (podId: string) => {
    if (onSelectPodId) onSelectPodId(podId);
    onNavigateTab('pods');
    onClose();
  };

  if (!isOpen) return null;

  const categories: { id: SearchCategory; labelEn: string; labelAr: string; icon: React.ElementType; count?: number }[] = [
    { id: 'all', labelEn: 'All', labelAr: 'الكل', icon: Search, count: results?.totalCount },
    { id: 'posts', labelEn: 'Posts & Memes', labelAr: 'المشاركات والميمز', icon: MessageSquare, count: results?.posts.length },
    { id: 'users', labelEn: 'Creators', labelAr: 'المبدعين', icon: Users, count: results?.users.length },
    { id: 'pods', labelEn: 'Mood Pods', labelAr: 'غرف المزاج', icon: Radio, count: results?.moodPods.length },
    { id: 'chains', labelEn: 'Story Chains', labelAr: 'سلاسل المايك', icon: GitBranch, count: results?.chains.length },
    { id: 'hashtags', labelEn: 'Hashtags', labelAr: 'الوسوم', icon: Hash, count: results?.hashtags.length },
  ];

  return (
    <div className="fixed inset-0 z-[99999] flex items-start justify-center p-4 sm:p-6 md:p-12 overflow-y-auto bg-black/60 backdrop-blur-sm transition-all">
      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        className="w-full max-w-2xl bg-white dark:bg-[#131b28] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden flex flex-col my-auto transition-colors"
      >
        {/* Search Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
            <Search className="w-5 h-5" />
          </div>

          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                isArabic
                  ? 'ابحث عن منشورات، مبدعين، غرف صوتية، وسوم #...'
                  : 'Search posts, creators, voice pods, chains, #tags...'
              }
              className="w-full bg-transparent text-sm sm:text-base font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none border-none pr-8"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {isLoading ? (
            <Loader2 className="w-5 h-5 text-indigo-500 animate-spin shrink-0" />
          ) : (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 overflow-x-auto border-b border-slate-200 dark:border-slate-800/60 no-scrollbar bg-slate-50/50 dark:bg-[#0b0f17]/40">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{isArabic ? cat.labelAr : cat.labelEn}</span>
                {cat.count !== undefined && cat.count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 text-[10px] rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {cat.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="max-h-[60vh] overflow-y-auto p-4 sm:p-5 space-y-6">
          {/* Empty State / Suggestions */}
          {!query.trim() && (
            <div className="space-y-6">
              {/* Trending Hashtags */}
              {trendingTags.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{isArabic ? 'الوسوم الأكثر رواجاً اليوم' : 'Trending Hashtags'}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {trendingTags.map((t) => (
                      <button
                        key={t.tag}
                        onClick={() => handleHashtagClick(t.tag)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500/10 hover:border-indigo-500/40 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-colors group"
                      >
                        <Hash className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{t.tag}</span>
                        <span className="text-[10px] text-slate-400">({t.count})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{isArabic ? 'عمليات البحث الأخيرة' : 'Recent Searches'}</span>
                    </div>
                    <button
                      onClick={handleClearRecent}
                      className="text-[11px] font-semibold text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      {isArabic ? 'مسح الكل' : 'Clear all'}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((s) => (
                      <div
                        key={s}
                        className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2"
                      >
                        <button
                          onClick={() => setQuery(s)}
                          className="hover:text-indigo-500 transition-colors"
                        >
                          {s}
                        </button>
                        <button
                          onClick={() => handleRemoveRecentItem(s)}
                          className="text-slate-400 hover:text-rose-500 opacity-60 hover:opacity-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results Display */}
          {query.trim() && results && (
            <div className="space-y-6">
              {results.totalCount === 0 && !isLoading && (
                <div className="text-center py-10 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                    <Search className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {isArabic ? `لا توجد نتائج لـ "${query}"` : `No results found for "${query}"`}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    {isArabic
                      ? 'جرب البحث بكلمات مختلفة أو تصفح الوسوم الشائعة'
                      : 'Try searching with different keywords or exploring popular tags'}
                  </p>
                </div>
              )}

              {/* 1. Creators Section */}
              {results.users.length > 0 && (activeCategory === 'all' || activeCategory === 'users') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{isArabic ? 'المبدعين' : 'Creators & Users'}</span>
                    </h4>
                    <span className="text-[11px] font-bold text-slate-400">{results.users.length}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {results.users.map((user) => (
                      <div
                        key={user.id}
                        className="glass-panel p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 hover:border-indigo-500/40 transition-colors group"
                      >
                        <div
                          onClick={() => {
                            if (onNavigateProfile) {
                              onNavigateProfile(user.username);
                            } else {
                              onNavigateTab('profile');
                            }
                            onClose();
                          }}
                          className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1"
                        >
                          <img
                            src={user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
                            alt={user.username}
                            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 object-cover shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-400 transition-colors">
                                {user.displayName || user.username}
                              </span>
                              {user.isPrivateProfile && (
                                <span
                                  title={isArabic ? 'حساب خاص' : 'Private Account'}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold shrink-0"
                                >
                                  <Lock className="w-2.5 h-2.5" />
                                  <span>{isArabic ? 'خاص' : 'Private'}</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">@{user.username}</div>
                            {user.bio && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 max-w-[180px]">
                                {user.bio}
                              </p>
                            )}
                          </div>
                        </div>

                        <FollowButton
                          targetUserId={user.id}
                          targetUsername={user.username}
                          size="xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Posts & Memes Section */}
              {results.posts.length > 0 && (activeCategory === 'all' || activeCategory === 'posts') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{isArabic ? 'المشاركات والميمز' : 'Posts & Memes'}</span>
                    </h4>
                    <span className="text-[11px] font-bold text-slate-400">{results.posts.length}</span>
                  </div>

                  <div className="space-y-2.5">
                    {results.posts.map((post) => (
                      <div
                        key={post.id}
                        onClick={() => {
                          onNavigateTab('feed');
                          onClose();
                        }}
                        className="glass-panel p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 cursor-pointer transition-colors space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <img
                              src={post.authorAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${post.authorUsername}`}
                              alt={post.authorUsername}
                              className="w-6 h-6 rounded-lg object-cover"
                            />
                            <span className="font-bold text-slate-900 dark:text-white">{post.authorDisplayName}</span>
                            <span className="text-slate-400">@{post.authorUsername}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {new Date(post.createdAtUtc).toLocaleDateString()}
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed">
                          {post.content}
                        </p>

                        {post.media && (
                          <div className="w-full max-h-32 rounded-xl overflow-hidden bg-black/20 border border-slate-200 dark:border-slate-800">
                            <img
                              src={api.getMediaUrl(post.media.url)}
                              alt="media preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1 font-semibold text-amber-500">
                            <Flame className="w-3.5 h-3.5" />
                            {post.reactionCount}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Mood Pods Section */}
              {results.moodPods.length > 0 && (activeCategory === 'all' || activeCategory === 'pods') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-sky-500" />
                      <span>{isArabic ? 'غرف المزاج الصوتية' : 'Mood Pods'}</span>
                    </h4>
                    <span className="text-[11px] font-bold text-slate-400">{results.moodPods.length}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {results.moodPods.map((pod) => (
                      <div
                        key={pod.id}
                        onClick={() => handlePodClick(pod.id)}
                        className="glass-panel p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 cursor-pointer transition-colors flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl shrink-0 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800">{pod.moodEmoji}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-400 transition-colors">
                              {pod.title}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {isArabic ? 'المضيف:' : 'Host:'} {pod.hostDisplayName}
                            </div>
                          </div>
                        </div>

                        <div className="px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold shrink-0">
                          {isArabic ? 'انضمام' : 'Join'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Story Chains Section */}
              {results.chains.length > 0 && (activeCategory === 'all' || activeCategory === 'chains') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{isArabic ? 'سلاسل المايك التفاعلية' : 'Pass-the-Mic Chains'}</span>
                    </h4>
                    <span className="text-[11px] font-bold text-slate-400">{results.chains.length}</span>
                  </div>

                  <div className="space-y-2.5">
                    {results.chains.map((chain) => (
                      <div
                        key={chain.id}
                        onClick={() => {
                          onNavigateTab('chains');
                          onClose();
                        }}
                        className="glass-panel p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 cursor-pointer transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {chain.title}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {isArabic
                              ? `${chain.currentStepCount} من ${chain.maxSteps} أدوار مكتملة`
                              : `${chain.currentStepCount} of ${chain.maxSteps} turns completed`}
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold shrink-0">
                          {chain.theme}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. Hashtags Section */}
              {results.hashtags.length > 0 && (activeCategory === 'all' || activeCategory === 'hashtags') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{isArabic ? 'الوسوم المطابقة' : 'Hashtags'}</span>
                    </h4>
                    <span className="text-[11px] font-bold text-slate-400">{results.hashtags.length}</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {results.hashtags.map((h) => (
                      <button
                        key={h.tag}
                        onClick={() => handleHashtagClick(h.tag)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500/10 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
                      >
                        <Hash className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{h.tag}</span>
                        <span className="text-[10px] text-slate-400">({h.count})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#0b0f17]/60 flex items-center justify-between text-[11px] text-slate-400">
          <span>{isArabic ? 'اضغط ESC للإغلاق' : 'Press ESC to close'}</span>
          <span className="flex items-center gap-1 font-mono">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300">
              Ctrl
            </kbd>
            +
            <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300">
              K
            </kbd>
          </span>
        </div>
      </motion.div>
    </div>
  );
};
