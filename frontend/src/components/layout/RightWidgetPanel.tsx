import React, { useEffect, useState } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { TabType } from './BottomNavBar';
import { SparkDto, MoodPodDto, UserDto, HashtagDto } from '../../types/api';
import { api } from '../../services/apiClient';
import { Tooltip } from '../ui/Tooltip';
import { FollowButton } from '../ui/FollowButton';
import {
  Flame,
  Radio,
  Trophy,
  Users,
  Clock,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Hash,
} from 'lucide-react';

interface RightWidgetPanelProps {
  activeSpark?: SparkDto | null;
  pods?: MoodPodDto[];
  topCreators?: UserDto[];
  onNavigateTab: (tab: TabType) => void;
  onSelectHashtag?: (tag: string) => void;
}

const DEFAULT_TRENDING_TAGS: HashtagDto[] = [
  { tag: 'meme', count: 14, lastUsedAtUtc: new Date().toISOString() },
  { tag: 'sparkloop', count: 11, lastUsedAtUtc: new Date().toISOString() },
  { tag: 'humor', count: 8, lastUsedAtUtc: new Date().toISOString() },
  { tag: 'storytime', count: 6, lastUsedAtUtc: new Date().toISOString() },
  { tag: 'dailyvibes', count: 5, lastUsedAtUtc: new Date().toISOString() },
];

const DEFAULT_CREATORS: UserDto[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    username: 'alice',
    email: 'alice@sparkloop.app',
    displayName: 'Alice Wonder 🎨',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=alice',
    repScore: 360,
    badges: [],
    createdAtUtc: new Date().toISOString(),
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    username: 'noor',
    email: 'noor@sparkloop.app',
    displayName: 'نور العرّاف 🌟',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=noor',
    repScore: 345,
    badges: [],
    createdAtUtc: new Date().toISOString(),
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    username: 'tariq',
    email: 'tariq@sparkloop.app',
    displayName: 'طارق صانع الميمز ⚡',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=tariq',
    repScore: 310,
    badges: [],
    createdAtUtc: new Date().toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    username: 'bob',
    email: 'bob@sparkloop.app',
    displayName: 'Bob The Bard 🎸',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=bob',
    repScore: 230,
    badges: [],
    createdAtUtc: new Date().toISOString(),
  },
];

