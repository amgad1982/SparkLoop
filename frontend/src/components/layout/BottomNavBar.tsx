import React from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
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
      label: isArabic ? 'تحدي اليوم' : 'Sparks',
      icon: Flame,
      badge: '24h',
    },
    {
      id: 'create' as TabType,
      label: isArabic ? 'صانع الميم' : 'Meme Lab',
      icon: Palette,
      isSpecial: true,
    },
    {
      id: 'chains' as TabType,
      label: isArabic ? 'سلاسل' : 'Chains',
      icon: GitBranch,
    },
    {
      id: 'profile' as TabType,
      label: isArabic ? 'حسابي' : 'Profile',
      icon: User,
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-zinc-800/90 pb-safe">
      <div className="max-w-md mx-auto px-3 py-2 flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if (tab.isSpecial) {
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative -top-5 flex flex-col items-center group focus:outline-none"
              >
                <div
                  className={`w-14 h-14 rounded-full p-0.5 shadow-xl transition-transform active:scale-95 ${
                    isActive
                      ? 'bg-gradient-to-tr from-fuchsia-500 via-purple-500 to-cyan-400 spark-glow scale-105'
                      : 'bg-gradient-to-tr from-fuchsia-600 to-cyan-500 hover:scale-105'
                  }`}
                >
                  <div className="w-full h-full bg-zinc-950 rounded-full flex items-center justify-center">
                    <Icon className="w-6 h-6 text-white group-hover:text-fuchsia-300 transition-colors" />
                  </div>
                </div>
                <span className="text-[10px] font-bold text-zinc-300 mt-1">{tab.label}</span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all relative ${
                isActive ? 'text-fuchsia-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2 px-1 text-[8px] font-black bg-amber-500 text-black rounded-full">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
