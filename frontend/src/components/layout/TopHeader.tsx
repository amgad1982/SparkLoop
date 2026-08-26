import React from 'react';
import { TabType } from './BottomNavBar';
import { useAuthStore } from '../../stores/useAuthStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { Languages, Sparkles, Search, LogIn, User } from 'lucide-react';

interface TopHeaderProps {
  isConnected?: boolean;
  onNavigateTab?: (tab: TabType) => void;
  onOpenSearch?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ isConnected = true, onNavigateTab, onOpenSearch }) => {
  const { currentUser, currentPersona, openAuthModal } = useAuthStore();
  const { locale, toggleLocale } = useThemeStore();
  const isArabic = locale === 'ar';

  return (
    <header className="md:hidden w-full glass-panel border-b border-slate-200 dark:border-slate-800/80 px-4 py-3 shrink-0 z-40">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Logo & Realtime Status */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-sky-500 p-0.5 shadow-md flex items-center justify-center">
            <div className="w-full h-full bg-white dark:bg-[#0e1520] rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-500 dark:text-indigo-400 animate-sparkle" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                SparkLoop
              </h1>
              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 rounded border border-indigo-500/30">
                {isArabic ? 'تفاعلي' : 'LIVE'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span>{isConnected ? (isArabic ? 'متصل لحظياً' : 'Live Connected') : (isArabic ? 'جاري الاتصال' : 'Connecting')}</span>
            </div>
          </div>
        </div>

        {/* Controls: Search, Language Toggle & User Profile / Login */}
        <div className="flex items-center gap-2">
          {/* Search Trigger Button */}
          <button
            onClick={onOpenSearch}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            title={isArabic ? 'بحث' : 'Search'}
          >
            <Search className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
          </button>

          {/* Arabic / English Toggle */}
          <button
            onClick={toggleLocale}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
            title={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
          >
            <Languages className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
            <span>{isArabic ? 'EN' : 'عربي'}</span>
          </button>

          {/* User Avatar or Sign In button */}
          {currentUser ? (
            <button
              onClick={() => {
                if (onNavigateTab) {
                  onNavigateTab('profile');
                }
              }}
              className="flex items-center gap-2 p-1 pr-2.5 rtl:pr-1 rtl:pl-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 hover:border-indigo-500/50 transition-all text-xs"
              title={isArabic ? 'عرض الملف الشخصي' : 'View Profile'}
            >
              <img
                src={currentUser.avatarUrl || currentPersona.avatarUrl}
                alt={currentUser.username}
                className="w-7 h-7 rounded-xl bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 object-cover"
              />
              <span className="font-semibold text-slate-700 dark:text-slate-200 hidden sm:inline max-w-[80px] truncate">
                {currentUser.username}
              </span>
            </button>
          ) : (
            <button
              onClick={() => openAuthModal('login')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{isArabic ? 'دخول' : 'Sign In'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
