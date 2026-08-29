import React from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { Tooltip } from '../ui/Tooltip';
import { Flame, GitBranch, MessageSquare, Palette, Radio, User } from 'lucide-react';

export type TabType = 'feed' | 'sparks' | 'chains' | 'pods' | 'create' | 'profile';

interface BottomNavBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onTabChange }) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  const tabs = [
    {
      id: 'feed' as TabType,
      label: isArabic ? 'الرئيسية' : 'Feed',
      icon: MessageSquare,
    },
    {
      id: 'sparks' as TabType,
      label: isArabic ? 'تحدي' : 'Sparks',
      icon: Flame,
      badge: '24h',
      badgeColor: 'bg-amber-500 text-black',
    },
    {
      id: 'chains' as TabType,
      label: isArabic ? 'سلاسل' : 'Chains',
      icon: GitBranch,
    },
    {
      id: 'create' as TabType,
      label: isArabic ? 'صانع الميم' : 'Meme Lab',
      icon: Palette,
      isSpecial: true,
    },
    {
      id: 'pods' as TabType,
      label: isArabic ? 'غرف المزاج' : 'Pods',
      icon: Radio,
      badge: 'Live',
      badgeColor: 'bg-emerald-500 text-white animate-pulse',
    },
    {
      id: 'profile' as TabType,
      label: isArabic ? 'حسابي' : 'Profile',
      icon: User,
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-slate-200 dark:border-slate-800/90 pb-safe transition-colors duration-200">
      <div className="max-w-md mx-auto px-1 py-1.5 flex items-center justify-between">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if (tab.isSpecial) {
            return (
              <Tooltip key={tab.id} content={tab.label} position="top">
                <button
                  onClick={() => onTabChange(tab.id)}
                  className="relative -top-4 flex flex-col items-center group focus:outline-none shrink-0 mx-0.5"
                >
                  <div
                    className={`w-12 h-12 rounded-full p-0.5 shadow-xl transition-transform active:scale-95 ${
                      isActive
                        ? 'bg-gradient-to-tr from-indigo-500 via-indigo-600 to-sky-400 spark-glow scale-105'
                        : 'bg-gradient-to-tr from-indigo-600 to-sky-500 hover:scale-105'
                    }`}
                  >
                    <div className="w-full h-full bg-white dark:bg-[#0e1520] rounded-full flex items-center justify-center transition-colors">
                      <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-300 group-hover:text-indigo-400 transition-colors" />
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300 mt-0.5">{tab.label}</span>
                </button>
              </Tooltip>
            );
          }

          return (
            <Tooltip key={tab.id} content={tab.label} position="top">
              <button
                onClick={() => onTabChange(tab.id)}
                className={`flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all relative flex-1 min-w-0 ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                  {tab.badge && (
                    <span className={`absolute -top-1.5 -right-2 px-1 text-[7.5px] font-black rounded-full shadow-sm ${tab.badgeColor || 'bg-amber-500 text-black'}`}>
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[9px] sm:text-[10px] mt-0.5 tracking-tight truncate max-w-[52px] text-center">{tab.label}</span>
              </button>
            </Tooltip>
          );
        })}
      </div>
    </nav>
  );
};
