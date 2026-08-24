import React from 'react';
import { TabType } from './BottomNavBar';
import { useThemeStore } from '../../stores/useThemeStore';
import {
  Flame,
  GitBranch,
  MessageSquare,
  Palette,
  Radio,
  Sparkles,
  User,
  Zap,
} from 'lucide-react';

interface DesktopHeaderProps {
  activeTab: TabType | 'profile';
  onNavigateTab: (tab: TabType | 'profile') => void;
  isConnected?: boolean;
}

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({
  activeTab,
  onNavigateTab,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'feed':
        return {
          title: isArabic ? 'موجز المشاركات والميمز' : 'Interactive Feed & Memes',
          subtitle: isArabic
            ? 'تفاعل لحظي، تدوينات سريعة وتصميم ميمز إبداعية'
            : 'Real-time social stream, micro-posts & custom meme creations',
          icon: MessageSquare,
          accent: 'from-fuchsia-500 to-purple-500',
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
          accent: 'from-purple-500 to-indigo-500',
          badge: isArabic ? 'قصص جماعية' : 'Co-Op Stories',
        };
      case 'pods':
        return {
          title: isArabic ? 'حجرات المزاج اللحظية (Mood Pods)' : 'Ephemeral Mood Pods',
          subtitle: isArabic
            ? 'غرف صوتية تفاعلية تنتهي تلقائياً بعد 24 ساعة مع مشاركة صوتية'
            : '24h rooms with live audio sharing, speakers, and reaction bursts',
          icon: Radio,
          accent: 'from-cyan-500 to-blue-500',
          badge: isArabic ? 'غرف صوتية' : 'Live Audio',
        };
      case 'create':
        return {
          title: isArabic ? 'استوديو الميمز والتصميم' : 'Interactive Meme Studio',
          subtitle: isArabic
            ? 'محرر متكامل للنصوص، الملصقات، والرسم بالفرشاة ومشاركة التصاميم'
            : 'Multi-layer text, custom image upload, stickers, and drawing tools',
          icon: Palette,
          accent: 'from-fuchsia-500 to-cyan-500',
          badge: isArabic ? 'محرر رسومي' : 'Studio Editor',
        };
      case 'profile':
        return {
          title: isArabic ? 'الملف الشخصي وإدارة الحساب' : 'Creator Profile & Account',
          subtitle: isArabic
            ? 'تعديل البيانات الشخصية، تغيير كلمة المرور، ورفع الصورة الشخصية والأوسمة'
            : 'Edit profile data, change password, upload avatar, and view badges',
          icon: User,
          accent: 'from-emerald-500 to-cyan-500',
          badge: isArabic ? 'لوحة المبدع' : 'Creator Hub',
        };
      default:
        return {
          title: 'SparkLoop',
          subtitle: 'Real-time social entertainment platform',
          icon: Sparkles,
          accent: 'from-fuchsia-500 to-purple-500',
          badge: 'Live',
        };
    }
  };

  const info = getHeaderInfo();
  const Icon = info.icon;

  return (
    <header className="hidden md:block sticky top-0 z-30 w-full glass-panel border-b border-zinc-800/80 px-6 py-3.5 mb-4 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4">
        {/* Section Title, Subtitle & Icon */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-2xl bg-gradient-to-tr ${info.accent} p-0.5 shadow-lg flex items-center justify-center shrink-0`}
          >
            <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
              <Icon className="w-4.5 h-4.5 text-white" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white tracking-tight truncate">
                {info.title}
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-zinc-800/90 text-zinc-300 rounded-md border border-zinc-700/60 shrink-0">
                {info.badge}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 truncate max-w-xl">
              {info.subtitle}
            </p>
          </div>
        </div>

        {/* Context Quick Action Shortcuts */}
        <div className="flex items-center gap-2 shrink-0">
          {activeTab === 'feed' && (
            <button
              onClick={() => onNavigateTab('create')}
              className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-fuchsia-600/20 transition-all active:scale-95"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>{isArabic ? 'إنشاء ميم' : 'New Meme'}</span>
            </button>
          )}

          {activeTab === 'sparks' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-300">
              <Zap className="w-3.5 h-3.5" />
              <span>{isArabic ? 'تحدي نشط' : 'Active Challenge'}</span>
            </div>
          )}

          {activeTab === 'pods' && (
            <button
              onClick={() => onNavigateTab('pods')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20 transition-all"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>{isArabic ? 'استكشف الغرف' : 'Explore Pods'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
