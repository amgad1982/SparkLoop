import React from 'react';
import { TabType } from './BottomNavBar';
import { useThemeStore } from '../../stores/useThemeStore';
import { Tooltip } from '../ui/Tooltip';
import {
  Flame,
  GitBranch,
  MessageSquare,
  Moon,
  Palette,
  Radio,
  Sparkles,
  Sun,
  User,
  Zap,
  Search,
} from 'lucide-react';

interface DesktopHeaderProps {
  activeTab: TabType | 'profile';
  onNavigateTab: (tab: TabType | 'profile') => void;
  isConnected?: boolean;
  onOpenSearch?: () => void;
}

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({
  activeTab,
  onNavigateTab,
  onOpenSearch,
}) => {
  const { locale, theme, toggleTheme } = useThemeStore();
  const isArabic = locale === 'ar';
  const isDark = theme === 'dark';

  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'feed':
        return {
          title: isArabic ? 'موجز المشاركات والميمز' : 'Interactive Feed & Memes',
          subtitle: isArabic
            ? 'تفاعل لحظي، تدوينات سريعة وتصميم ميمز إبداعية'
            : 'Real-time social stream, micro-posts & custom meme creations',
          icon: MessageSquare,
          accent: 'from-indigo-500 to-sky-500',
          badge: isArabic ? 'مباشر' : 'Live Stream',
        };
      case 'sparks':
        return {
          title: isArabic ? 'تحدي السبارك اليومي (24 ساعة)' : '24h Synchronized Daily Spark',
          subtitle: isArabic
            ? 'تحدي إبداعي يومي ينتهي باختيار فائز وتتويجه بلقب Champion'
            : 'Global 24h challenge with automated winner crowning and badges',
          icon: Flame,
          accent: 'from-amber-500 to-rose-500',
          badge: isArabic ? 'تحدي 24 ساعة' : '24h Challenge',
        };
      case 'chains':
        return {
          title: isArabic ? 'سلاسل المايك التفاعلية (Pass-the-Mic)' : 'Pass-The-Mic Story Chains',
          subtitle: isArabic
            ? 'قصص تعاونية مبتكرة بنظام الأدوار والتسجيل الصوتي'
            : 'Collaborative chain stories with turn-based audio and text',
          icon: GitBranch,
          accent: 'from-indigo-500 to-sky-500',
          badge: isArabic ? 'قصص جماعية' : 'Co-Op Stories',
        };
      case 'pods':
        return {
          title: isArabic ? 'حجرات المزاج اللحظية (Mood Pods)' : 'Ephemeral Mood Pods',
          subtitle: isArabic
            ? 'غرف صوتية تفاعلية تنتهي تلقائياً بعد 24 ساعة مع مشاركة صوتية'
            : '24h rooms with live audio sharing, speakers, and reaction bursts',
          icon: Radio,
          accent: 'from-sky-500 to-indigo-500',
          badge: isArabic ? 'غرف صوتية' : 'Live Audio',
        };
      case 'create':
        return {
          title: isArabic ? 'استوديو الميمز والتصميم' : 'Interactive Meme Studio',
          subtitle: isArabic
            ? 'محرر متكامل للنصوص، الملصقات، والرسم بالفرشاة ومشاركة التصاميم'
            : 'Multi-layer text, custom image upload, stickers, and drawing tools',
          icon: Palette,
          accent: 'from-indigo-500 to-sky-500',
          badge: isArabic ? 'محرر رسومي' : 'Studio Editor',
        };
      case 'profile':
        return {
          title: isArabic ? 'الملف الشخصي وإدارة الحساب' : 'Creator Profile & Account',
          subtitle: isArabic
            ? 'تعديل البيانات الشخصية، تغيير كلمة المرور، ورفع الصورة الشخصية والأوسمة'
            : 'Edit profile data, change password, upload avatar, and view badges',
          icon: User,
          accent: 'from-emerald-500 to-sky-500',
          badge: isArabic ? 'لوحة المبدع' : 'Creator Hub',
        };
      default:
        return {
          title: 'SparkLoop',
          subtitle: 'Real-time social entertainment platform',
          icon: Sparkles,
          accent: 'from-indigo-500 to-sky-500',
          badge: 'Live',
        };
    }
  };

  const info = getHeaderInfo();
  const Icon = info.icon;

  return (
    <header className="hidden md:block w-full glass-panel border-b border-slate-200 dark:border-slate-800/80 px-6 py-3.5 backdrop-blur-xl shrink-0 z-30 transition-colors duration-200">
      <div className="flex items-center justify-between gap-4">
        {/* Section Title, Subtitle & Icon */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-2xl bg-gradient-to-tr ${info.accent} p-0.5 shadow-md flex items-center justify-center shrink-0`}
          >
            <div className="w-full h-full bg-white dark:bg-[#0e1520] rounded-[14px] flex items-center justify-center transition-colors">
              <Icon className="w-4.5 h-4.5 text-slate-900 dark:text-white" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight truncate">
                {info.title}
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700/60 shrink-0">
                {info.badge}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xl">
              {info.subtitle}
            </p>
          </div>
        </div>

        {/* Center/Right Actions: Universal Search & Context Shortcuts */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Universal Search Bar Trigger */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm group"
          >
            <Search className="w-3.5 h-3.5 text-indigo-500 group-hover:scale-110 transition-transform" />
            <span className="hidden lg:inline font-medium">
              {isArabic ? 'بحث شامل في المنصة...' : 'Search SparkLoop...'}
            </span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300">
              ⌘K
            </kbd>
          </button>

          {/* Quick Theme Toggle Icon */}
          <Tooltip
            content={
              isDark
                ? isArabic
                  ? 'المظهر الفاتح'
                  : 'Switch to Light Theme'
                : isArabic
                ? 'المظهر الداكن'
                : 'Switch to Dark Theme'
            }
            position="bottom"
          >
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 transition-colors shadow-sm"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-500" />
              )}
            </button>
          </Tooltip>

          {activeTab === 'feed' && (
            <Tooltip content={isArabic ? 'فتح استوديو تصميم الميمز' : 'Open Meme Studio Editor'} position="bottom">
              <button
                onClick={() => onNavigateTab('create')}
                className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <Palette className="w-3.5 h-3.5" />
                <span>{isArabic ? 'إنشاء ميم' : 'New Meme'}</span>
              </button>
            </Tooltip>
          )}

          {activeTab === 'sparks' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-600 dark:text-amber-300">
              <Zap className="w-3.5 h-3.5" />
              <span>{isArabic ? 'تحدي نشط' : 'Active Challenge'}</span>
            </div>
          )}

          {activeTab === 'pods' && (
            <Tooltip content={isArabic ? 'استكشف غرف المزاج التفاعلية' : 'Explore interactive audio pods'} position="bottom">
              <button
                onClick={() => onNavigateTab('pods')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-xs font-bold text-sky-600 dark:text-sky-300 hover:bg-sky-500/20 transition-all"
              >
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>{isArabic ? 'استكشف الغرف' : 'Explore Pods'}</span>
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </header>
  );
};
