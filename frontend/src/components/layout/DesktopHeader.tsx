import React, { useState } from 'react';
import { TabType } from './BottomNavBar';
import { useAuthStore } from '../../stores/useAuthStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { PersonaSwitcher } from './PersonaSwitcher';
import {
  Flame,
  GitBranch,
  Languages,
  MessageSquare,
  Palette,
  Radio,
  Sparkles,
  User,
  Users,
} from 'lucide-react';

interface DesktopHeaderProps {
  activeTab: TabType | 'profile';
  onNavigateTab: (tab: TabType | 'profile') => void;
  isConnected?: boolean;
}

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({
  activeTab,
  onNavigateTab,
  isConnected = true,
}) => {
  const { currentPersona } = useAuthStore();
  const { locale, toggleLocale } = useThemeStore();
  const isArabic = locale === 'ar';

  const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; tab: 'switch' | 'register' }>({
    isOpen: false,
    tab: 'switch',
  });

  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'feed':
        return {
          title: isArabic ? 'موجز المشاركات والميمز' : 'Interactive Feed & Memes',
          subtitle: isArabic
            ? 'تفاعل لحظي، تدوينات ميكرو <= 280 حرف، وميمز WebP متحركة'
            : 'Real-time social stream, micro-posts & high-quality WebP canvas creations',
          icon: MessageSquare,
          accent: 'from-fuchsia-500 to-purple-500',
        };
      case 'sparks':
        return {
          title: isArabic ? 'تحدي السبارك اليومي (24 ساعة)' : '24h Synchronized Daily Spark',
          subtitle: isArabic
            ? 'تحدي إبداعي يومي موحد عالمياً ينتهي باختيار فائز وتتويجه بلقب Champion'
            : 'Global 24h synchronized challenge with automated winner crowning and badges',
          icon: Flame,
          accent: 'from-amber-500 to-rose-500',
        };
      case 'chains':
        return {
          title: isArabic ? 'سلاسل المايك التفاعلية (Pass-the-Mic)' : 'Pass-The-Mic Story Chains',
          subtitle: isArabic
            ? 'قصص تعاونية مقيدة بنظام أدوار ذكي وقفل تزامني عبر Centrifugo'
            : 'Collaborative chain stories with strict turn locks and audio snippet playback',
          icon: GitBranch,
          accent: 'from-purple-500 to-indigo-500',
        };
      case 'pods':
        return {
          title: isArabic ? 'حجرات المزاج اللحظية (Mood Pods)' : 'Ephemeral Mood Pods',
          subtitle: isArabic
            ? 'غرف صوتية ودردشة تنتهي تلقائياً بعد 24 ساعة مع تفاعلات حية'
            : '24h ephemeral rooms with ambient sound, live member count, and reaction bursts',
          icon: Radio,
          accent: 'from-cyan-500 to-blue-500',
        };
      case 'create':
        return {
          title: isArabic ? 'استوديو الميمز والرسم التفاعلي' : 'Interactive Meme & WebP Studio',
          subtitle: isArabic
            ? 'محرر طبقات نصوص حرة، ملصقات، رسم بالفرشاة وتصدير WebP فائق السرعة'
            : 'Multi-layer text engine, custom image upload, stickers, and instant WebP publishing',
          icon: Palette,
          accent: 'from-fuchsia-500 to-cyan-500',
        };
      case 'profile':
        return {
          title: isArabic ? 'الملف الشخصي والإنجازات' : 'Creator Profile & Achievements',
          subtitle: isArabic
            ? 'استعرض نقاط السمعة، الأوسمة والجوائز، وتاريخ مشاركاتك في المنصة'
            : 'View your reputation tier, awarded badges, and complete creative portfolio',
          icon: User,
          accent: 'from-emerald-500 to-cyan-500',
        };
      default:
        return {
          title: 'SparkLoop',
          subtitle: 'Real-time social entertainment platform',
          icon: Sparkles,
          accent: 'from-fuchsia-500 to-purple-500',
        };
    }
  };

  const info = getHeaderInfo();
  const Icon = info.icon;

  return (
    <>
      <header className="hidden md:block sticky top-0 z-30 w-full glass-panel border-b border-zinc-800/80 px-6 py-4 mb-4 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          {/* Section Title & Subtitle */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${info.accent} p-0.5 shadow-lg flex items-center justify-center shrink-0`}
            >
              <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                <Icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black text-white tracking-tight truncate">
                {info.title}
              </h2>
              <p className="text-xs text-zinc-400 truncate max-w-xl">
                {info.subtitle}
              </p>
            </div>
          </div>

          {/* Controls: Connection Chip + Language Switcher + Persona Pill */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Real-time Status */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs font-semibold text-zinc-300">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="text-[11px]">
                {isConnected ? (isArabic ? 'متصل لحظياً' : 'Live v5') : (isArabic ? 'جاري الاتصال' : 'Connecting')}
              </span>
            </div>

            {/* Language Switch */}
            <button
              onClick={toggleLocale}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
              title={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
            >
              <Languages className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isArabic ? 'EN' : 'عربي'}</span>
            </button>

            {/* User Profile Pill */}
            <button
              onClick={() => onNavigateTab('profile')}
              className="flex items-center gap-2 p-1 pr-3 rtl:pr-1 rtl:pl-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-fuchsia-500/50 transition-all text-xs"
              title={isArabic ? 'عرض الملف الشخصي' : 'View Profile'}
            >
              <img
                src={currentPersona.avatarUrl}
                alt={currentPersona.username}
                className="w-7 h-7 rounded-xl bg-zinc-800 border border-zinc-700 object-cover"
              />
              <span className="font-semibold text-zinc-200 hidden lg:inline max-w-[90px] truncate">
                {currentPersona.displayName}
              </span>
            </button>
          </div>
        </div>
      </header>

      <PersonaSwitcher
        key={modalConfig.tab}
        isOpen={modalConfig.isOpen}
        initialTab={modalConfig.tab}
        onClose={() => setModalConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </>
  );
};
