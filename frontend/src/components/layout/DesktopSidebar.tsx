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
  Plus,
  Radio,
  Sparkles,
  User,
  Users,
} from 'lucide-react';

interface DesktopSidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  isConnected?: boolean;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  onTabChange,
  isConnected = true,
}) => {
  const { currentPersona } = useAuthStore();
  const { locale, toggleLocale } = useThemeStore();
  const isArabic = locale === 'ar';

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
      desc: isArabic ? 'رسم وتصدير WebP فوري' : 'Touch Canvas & Stickers',
      isHighlight: true,
    },
    {
      id: 'profile' as TabType,
      label: isArabic ? 'الملف الشخصي' : 'Profile & XP',
      icon: User,
      desc: isArabic ? 'الأوسمة ونقاط السمعة' : 'Badges & Stats',
    },
  ];

  return (
    <>
      <aside className="hidden md:flex flex-col justify-between w-20 lg:w-64 h-screen sticky top-0 border-r rtl:border-r-0 rtl:border-l border-zinc-800/80 bg-zinc-950/95 backdrop-blur-xl p-3 lg:p-5 z-30 shrink-0 select-none">
        {/* Top: Branding & Logo */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-1">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-fuchsia-600 via-purple-600 to-cyan-500 p-0.5 shadow-xl shadow-fuchsia-500/20 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-fuchsia-400 animate-sparkle" />
              </div>
            </div>
            <div className="hidden lg:block min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                  SparkLoop
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-fuchsia-500/20 text-fuchsia-300 rounded border border-fuchsia-500/30">
                  {isArabic ? 'تفاعلي' : 'LIVE'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span className="truncate">
                  {isConnected
                    ? isArabic
                      ? 'متصل لحظياً (v5)'
                      : 'Centrifugo v5'
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
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center gap-3.5 p-3 rounded-2xl transition-all text-left rtl:text-right group relative ${
                    isActive
                      ? 'bg-fuchsia-950/50 border border-fuchsia-500/60 text-white font-bold shadow-lg shadow-fuchsia-950/50'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/80 border border-transparent'
                  }`}
                  title={item.label}
                >
                  <div
                    className={`p-2 rounded-xl transition-colors shrink-0 ${
                      isActive
                        ? 'bg-gradient-to-tr from-fuchsia-600 to-purple-600 text-white shadow-md'
                        : 'bg-zinc-900 group-hover:bg-zinc-800 text-zinc-400 group-hover:text-zinc-200'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="hidden lg:flex flex-1 items-center justify-between min-w-0">
                    <div>
                      <div className="text-sm font-bold text-zinc-100 group-hover:text-white truncate">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-zinc-500 font-normal truncate">
                        {item.desc}
                      </div>
                    </div>

                    {item.badge && (
                      <span className="px-2 py-0.5 text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </div>

                  {isActive && (
                    <div className="hidden lg:block w-1.5 h-6 rounded-full bg-fuchsia-400" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Action CTA Button */}
          <button
            onClick={() => onTabChange('create')}
            className="w-full py-3 px-4 bg-gradient-to-r from-fuchsia-600 via-purple-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500 text-white font-bold text-xs rounded-2xl shadow-xl shadow-fuchsia-600/25 active:scale-98 transition-all flex items-center justify-center gap-2 group"
          >
            <Palette className="w-4 h-4 group-hover:rotate-12 transition-transform" />
            <span className="hidden lg:inline">{isArabic ? 'إنشاء ميم / قصة' : 'Create New Meme'}</span>
          </button>
        </div>

        {/* Bottom Section: Language Switcher & Profile Card */}
        <div className="space-y-3 pt-4 border-t border-zinc-800/80">
          {/* Language Toggle */}
          <button
            onClick={toggleLocale}
            className="w-full flex items-center justify-center lg:justify-between p-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
            title={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
          >
            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4 text-cyan-400" />
              <span className="hidden lg:inline">{isArabic ? 'English (LTR)' : 'العربية (RTL)'}</span>
            </div>
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-zinc-800 rounded text-zinc-400">
              {isArabic ? 'EN' : 'عربي'}
            </span>
          </button>

          {/* User Persona & Switcher Trigger */}
          <button
            onClick={() => setModalConfig({ isOpen: true, tab: 'switch' })}
            className="w-full p-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-fuchsia-500/50 transition-all flex items-center gap-3 text-left rtl:text-right group"
          >
            <img
              src={currentPersona.avatarUrl}
              alt={currentPersona.username}
              className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 object-cover shrink-0"
            />
            <div className="hidden lg:block flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-zinc-100 group-hover:text-white truncate">
                  {currentPersona.displayName}
                </span>
                <Users className="w-3.5 h-3.5 text-zinc-500 group-hover:text-fuchsia-400 shrink-0" />
              </div>
              <div className="text-[11px] text-zinc-400 truncate">
                @{currentPersona.username}
              </div>
            </div>
          </button>
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