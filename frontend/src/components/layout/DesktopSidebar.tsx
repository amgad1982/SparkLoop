import React, { useState } from 'react';
import { TabType } from './BottomNavBar';
import { useAuthStore } from '../../stores/useAuthStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { PersonaSwitcher } from './PersonaSwitcher';
import { Tooltip } from '../ui/Tooltip';
import {
  Flame,
  GitBranch,
  Languages,
  LogIn,
  LogOut,
  MessageSquare,
  Moon,
  Palette,
  Radio,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react';

interface DesktopSidebarProps {
  activeTab: TabType | 'profile';
  onTabChange: (tab: TabType | 'profile') => void;
  isConnected?: boolean;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  onTabChange,
  isConnected = true,
}) => {
  const { currentPersona, logout } = useAuthStore();
  const { theme, toggleTheme, locale, toggleLocale } = useThemeStore();
  const isArabic = locale === 'ar';
  const isDark = theme === 'dark';

  const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; tab: 'switch' | 'register' }>({
    isOpen: false,
    tab: 'switch',
  });

  const navItems = [
    {
      id: 'feed' as TabType,
      label: isArabic ? 'الرئيسية' : 'Feed',
      icon: MessageSquare,
      desc: isArabic ? 'موجز التدوينات والميمز' : 'Micro-posts & Media',
    },
    {
      id: 'sparks' as TabType,
      label: isArabic ? 'تحدي اليوم' : 'Daily Sparks',
      icon: Flame,
      badge: '24h',
      desc: isArabic ? 'تحدي إبداعي متزامن' : '24h Global Challenge',
    },
    {
      id: 'chains' as TabType,
      label: isArabic ? 'سلاسل المايك' : 'Story Chains',
      icon: GitBranch,
      desc: isArabic ? 'قصص تعاونية بنظام الأدوار' : 'Pass-the-Mic Stories',
    },
    {
      id: 'pods' as TabType,
      label: isArabic ? 'حجرات المزاج' : 'Mood Pods',
      icon: Radio,
      badge: 'Live',
      desc: isArabic ? 'غرف تفاعلية مؤقتة' : '24h Ephemeral Rooms',
    },
    {
      id: 'create' as TabType,
      label: isArabic ? 'استوديو الميمز' : 'Meme Studio',
      icon: Palette,
      desc: isArabic ? 'رسم وتصميم ميمز فوري' : 'Create Memes & Stickers',
      isHighlight: true,
    },
  ];

  return (
    <>
      <aside className="hidden md:flex flex-col justify-between w-20 lg:w-64 h-full border-r rtl:border-r-0 rtl:border-l border-zinc-200 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-950/95 backdrop-blur-xl p-3 lg:p-5 z-30 shrink-0 select-none overflow-y-auto no-scrollbar transition-colors duration-200">
        {/* Top: Branding & Logo */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-1">
            <Tooltip content={isArabic ? 'سبارك لوب - منصة الترفيه التفاعلي' : 'SparkLoop - Social Co-Creation'} position="right">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-fuchsia-600 via-purple-600 to-cyan-500 p-0.5 shadow-xl shadow-fuchsia-500/20 flex items-center justify-center shrink-0 cursor-pointer">
                <div className="w-full h-full bg-white dark:bg-zinc-950 rounded-[14px] flex items-center justify-center transition-colors">
                  <Sparkles className="w-6 h-6 text-fuchsia-500 animate-sparkle" />
                </div>
              </div>
            </Tooltip>
            <div className="hidden lg:block min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-500 dark:from-white dark:via-zinc-200 dark:to-zinc-400 bg-clip-text text-transparent">
                  SparkLoop
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-fuchsia-500/10 dark:bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-300 rounded border border-fuchsia-500/30">
                  {isArabic ? 'تفاعلي' : 'LIVE'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span className="truncate">
                  {isConnected
                    ? isArabic
                      ? 'متصل لحظياً'
                      : 'Live Connected'
                    : isArabic
                    ? 'جاري الاتصال...'
                    : 'Connecting...'}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <Tooltip
                  key={item.id}
                  content={`${item.label} • ${item.desc}`}
                  position="right"
                  className="w-full"
                >
                  <button
                    onClick={() => onTabChange(item.id)}
                    className={`w-full flex items-center gap-3 p-2.5 lg:p-3 rounded-2xl transition-all text-left rtl:text-right group relative overflow-hidden ${
                      isActive
                        ? 'bg-fuchsia-50 dark:bg-fuchsia-950/50 border border-fuchsia-400 dark:border-fuchsia-500/60 text-fuchsia-900 dark:text-white font-bold shadow-md shadow-fuchsia-500/10'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900/80 border border-transparent'
                    }`}
                  >
                    {/* Active Indicator Accent Bar at Start Edge */}
                    {isActive && (
                      <div className="absolute left-0 rtl:left-auto rtl:right-0 top-2.5 bottom-2.5 w-1 rounded-r-full rtl:rounded-r-none rtl:rounded-l-full bg-gradient-to-b from-fuchsia-500 to-purple-500 shadow-md shadow-fuchsia-500/50" />
                    )}

                    <div
                      className={`p-2 rounded-xl transition-colors shrink-0 ${
                        isActive
                          ? 'bg-gradient-to-tr from-fuchsia-600 to-purple-600 text-white shadow-md'
                          : 'bg-zinc-100 dark:bg-zinc-900 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-200'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="hidden lg:flex flex-1 items-center justify-between min-w-0 gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-fuchsia-600 dark:group-hover:text-white truncate">
                          {item.label}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-500 font-normal truncate">
                          {item.desc}
                        </div>
                      </div>

                      {item.badge && (
                        <span className="px-2 py-0.5 text-[10px] font-black bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 rounded-full shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </button>
                </Tooltip>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Theme Switcher, Language Switcher & Profile Card */}
        <div className="space-y-2.5 pt-4 border-t border-zinc-200 dark:border-zinc-800/80">
          {/* Quick Actions Row: Theme Toggle & Language Toggle */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {/* Theme Toggle */}
            <Tooltip
              content={
                isDark
                  ? isArabic
                    ? 'تفعيل المظهر الفاتح (Light Mode)'
                    : 'Switch to Light Theme'
                  : isArabic
                  ? 'تفعيل المظهر الداكن (Dark Mode)'
                  : 'Switch to Dark Theme'
              }
              position="top"
              className="w-full"
            >
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-center lg:justify-between p-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors shadow-sm"
              >
                <div className="flex items-center gap-2">
                  {isDark ? (
                    <Sun className="w-4 h-4 text-amber-400 animate-pulse" />
                  ) : (
                    <Moon className="w-4 h-4 text-fuchsia-500" />
                  )}
                  <span className="hidden lg:inline">{isDark ? (isArabic ? 'فاتح' : 'Light') : (isArabic ? 'داكن' : 'Dark')}</span>
                </div>
                <span className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400">
                  {isDark ? '☀️' : '🌙'}
                </span>
              </button>
            </Tooltip>

            {/* Language Toggle */}
            <Tooltip
              content={
                isArabic
                  ? 'Switch site language to English (LTR)'
                  : 'التبديل إلى اللغة العربية (RTL)'
              }
              position="top"
              className="w-full"
            >
              <button
                onClick={toggleLocale}
                className="w-full flex items-center justify-center lg:justify-between p-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors shadow-sm"
              >
                <div className="flex items-center gap-1.5">
                  <Languages className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                  <span className="hidden lg:inline">{isArabic ? 'English' : 'عربي'}</span>
                </div>
                <span className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400">
                  {isArabic ? 'EN' : 'AR'}
                </span>
              </button>
            </Tooltip>
          </div>

          {/* User Persona & Profile / Switcher / Logout Trigger */}
          {currentPersona.username === 'guest' ? (
            <Tooltip
              content={isArabic ? 'تسجيل الدخول أو اختيار شخصية' : 'Sign in or select persona'}
              position="top"
              className="w-full"
            >
              <button
                onClick={() => setModalConfig({ isOpen: true, tab: 'switch' })}
                className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-600/15 to-purple-600/15 hover:from-fuchsia-600/25 hover:to-purple-600/25 border border-fuchsia-500/40 hover:border-fuchsia-500/80 transition-all flex items-center justify-center lg:justify-start gap-2.5 text-left rtl:text-right group shadow-sm"
              >
                <div className="w-9 h-9 rounded-xl bg-fuchsia-600/20 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-600 dark:text-fuchsia-400 shrink-0">
                  <LogIn className="w-4 h-4" />
                </div>
                <div className="hidden lg:block min-w-0">
                  <span className="font-bold text-xs text-zinc-900 dark:text-white block">
                    {isArabic ? 'تسجيل الدخول' : 'Sign In / Switch'}
                  </span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">
                    {isArabic ? 'اختر شخصيتك الإبداعية' : 'Select persona'}
                  </span>
                </div>
              </button>
            </Tooltip>
          ) : (
            <Tooltip
              content={isArabic ? 'عرض وتعديل الملف الشخصي' : 'View and edit profile'}
              position="top"
              className="w-full"
            >
              <div
                onClick={() => onTabChange('profile')}
                className={`w-full p-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-850 border transition-all flex items-center gap-3 text-left rtl:text-right group cursor-pointer shadow-sm ${
                  activeTab === 'profile'
                    ? 'border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/20 shadow-lg shadow-fuchsia-500/10 ring-1 ring-fuchsia-500/50'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <img
                  src={currentPersona.avatarUrl}
                  alt={currentPersona.username}
                  className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 object-cover shrink-0"
                />
                <div className="hidden lg:block flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 group-hover:text-fuchsia-600 dark:group-hover:text-white truncate">
                      {currentPersona.displayName}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <Tooltip content={isArabic ? 'تبديل الحساب' : 'Switch Account'} position="top">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalConfig({ isOpen: true, tab: 'switch' });
                          }}
                          className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-cyan-500 transition-colors"
                        >
                          <Users className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                      <Tooltip content={isArabic ? 'تسجيل الخروج' : 'Log Out'} position="top">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            logout();
                          }}
                          className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-rose-500 transition-colors"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                    @{currentPersona.username}
                  </div>
                </div>
              </div>
            </Tooltip>
          )}
        </div>
      </aside>

      <PersonaSwitcher
        key={modalConfig.tab}
        isOpen={modalConfig.isOpen}
        initialTab={modalConfig.tab}
        onClose={() => setModalConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </>
  );
};