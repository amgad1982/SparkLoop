import React, { useState } from 'react';
import { useAuthStore, PRESET_PERSONAS, Persona } from '../../stores/useAuthStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { api } from '../../services/apiClient';
import { ShieldCheck, Sparkles, UserCheck, UserPlus, X, RefreshCw, AlertCircle, CheckCircle2, Users, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PersonaSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'switch' | 'register';
}

const AVATAR_STYLES = ['bottts', 'adventurer', 'fun-emoji', 'lorelei', 'avataaars'];

export const PersonaSwitcher: React.FC<PersonaSwitcherProps> = ({
  isOpen,
  onClose,
  initialTab = 'switch',
}) => {
  const { currentPersona, customPersonas, setPersona, addCustomPersona, setUser, logout } = useAuthStore();
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  const [activeTab, setActiveTab] = useState<'switch' | 'register'>(initialTab);

  // Registration Form State
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [avatarSeed, setAvatarSeed] = useState(() => Math.random().toString(36).substring(2, 8));
  const [avatarStyle, setAvatarStyle] = useState('bottts');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const generatedAvatarUrl = `https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${encodeURIComponent(avatarSeed || 'spark')}`;

  const handleRandomizeAvatar = () => {
    setAvatarSeed(Math.random().toString(36).substring(2, 9));
    const randomStyle = AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)];
    setAvatarStyle(randomStyle);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanUsername || cleanUsername.length < 3) {
      setError(isArabic ? 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل (حروف وأرقام إنجليزية)' : 'Username must be at least 3 alphanumeric characters');
      return;
    }

    if (!displayName.trim()) {
      setError(isArabic ? 'يرجى كتابة الاسم المستعار الظاهر' : 'Display name is required');
      return;
    }

    if (password && password.length < 6) {
      setError(isArabic ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }

    const cleanEmail = email.trim() || `${cleanUsername}@sparkloop.app`;
    setIsLoading(true);

    try {
      const authResult = await api.register({
        username: cleanUsername,
        displayName: displayName.trim(),
        email: cleanEmail,
        password: password || undefined,
        avatarUrl: generatedAvatarUrl,
        bio: bio.trim() || (isArabic ? 'صانع محتوى في SparkLoop' : 'SparkLoop Creator & Storyteller'),
      });

      const newPersona: Persona = {
        id: authResult.user.id,
        username: authResult.user.username,
        displayName: authResult.user.displayName,
        avatarUrl: authResult.user.avatarUrl || generatedAvatarUrl,
        role: bio.trim() || (isArabic ? 'مبدع جديد' : 'New Creator'),
        isCustom: true,
      };

      addCustomPersona(newPersona);
      setPersona(newPersona);
      setUser(authResult.user);

      setSuccessMessage(isArabic ? 'تم إنشاء الحساب بنجاح! مرحباً بك ✨' : 'Account registered successfully! Welcome aboard ✨');

      setTimeout(() => {
        setIsLoading(false);
        onClose();
      }, 1000);
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  };

  const allAvailablePersonas = [...customPersonas, ...PRESET_PERSONAS];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md p-6 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl space-y-4 text-white overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-fuchsia-400" />
                  {isArabic ? 'الحسابات والشخصيات' : 'Accounts & Personas'}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {isArabic
                    ? 'أنشئ حسابك الخاص أو بدّل بين الشخصيات التجريبية'
                    : 'Create your custom account or test with demo personas'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-white rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-950 rounded-2xl border border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('switch');
                  setError(null);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'switch'
                    ? 'bg-zinc-800 text-white shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{isArabic ? 'تبديل الشخصية' : 'Select Persona'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setError(null);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'register'
                    ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isArabic ? 'إنشاء حساب جديد' : 'Register Account'}</span>
              </button>
            </div>

            {/* Tab 1: Persona Switcher */}
            {activeTab === 'switch' && (
              <div className="space-y-3">
                <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                  {allAvailablePersonas.map((persona) => {
                    const isSelected = currentPersona.id === persona.id;
                    return (
                      <button
                        key={persona.id}
                        onClick={() => {
                          setPersona(persona);
                          onClose();
                        }}
                        className={`w-full p-3 flex items-center gap-3.5 rounded-2xl border transition-all text-left rtl:text-right ${
                          isSelected
                            ? 'bg-fuchsia-950/40 border-fuchsia-500/80 ring-1 ring-fuchsia-500'
                            : 'bg-zinc-800/50 border-zinc-700/60 hover:bg-zinc-800 hover:border-zinc-600'
                        }`}
                      >
                        <img
                          src={persona.avatarUrl}
                          alt={persona.username}
                          className="w-11 h-11 rounded-2xl bg-zinc-800 border border-zinc-700 object-cover flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-zinc-100 truncate">
                              {persona.displayName}
                            </span>
                            {persona.isCustom && (
                              <span className="px-1.5 py-0.2 text-[9px] font-bold bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/30">
                                {isArabic ? 'حسابك' : 'YOU'}
                              </span>
                            )}
                            {isSelected && (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-fuchsia-500/20 text-fuchsia-300 rounded-full border border-fuchsia-500/30">
                                {isArabic ? 'نشط' : 'ACTIVE'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 truncate">
                            @{persona.username} • {persona.role}
                          </p>
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

                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('register')}
                    className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-750 border border-dashed border-zinc-700 hover:border-fuchsia-500/60 rounded-2xl text-xs font-bold text-zinc-300 hover:text-white flex items-center justify-center gap-2 transition-all"
                  >
                    <UserPlus className="w-4 h-4 text-fuchsia-400" />
                    <span>{isArabic ? '+ إنشاء حساب جديد مخصص' : '+ Register a New Custom Persona'}</span>
                  </button>

                  {currentPersona.username !== 'guest' && (
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        onClose();
                      }}
                      className="w-full py-2 px-4 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 rounded-2xl text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center justify-center gap-2 transition-all"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{isArabic ? 'تسجيل الخروج' : 'Log Out'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Registration Form */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
                {/* Avatar Generator Preview */}
                <div className="p-3.5 bg-zinc-950/80 rounded-2xl border border-zinc-800 flex items-center gap-4">
                  <div className="relative group">
                    <img
                      src={generatedAvatarUrl}
                      alt="Avatar Preview"
                      className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-700 object-cover shadow-inner"
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-300">
                        {isArabic ? 'صورة الحساب الرمزية' : 'Avatar Generator'}
                      </span>
                      <button
                        type="button"
                        onClick={handleRandomizeAvatar}
                        className="px-2.5 py-1 bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-[11px] font-semibold text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>{isArabic ? 'شكل عشوائي' : 'Randomize'}</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      {isArabic ? 'يتم توليد الأفاتار تلقائياً من نمط الروبوتات والأشكال' : 'Vector avatar generated via DiceBear'}
                    </p>
                  </div>
                </div>

                {/* Username Input */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">
                    {isArabic ? 'اسم المستخدم (Username)' : 'Username'} <span className="text-fuchsia-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 rtl:left-auto rtl:right-3 flex items-center text-zinc-500 text-xs font-bold">
                      @
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. maya_spark"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-fuchsia-500 rounded-xl px-3 pl-8 rtl:pl-3 rtl:pr-8 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 transition-all"
                    />
                  </div>
                </div>

                {/* Display Name Input */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">
                    {isArabic ? 'الاسم المعروض (Display Name)' : 'Display Name (Supports Arabic & Emoji)'} <span className="text-fuchsia-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isArabic ? 'مثال: سارة المصممة 🎨' : 'e.g. Maya The Creator 🚀'}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 transition-all"
                  />
                </div>

                {/* Email Input */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">
                    {isArabic ? 'البريد الإلكتروني' : 'Email Address'} <span className="text-fuchsia-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 transition-all"
                  />
                </div>

                {/* Password Input */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">
                    {isArabic ? 'كلمة المرور (Password)' : 'Password'} <span className="text-fuchsia-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="•••••••• (min. 6 chars)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 transition-all"
                  />
                </div>

                {/* Bio / Tagline Input */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">
                    {isArabic ? 'النبذة التعريفية (Bio)' : 'Bio / Short Tagline'}
                  </label>
                  <input
                    type="text"
                    placeholder={isArabic ? 'راوية قصص، صانعة ميمز، مهتمة بالذكاء الاصطناعي' : 'Storyteller, Meme Crafter, Synthwave lover'}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-fuchsia-500 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 transition-all"
                  />
                </div>

                {/* Error Banner */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-950/50 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
                    <span>{error}</span>
                  </motion.div>
                )}

                {/* Success Banner */}
                {successMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-emerald-950/50 border border-emerald-800/80 rounded-xl text-xs text-emerald-300 flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                    <span>{successMessage}</span>
                  </motion.div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-fuchsia-600/20 active:scale-98 transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>
                    {isLoading
                      ? (isArabic ? 'جاري التسجيل...' : 'Registering Account...')
                      : (isArabic ? 'إنشاء الحساب والبدء فوراً' : 'Complete Registration & Start')}
                  </span>
                </button>
              </form>
            )}

            {/* Footer note */}
            <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                {isArabic ? 'نظام هويات SparkLoop اللحظي' : 'SparkLoop Identity & JWT Secure'}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-white font-medium text-xs transition-colors"
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
