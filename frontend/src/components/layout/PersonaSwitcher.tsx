import React from 'react';
import { useAuthStore, PRESET_PERSONAS } from '../../stores/useAuthStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { ShieldCheck, Sparkles, UserCheck, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PersonaSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PersonaSwitcher: React.FC<PersonaSwitcherProps> = ({ isOpen, onClose }) => {
  const { currentPersona, setPersona } = useAuthStore();
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md p-6 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl space-y-5 text-white"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-fuchsia-400" />
                  {isArabic ? 'تبديل الشخصية للتجربة' : 'Switch Persona (Demo Mode)'}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  {isArabic
                    ? 'بدّل بين المستخدمين لاختبار أدوار سلاسل المايك والميمز والـ Pods'
                    : 'Switch users to test Pass-the-Mic turn locks & live reactions'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-white rounded-full bg-zinc-800 hover:bg-zinc-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {PRESET_PERSONAS.map((persona) => {
                const isSelected = currentPersona.id === persona.id;
                return (
                  <button
                    key={persona.id}
                    onClick={() => {
                      setPersona(persona);
                      onClose();
                    }}
                    className={`w-full p-3.5 flex items-center gap-4 rounded-2xl border transition-all text-left rtl:text-right ${
                      isSelected
                        ? 'bg-fuchsia-950/40 border-fuchsia-500/80 ring-1 ring-fuchsia-500'
                        : 'bg-zinc-800/50 border-zinc-700/60 hover:bg-zinc-800 hover:border-zinc-600'
                    }`}
                  >
                    <img
                      src={persona.avatarUrl}
                      alt={persona.username}
                      className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-100 truncate">
                          {persona.displayName}
                        </span>
                        {isSelected && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-fuchsia-500/20 text-fuchsia-300 rounded-full border border-fuchsia-500/30">
                            {isArabic ? 'نشط' : 'ACTIVE'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 truncate">@{persona.username} • {persona.role}</p>
                    </div>
                    {isSelected ? (
                      <UserCheck className="w-5 h-5 text-fuchsia-400 flex-shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-zinc-600 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                {isArabic ? 'حسابات موثقة ومجهزة' : 'Pre-seeded Verified Personas'}
              </span>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-white font-medium"
              >
                {isArabic ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
