import React from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { TabType } from './BottomNavBar';
import { SparkDto, MoodPodDto, UserDto } from '../../types/api';
import {
  Flame,
  Radio,
  Trophy,
  Users,
  Clock,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Award,
} from 'lucide-react';

interface RightWidgetPanelProps {
  activeSpark?: SparkDto | null;
  pods?: MoodPodDto[];
  topCreators?: UserDto[];
  onNavigateTab: (tab: TabType) => void;
}

export const RightWidgetPanel: React.FC<RightWidgetPanelProps> = ({
  activeSpark,
  pods = [],
  topCreators = [],
  onNavigateTab,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  return (
    <aside className="hidden xl:flex flex-col gap-5 w-80 h-screen sticky top-0 p-4 border-l rtl:border-l-0 rtl:border-r border-zinc-800/80 bg-zinc-950/95 overflow-y-auto no-scrollbar shrink-0 select-none">
      {/* Widget 1: 24h Synchronized Daily Spark Challenge */}
      <div className="glass-card rounded-3xl p-4 border border-zinc-800/80 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Flame className="w-4 h-4" />
            </div>
            <span className="text-xs font-black text-zinc-100 uppercase tracking-wider">
              {isArabic ? 'تحدي اليوم (24h)' : 'Daily Spark'}
            </span>
          </div>

          <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
            <Clock className="w-3 h-3" />
            {activeSpark?.timeRemaining || '24:00:00'}
          </span>
        </div>

        {activeSpark ? (
          <div className="space-y-3">
            <p className="text-xs font-bold text-zinc-200 leading-snug line-clamp-2">
              "{activeSpark.prompt}"
            </p>

            <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-800/60">
              <span>{activeSpark.submissions?.length || 0} {isArabic ? 'مشاركة' : 'entries'}</span>
              <button
                onClick={() => onNavigateTab('sparks')}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform"
              >
                <span>{isArabic ? 'شارك الآن' : 'Join Challenge'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            {isArabic ? 'جاري تحميل تحدي اليوم...' : 'Loading daily spark...'}
          </p>
        )}
      </div>

      {/* Widget 2: Live Ephemeral Mood Pods */}
      <div className="glass-card rounded-3xl p-4 border border-zinc-800/80 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Radio className="w-4 h-4" />
            </div>
            <span className="text-xs font-black text-zinc-100 uppercase tracking-wider">
              {isArabic ? 'حجرات المزاج' : 'Mood Pods'}
            </span>
          </div>

          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        </div>

        <div className="space-y-2">
          {pods.length > 0 ? (
            pods.slice(0, 3).map((pod) => (
              <button
                key={pod.id}
                onClick={() => onNavigateTab('pods')}
                className="w-full p-2.5 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800/80 hover:border-cyan-500/40 transition-all flex items-center justify-between text-left rtl:text-right group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xl p-1.5 bg-zinc-950 rounded-xl border border-zinc-800 shrink-0">
                    {pod.moodEmoji}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-zinc-200 group-hover:text-white truncate">
                      {pod.title}
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate">
                      @{pod.hostUsername}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] font-bold text-cyan-400 shrink-0">
                  <Users className="w-3 h-3" />
                  <span>{pod.activeParticipantCount}</span>
                </div>
              </button>
            ))
          ) : (
            <p className="text-xs text-zinc-500">
              {isArabic ? 'لا توجد حجرات نشطة حالياً' : 'No active pods right now'}
            </p>
          )}
        </div>
      </div>

      {/* Widget 3: Top Creators Leaderboard */}
      <div className="glass-card rounded-3xl p-4 border border-zinc-800/80 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30">
              <Trophy className="w-4 h-4" />
            </div>
            <span className="text-xs font-black text-zinc-100 uppercase tracking-wider">
              {isArabic ? 'لوحة المبدعين' : 'Top Creators'}
            </span>
          </div>

          <TrendingUp className="w-3.5 h-3.5 text-fuchsia-400" />
        </div>

        <div className="space-y-2">
          {topCreators.slice(0, 4).map((user, idx) => {
            const medals = ['🥇', '🥈', '🥉', '✨'];
            return (
              <div
                key={user.id}
                className="p-2.5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base font-bold shrink-0">{medals[idx]}</span>
                  <img
                    src={user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
                    alt={user.username}
                    className="w-7 h-7 rounded-xl bg-zinc-800 border border-zinc-700 object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-zinc-200 truncate">
                      {user.displayName}
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate">
                      @{user.username}
                    </div>
                  </div>
                </div>

                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-fuchsia-500/10 text-fuchsia-300 rounded-full border border-fuchsia-500/20 shrink-0">
                  {user.repScore} XP
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