export const RightWidgetPanel: React.FC<RightWidgetPanelProps> = ({
  activeSpark,
  pods = [],
  topCreators = [],
  onNavigateTab,
  onSelectHashtag,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';
  const [trendingTags, setTrendingTags] = useState<HashtagDto[]>([]);
  const [countdown, setCountdown] = useState<string>('24:00:00');

  useEffect(() => {
    const updateCountdown = () => {
      if (!activeSpark) {
        setCountdown('24:00:00');
        return;
      }

      if (activeSpark.status === 'Completed') {
        setCountdown(isArabic ? 'انتهى التحدي' : 'Ended');
        return;
      }

      if (activeSpark.activeUntilUtc) {
        const target = new Date(activeSpark.activeUntilUtc).getTime();
        if (!isNaN(target)) {
          const diffMs = target - Date.now();
          if (diffMs <= 0) {
            setCountdown(isArabic ? 'انتهى التحدي' : '00:00:00');
            return;
          }
          const totalSec = Math.floor(diffMs / 1000);
          const hours = Math.floor(totalSec / 3600);
          const minutes = Math.floor((totalSec % 3600) / 60);
          const seconds = totalSec % 60;
          setCountdown(
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
          );
          return;
        }
      }

      if (activeSpark.timeRemaining) {
        setCountdown(String(activeSpark.timeRemaining).split('.')[0]);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [activeSpark?.activeUntilUtc, activeSpark?.status, activeSpark?.timeRemaining, isArabic]);

  useEffect(() => {
    api.getTrendingHashtags(5)
      .then((data) => {
        if (data && data.length > 0) {
          setTrendingTags(data);
        } else {
          setTrendingTags(DEFAULT_TRENDING_TAGS);
        }
      })
      .catch((err) => {
        console.error('Failed to load trending tags for widget:', err);
        setTrendingTags(DEFAULT_TRENDING_TAGS);
      });
  }, []);

  const displayTags = trendingTags.length > 0 ? trendingTags : DEFAULT_TRENDING_TAGS;
  const displayCreators = topCreators.length > 0 ? topCreators.slice(0, 4) : DEFAULT_CREATORS;

  return (
    <aside className="hidden lg:flex flex-col gap-4 w-72 xl:w-80 h-full p-4 xl:p-5 pb-10 border-l rtl:border-l-0 rtl:border-r border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-[#0b0f17]/95 overflow-y-auto overflow-x-hidden no-scrollbar shrink-0 select-none transition-colors duration-200">
      {/* Widget 1: 24h Synchronized Daily Spark Challenge */}
      <div className="glass-card rounded-3xl p-4 xl:p-5 border border-slate-200 dark:border-slate-800/80 shadow-md relative overflow-hidden group space-y-3 shrink-0 transition-colors">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Flame className="w-4 h-4" />
            </div>
            <span className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              {isArabic ? 'تحدي اليوم (24h)' : 'Daily Spark'}
            </span>
          </div>

          <Tooltip content={isArabic ? 'الوقت المتبقي لانتهاء التحدي وتتويج البطل' : 'Time left before winner crowning'} position="left">
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              <Clock className="w-3 h-3" />
              {countdown}
            </span>
          </Tooltip>
        </div>

        <div className="space-y-2.5">
          <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 line-clamp-1">
            {activeSpark?.title || (isArabic ? '🔥 تحدي الجمعة: ميمز المطورين 2026' : '🔥 Friday Meme Mania 2026')}
          </h4>
          <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 leading-snug line-clamp-2">
            {activeSpark?.prompt || (isArabic ? 'صمم ميم يجسد أخطاء الإنتاج قبل عطلة نهاية الأسبوع!' : 'Craft or draw a meme showing how you handle production bugs at 5 PM on a Friday!')}
          </p>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800/60">
            <span className="font-semibold">{activeSpark?.submissions?.length || 4} {isArabic ? 'مشاركات' : 'entries'}</span>
            <Tooltip content={isArabic ? 'الانتقال لصفحة التحدي والتصويت أو المشاركة' : 'Go to Daily Spark page'} position="top">
              <button
                onClick={() => onNavigateTab('sparks')}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform"
              >
                <span>{isArabic ? 'شارك الآن' : 'Join Challenge'}</span>
                <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Widget 2: Trending Hashtags */}
      <div className="glass-card rounded-3xl p-4 xl:p-5 border border-slate-200 dark:border-slate-800/80 shadow-md space-y-3 shrink-0 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Hash className="w-4 h-4" />
            </div>
            <span className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              {isArabic ? 'الوسوم الأكثر تداولاً' : 'Trending Tags'}
            </span>
          </div>

          <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
        </div>

        <div className="space-y-1.5">
          {displayTags.map((tag) => (
            <Tooltip key={tag.tag} content={`${isArabic ? 'تصفح تدوينات' : 'Browse posts in'} #${tag.tag}`} position="top" className="w-full">
              <button
                onClick={() => {
                  if (onSelectHashtag) {
                    onSelectHashtag(tag.tag);
                  }
                  onNavigateTab('feed');
                }}
                className="w-full p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/80 hover:border-indigo-500/40 transition-all flex items-center justify-between text-left rtl:text-right group shadow-sm"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-indigo-600 dark:text-indigo-400 font-black text-xs">#</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white truncate">
                    {tag.tag}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                  <Flame className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                  <span>{tag.count}</span>
                </div>
              </button>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Widget 3: Live Ephemeral Mood Pods */}
      <div className="glass-card rounded-3xl p-4 xl:p-5 border border-slate-200 dark:border-slate-800/80 shadow-md space-y-3 shrink-0 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              <Radio className="w-4 h-4" />
            </div>
            <span className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              {isArabic ? 'حجرات المزاج' : 'Mood Pods'}
            </span>
          </div>

          <span className="w-2 h-2 rounded-full bg-sky-500 dark:bg-sky-400 animate-pulse" />
        </div>

        <div className="space-y-2">
          {pods.length > 0 ? (
            pods.slice(0, 3).map((pod) => (
              <Tooltip key={pod.id} content={isArabic ? `دخول حجرة ${pod.title}` : `Join ${pod.title}`} position="top" className="w-full">
                <button
                  onClick={() => onNavigateTab('pods')}
                  className="w-full p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/80 hover:border-sky-500/40 transition-all flex items-center justify-between text-left rtl:text-right group shadow-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg p-1 bg-white dark:bg-[#0e1520] rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
                      {pod.moodEmoji}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white truncate">
                        {pod.title}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        @{pod.hostUsername}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] font-bold text-sky-600 dark:text-sky-400 shrink-0">
                    <Users className="w-3 h-3" />
                    <span>{pod.activeParticipantCount}</span>
                  </div>
                </button>
              </Tooltip>
            ))
          ) : (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/80 text-center space-y-2">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {isArabic ? 'استكشف غرف المزاج الصوتية الحية' : 'Explore live audio mood rooms'}
              </p>
              <button
                onClick={() => onNavigateTab('pods')}
                className="w-full py-1.5 px-3 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30 rounded-xl text-xs font-bold transition-all"
              >
                {isArabic ? 'فتح حجرات المزاج 🎙️' : 'Explore Pods 🎙️'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Widget 4: Top Creators Leaderboard */}
      <div className="glass-card rounded-3xl p-4 xl:p-5 border border-slate-200 dark:border-slate-800/80 shadow-md space-y-3 shrink-0 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Trophy className="w-4 h-4" />
            </div>
            <span className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              {isArabic ? 'لوحة المبدعين' : 'Top Creators'}
            </span>
          </div>

          <TrendingUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
        </div>

        <div className="space-y-2 w-full">
          {displayCreators.map((user, idx) => {
            const medals = ['🥇', '🥈', '🥉', '✨'];
            return (
              <Tooltip key={user.id} content={`${user.displayName} (@${user.username}) - ${user.repScore} XP`} position="top" className="w-full block">
                <div
                  className="w-full p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-2 shadow-sm transition-all hover:border-indigo-500/40"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-sm font-bold shrink-0 w-5 text-center">{medals[idx] || '✨'}</span>
                    <img
                      src={user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
                      alt={user.username}
                      className="w-7 h-7 rounded-xl bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {user.displayName}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        @{user.username}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 rounded-full border border-indigo-500/20 hidden xs:inline-block">
                      {user.repScore} XP
                    </span>
                    <FollowButton
                      targetUserId={user.id}
                      targetUsername={user.username}
                      size="xs"
                    />
                  </div>
                </div>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
