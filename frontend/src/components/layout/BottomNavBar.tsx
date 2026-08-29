import React from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { Flame, GitBranch, MessageSquare, Palette, Radio } from 'lucide-react';
import { motion } from 'framer-motion';

export type TabType = 'feed' | 'sparks' | 'chains' | 'pods' | 'create' | 'profile';

interface BottomNavBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onTabChange }) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  const leftTabs = [
    {
      id: 'feed' as TabType,
      label: isArabic ? 'الرئيسية' : 'Feed',
      icon: MessageSquare,
    },
    {
      id: 'sparks' as TabType,
      label: isArabic ? 'التحدي' : 'Sparks',
      icon: Flame,
      badge: '24h',
      badgeColor: 'bg-amber-500 text-black',
    },
  ];

  const rightTabs = [
    {
      id: 'chains' as TabType,
      label: isArabic ? 'السلاسل' : 'Chains',
      icon: GitBranch,
    },
    {
      id: 'pods' as TabType,
      label: isArabic ? 'غرف المزاج' : 'Pods',
      icon: Radio,
      badge: 'Live',
      badgeColor: 'bg-emerald-500 text-white animate-pulse',
    },
  ];

  const isCreateActive = activeTab === 'create';

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0b0f17]/95 backdrop-blur-xl border-t border-slate-200/90 dark:border-slate-800/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_25px_rgba(0,0,0,0.4)] pb-safe transition-colors duration-200">
      <div className="max-w-md mx-auto px-3 py-2 flex items-center justify-between relative">
        
        {/* Left Tabs (Feed & Sparks) */}
        <div className="flex items-center justify-around flex-1">
          {leftTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 relative group flex-1 max-w-[80px] ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon
                    className={`w-5 h-5 transition-transform duration-200 group-active:scale-90 ${
                      isActive ? 'stroke-[2.5] scale-110 drop-shadow-sm' : 'stroke-[1.8]'
                    }`}
                  />
                  {tab.badge && (
                    <span
                      className={`absolute -top-1.5 -right-3.5 px-1.5 py-0.2 text-[8px] font-black rounded-full shadow-sm ${
                        tab.badgeColor || 'bg-amber-500 text-black'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[11px] mt-1 tracking-tight transition-all duration-200 ${
                    isActive ? 'font-black scale-105' : 'font-semibold'
                  }`}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <motion.span
                    layoutId="activeTabIndicator"
                    className="absolute -bottom-1 w-5 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Center Floating Action Button (Meme Lab / Studio) */}
        <div className="flex flex-col items-center justify-center shrink-0 px-2">
          <button
            onClick={() => onTabChange('create')}
            className="relative -top-5 flex flex-col items-center group focus:outline-none"
            aria-label={isArabic ? 'صانع الميم' : 'Meme Lab'}
          >
            <div
              className={`w-14 h-14 rounded-2xl p-0.5 shadow-xl transition-all duration-300 transform active:scale-90 ${
                isCreateActive
                  ? 'bg-gradient-to-tr from-indigo-500 via-indigo-600 to-sky-400 scale-110 shadow-indigo-500/40 ring-4 ring-indigo-500/20'
                  : 'bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 hover:scale-105 shadow-indigo-500/25'
              }`}
            >
              <div className="w-full h-full bg-white dark:bg-[#0e1520] rounded-[14px] flex items-center justify-center transition-colors">
                <Palette
                  className={`w-6 h-6 transition-all duration-200 ${
                    isCreateActive
                      ? 'text-indigo-600 dark:text-indigo-300 scale-110'
                      : 'text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-500'
                  }`}
                />
              </div>
            </div>
            <span
              className={`text-[10px] tracking-tight mt-1 transition-all duration-200 ${
                isCreateActive
                  ? 'font-black text-indigo-600 dark:text-indigo-400 scale-105'
                  : 'font-bold text-slate-700 dark:text-slate-300'
              }`}
            >
              {isArabic ? 'الميمز' : 'Meme Lab'}
            </span>
          </button>
        </div>

        {/* Right Tabs (Chains & Pods) */}
        <div className="flex items-center justify-around flex-1">
          {rightTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 relative group flex-1 max-w-[80px] ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon
                    className={`w-5 h-5 transition-transform duration-200 group-active:scale-90 ${
                      isActive ? 'stroke-[2.5] scale-110 drop-shadow-sm' : 'stroke-[1.8]'
                    }`}
                  />
                  {tab.badge && (
                    <span
                      className={`absolute -top-1.5 -right-3.5 px-1.5 py-0.2 text-[8px] font-black rounded-full shadow-sm ${
                        tab.badgeColor || 'bg-amber-500 text-black'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[11px] mt-1 tracking-tight transition-all duration-200 ${
                    isActive ? 'font-black scale-105' : 'font-semibold'
                  }`}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <motion.span
                    layoutId="activeTabIndicator"
                    className="absolute -bottom-1 w-5 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

      </div>
    </nav>
  );
};
