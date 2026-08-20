import React, { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { PersonaSwitcher } from './PersonaSwitcher';
import { Languages, Radio, Sparkles, User } from 'lucide-react';

interface TopHeaderProps {
  isConnected?: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ isConnected = true }) => {
  const { currentPersona } = useAuthStore();
  const { locale, toggleLocale } = useThemeStore();
  const [isPersonaOpen, setIsPersonaOpen] = useState(false);
  const isArabic = locale === 'ar';

  return (
    <>
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-zinc-800/80 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          {/* Logo & Realtime Status */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-fuchsia-600 via-purple-600 to-cyan-500 p-0.5 shadow-lg shadow-fuchsia-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-fuchsia-400 animate-sparkle" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-lg font-black tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                  SparkLoop
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-fuchsia-500/20 text-fuchsia-300 rounded border border-fuchsia-500/30">
                  {isArabic ? 'تفاعلي' : 'LIVE'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span>{isConnected ? (isArabic ? 'متصل لحظياً' : 'Centrifugo v5 Active') : (isArabic ? 'جاري الاتصال' : 'Connecting')}</span>
              </div>
            </div>
          </div>

          {/* Controls: Language Toggle & Persona Profile */}
          <div className="flex items-center gap-2">
            {/* Arabic / English Toggle */}
            <button
              onClick={toggleLocale}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
              title={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
            >
              <Languages className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isArabic ? 'EN' : 'عربي'}</span>
            </button>

            {/* Persona Avatar Switcher Trigger */}
            <button
              onClick={() => setIsPersonaOpen(true)}
              className="flex items-center gap-2 p-1 pr-2.5 rtl:pr-1 rtl:pl-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-fuchsia-500/50 transition-all text-xs"
            >
              <img
                src={currentPersona.avatarUrl}
                alt={currentPersona.username}
                className="w-7 h-7 rounded-xl bg-zinc-800 border border-zinc-700 object-cover"
              />
              <span className="font-semibold text-zinc-200 hidden sm:inline max-w-[80px] truncate">
                {currentPersona.username}
              </span>
            </button>
          </div>
        </div>
      </header>

      <PersonaSwitcher isOpen={isPersonaOpen} onClose={() => setIsPersonaOpen(false)} />
    </>
  );
};
