import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Settings,
  Moon,
  Sun,
  Globe,
  Lock,
  Eye,
  Bell,
  Volume2,
  MicOff,
  Sliders,
  Check,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { api } from '../../services/apiClient';
import { UserSettingsDto } from '../../types/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { theme, setTheme, locale, setLocale } = useThemeStore();
  const isArabic = locale === 'ar';
  const { currentPersona } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'privacy' | 'notifications' | 'audio'>('general');

  const [settings, setSettings] = useState<UserSettingsDto>({
    preferredTheme: theme,
    preferredLanguage: locale,
    isPrivate: false,
    isSearchDiscoverable: true,
    showBio: true,
    showFollowersCount: true,
    showBadges: true,
    showActivityStats: true,
    notifyStageInvites: true,
    notifyChainTurns: true,
    notifyFollows: true,
    hapticFeedback: true,
    voiceRoomVolume: 1.0,
    bgMusicVolume: 0.5,
    joinMicMuted: true,
  });

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const data = await api.getUserSettings();
        if (isMounted && data) {
          setSettings(data);
          if (data.preferredTheme === 'light' || data.preferredTheme === 'dark') {
            setTheme(data.preferredTheme);
          }
          if (data.preferredLanguage === 'ar' || data.preferredLanguage === 'en') {
            setLocale(data.preferredLanguage);
          }
        }
      } catch (err) {
        console.warn('Failed to load user settings, using local defaults:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchSettings();
    return () => {
      isMounted = false;
    };
  }, [isOpen, setTheme, setLocale]);

  const handleToggle = (key: keyof UserSettingsDto) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await api.updateUserSettings(settings);
      if (settings.preferredTheme === 'light' || settings.preferredTheme === 'dark') {
        setTheme(settings.preferredTheme);
      }
      if (settings.preferredLanguage === 'ar' || settings.preferredLanguage === 'en') {
        setLocale(settings.preferredLanguage);
      }
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 800);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl text-zinc-900 dark:text-white space-y-5 relative z-10 max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-fuchsia-600 p-0.5 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <div className="w-full h-full bg-white dark:bg-zinc-950 rounded-[14px] flex items-center justify-center">
                  <Settings className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
                  {isArabic ? 'الإعدادات العامة' : 'Settings & Preferences'}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {isArabic
                    ? 'إدارة المظهر، الخصوصية، الإشعارات، وتفضيلات الصوت'
                    : 'Manage appearance, privacy, notifications & audio defaults'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full bg-zinc-100 dark:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-2xl overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'general'
                  ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{isArabic ? 'عام' : 'General'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'privacy'
                  ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isArabic ? 'الخصوصية' : 'Privacy'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'notifications'
                  ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{isArabic ? 'الإشعارات' : 'Alerts'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audio')}
              className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'audio'
                  ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{isArabic ? 'الصوتيات' : 'Audio'}</span>
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-400 space-y-3">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                <span className="text-xs">{isArabic ? 'جارٍ تحميل الإعدادات...' : 'Loading settings...'}</span>
              </div>
            ) : (
              <>
                {/* 1. General Tab */}
                {activeTab === 'general' && (
                  <div className="space-y-4">
                    {/* Theme Switcher */}
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-2">
                      <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                        {theme === 'dark' ? <Moon className="w-4 h-4 text-purple-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                        {isArabic ? 'نمط المظهر' : 'Appearance Theme'}
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSettings((prev) => ({ ...prev, preferredTheme: 'dark' }));
                            setTheme('dark');
                          }}
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                            settings.preferredTheme === 'dark'
                              ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-300'
                              : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          <Moon className="w-3.5 h-3.5" />
                          <span>{isArabic ? 'ليلي داكن' : 'Dark Mode'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSettings((prev) => ({ ...prev, preferredTheme: 'light' }));
                            setTheme('light');
                          }}
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                            settings.preferredTheme === 'light'
                              ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-300'
                              : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          <Sun className="w-3.5 h-3.5" />
                          <span>{isArabic ? 'نهاري فاتح' : 'Light Mode'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Language Switcher */}
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-2">
                      <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-purple-400" />
                        {isArabic ? 'لغة التطبيق' : 'App Language'}
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSettings((prev) => ({ ...prev, preferredLanguage: 'ar' }));
                            setLocale('ar');
                          }}
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                            settings.preferredLanguage === 'ar'
                              ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-300'
                              : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          <span>العربية (Arabic)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSettings((prev) => ({ ...prev, preferredLanguage: 'en' }));
                            setLocale('en');
                          }}
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                            settings.preferredLanguage === 'en'
                              ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-300'
                              : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          <span>English</span>
                        </button>
                      </div>
                    </div>

                    {/* Haptic / Interaction Feedback */}
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                          {isArabic ? 'الاهتزاز والتغذية الراجعة' : 'Haptic & UI Feedback'}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {isArabic ? 'تأثيرات عند التفاعل والأزرار' : 'Haptic response on clicks and reactions'}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.hapticFeedback}
                        onChange={() => handleToggle('hapticFeedback')}
                        className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {/* 2. Privacy Tab */}
                {activeTab === 'privacy' && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                          {isArabic ? 'حساب خاص (Private Account)' : 'Private Account'}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {isArabic ? 'لا يمكن لغير المتابعين رؤية منشوراتك وحجراتك' : 'Only approved followers can view full activity'}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.isPrivate}
                        onChange={() => handleToggle('isPrivate')}
                        className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
                      />
                    </div>

                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                          {isArabic ? 'الظهور في نتائج البحث' : 'Search Discoverability'}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {isArabic ? 'السماح للآخرين بالبحث عنك بالاسم أو المعرف' : 'Allow others to discover your profile in search'}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.isSearchDiscoverable}
                        onChange={() => handleToggle('isSearchDiscoverable')}
                        className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
                      />
                    </div>

                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                          {isArabic ? 'إظهار عدد المتابعين' : 'Show Followers Count'}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {isArabic ? 'عرض عدد المتابعين والمتابَعين في الملف الشخصي' : 'Display follower metrics on your public profile'}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.showFollowersCount}
                        onChange={() => handleToggle('showFollowersCount')}
                        className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
                      />
                    </div>

                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                          {isArabic ? 'إظهار الأوسمة والشارات' : 'Show Badges & Achievements'}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {isArabic ? 'عرض الأوسمة المكتسبة لرواد المنصة' : 'Display verified badges in community lists'}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.showBadges}
                        onChange={() => handleToggle('showBadges')}
                        className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {/* 3. Notifications Tab */}
                {activeTab === 'notifications' && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                          {isArabic ? 'دعوات المنصة الصوتية (Stage Invites)' : 'Pod & Stage Invites'}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {isArabic ? 'إشعار فوري عند دعوتك للتحدث في حجرة' : 'Instant alert when invited to speak on stage'}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.notifyStageInvites}
                        onChange={() => handleToggle('notifyStageInvites')}
                        className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
                      />
                    </div>

                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                          {isArabic ? 'أدوار سلاسل الحكايات (Chain Turns)' : 'Story Chain Turn Notifications'}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {isArabic ? 'إشعار عندما يحين دورك في السلسلة' : 'Notify when it is your turn in a collaborative loop'}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.notifyChainTurns}
                        onChange={() => handleToggle('notifyChainTurns')}
                        className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
                      />
                    </div>

                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                          {isArabic ? 'متابعون جدد (New Followers)' : 'New Followers & DJ Broadcasts'}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {isArabic ? 'إشعار عند متابعة حسابك أو بدء بث DJ لمتابَع' : 'Alerts for new followers and live broadcasts'}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.notifyFollows}
                        onChange={() => handleToggle('notifyFollows')}
                        className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {/* 4. Audio Tab */}
                {activeTab === 'audio' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                          <MicOff className="w-4 h-4 text-purple-500" />
                          {isArabic ? 'كتم المايك عند الانضمام' : 'Join Mic Muted by Default'}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {isArabic ? 'الدخول إلى الحجرات الصوتية بوضع صامت لتفادي الضجيج' : 'Prevents accidental noise when entering voice pods'}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.joinMicMuted}
                        onChange={() => handleToggle('joinMicMuted')}
                        className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
                      />
                    </div>

                    {/* Room Volume Slider */}
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-zinc-700 dark:text-zinc-300">
                          {isArabic ? 'مستوى صوت المتحدثين الافتراضي' : 'Default Room Voice Volume'}
                        </span>
                        <span className="font-mono text-purple-600 dark:text-purple-400">
                          {Math.round(settings.voiceRoomVolume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={settings.voiceRoomVolume}
                        onChange={(e) =>
                          setSettings((prev) => ({ ...prev, voiceRoomVolume: parseFloat(e.target.value) }))
                        }
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                    </div>

                    {/* BG Music Volume Slider */}
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-zinc-700 dark:text-zinc-300">
                          {isArabic ? 'مستوى صوت الموسيقى الخلفية (DJ)' : 'Default Background Music Volume'}
                        </span>
                        <span className="font-mono text-fuchsia-600 dark:text-fuchsia-400">
                          {Math.round(settings.bgMusicVolume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={settings.bgMusicVolume}
                        onChange={(e) =>
                          setSettings((prev) => ({ ...prev, bgMusicVolume: parseFloat(e.target.value) }))
                        }
                        className="w-full accent-fuchsia-600 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              {isArabic ? 'إلغاء' : 'Cancel'}
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{isArabic ? 'جارٍ الحفظ...' : 'Saving...'}</span>
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>{isArabic ? 'تم الحفظ بنجاح!' : 'Saved!'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'حفظ التعديلات' : 'Save Changes'}</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

