import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { api } from '../../services/apiClient';
import {
  Sparkles,
  UserPlus,
  LogIn,
  Mail,
  Lock,
  User,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Shuffle,
  ShieldCheck,
  Eye,
  EyeOff,
  RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AVATAR_STYLES = ['bottts', 'adventurer', 'fun-emoji', 'lorelei', 'avataaars'];

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, authModalTab, authVerificationEmail, closeAuthModal, setAuthResult, setUser } = useAuthStore();
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  const [tab, setTab] = useState<'login' | 'register' | 'verify'>('login');

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [avatarSeed, setAvatarSeed] = useState(() => Math.random().toString(36).substring(2, 8));
  const [avatarStyle, setAvatarStyle] = useState('bottts');

  // Verify Email form state
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Status & Feedback
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthModalOpen) {
      setTab(authModalTab);
      if (authVerificationEmail) {
        setVerifyEmail(authVerificationEmail);
      }
      setError(null);
      setSuccessMsg(null);
    }
  }, [isAuthModalOpen, authModalTab, authVerificationEmail]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  if (!isAuthModalOpen) return null;

  const generatedAvatarUrl = `https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${encodeURIComponent(avatarSeed || 'spark')}`;

  const handleRandomizeAvatar = () => {
    setAvatarSeed(Math.random().toString(36).substring(2, 9));
    const randomStyle = AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)];
    setAvatarStyle(randomStyle);
  };

  // 1. Handle Standard Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const identifier = loginIdentifier.trim();
    if (!identifier) {
      setError(isArabic ? 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني' : 'Please enter your username or email');
      return;
    }

    setIsLoading(true);
    try {
      const result = await api.login(identifier, loginPassword || undefined);
      setAuthResult(result);
      setSuccessMsg(isArabic ? `مرحباً بك مجدداً يا ${result.user.displayName}! ✨` : `Welcome back, ${result.user.displayName}! ✨`);
      setTimeout(() => {
        setIsLoading(false);
        closeAuthModal();
      }, 500);
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  };

  // 2. Handle Registration with Password Confirmation
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanUsername = regUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanUsername || cleanUsername.length < 3) {
      setError(isArabic ? 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل (حروف وأرقام إنجليزية)' : 'Username must be at least 3 alphanumeric characters');
      return;
    }

    if (!regDisplayName.trim()) {
      setError(isArabic ? 'يرجى إدخال الاسم المعروض' : 'Display name is required');
      return;
    }

    const cleanEmail = regEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError(isArabic ? 'يرجى إدخال بريد إلكتروني صحيح' : 'Please enter a valid email address');
      return;
    }

    if (!regPassword || regPassword.length < 6) {
      setError(isArabic ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError(isArabic ? 'كلمة المرور وتأكيدها غير متطابقين!' : 'Passwords do not match!');
      return;
    }

    setIsLoading(true);
    try {
      const result = await api.register({
        username: cleanUsername,
        displayName: regDisplayName.trim(),
        email: cleanEmail,
        password: regPassword,
        avatarUrl: generatedAvatarUrl,
        bio: isArabic ? 'صانع محتوى في SparkLoop' : 'SparkLoop Creator & Storyteller',
      });

      setAuthResult(result);
      setVerifyEmail(cleanEmail);
      setSuccessMsg(isArabic ? 'تم إنشاء الحساب بنجاح! يرجى تأكيد بريدك الإلكتروني.' : 'Account created! Please confirm your email.');
      setTab('verify');
      setIsLoading(false);
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  };

  // 3. Handle Email Verification Code
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const code = verificationCode.trim();
    if (!code || code.length < 4) {
      setError(isArabic ? 'يرجى إدخال رمز التحقق المكون من 6 أرقام' : 'Please enter the 6-digit verification code');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.verifyEmail(verifyEmail, code);
      if (res.success) {
        if (res.user) {
          setUser(res.user);
        }
        setSuccessMsg(isArabic ? 'تم تأكيد البريد الإلكتروني بنجاح! 🚀' : 'Email confirmed successfully! 🚀');
        setTimeout(() => {
          setIsLoading(false);
          closeAuthModal();
        }, 1200);
      } else {
        setIsLoading(false);
        setError(res.message);
      }
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  };

  // 4. Handle Resend Verification Code
  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.resendVerificationCode(verifyEmail);
      setSuccessMsg(
        isArabic
          ? `تم إرسال رمز جديد إلى بريدك! ${res.code ? `(رمز الاختبار: ${res.code})` : ''}`
          : `Verification code sent! ${res.code ? `(Dev Code: ${res.code})` : ''}`
      );
      setResendCooldown(60);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  };

  // 5. Handle Social Login (Google, Facebook, Twitter)
  // 5. Handle Real Social Login via OAuth 2.0 Popup (Google, Facebook, Twitter)
  const handleSocialAuth = async (provider: 'google' | 'facebook' | 'twitter') => {
    setError(null);
    setSuccessMsg(null);
    setSocialLoading(provider);

    try {
      const redirectUri = `${window.location.origin}/oauth-callback.html`;
      const { url } = await api.getOAuthUrl(provider, redirectUri, 'login');

      // Center popup window
      const width = 560;
      const height = 650;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        url,
        `sparkloop_oauth_${provider}`,
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        throw new Error(isArabic ? 'تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.' : 'Popup blocked. Please allow popups for SparkLoop.');
      }

      // Listen for message from popup
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (!event.data || event.data.type !== 'SPARKLOOP_OAUTH_RESPONSE') return;

        window.removeEventListener('message', handleMessage);

        const { code, state, error: oauthError } = event.data;

        if (oauthError) {
          setSocialLoading(null);
          setError(oauthError);
          return;
        }

        if (!code || !state) {
          setSocialLoading(null);
          setError(isArabic ? 'لم يتم استلام رمز التوثيق من المزود' : 'No authorization code received from provider');
          return;
        }

        try {
          const authResult = await api.processOAuthCallback(provider, {
            code,
            state,
            redirectUri,
            deviceName: `${provider.toUpperCase()} Web Client`,
            deviceType: 'web',
          });

          setAuthResult(authResult);
          setSuccessMsg(
            isArabic
              ? `تم تسجيل الدخول بنجاح عبر ${provider.toUpperCase()}! مرحباً بك يا ${authResult.user.displayName} ✨`
              : `Successfully signed in with ${provider.toUpperCase()}! Welcome, ${authResult.user.displayName} ✨`
          );

          setTimeout(() => {
            setSocialLoading(null);
            closeAuthModal();
          }, 800);
        } catch (err: unknown) {
          setSocialLoading(null);
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
        }
      };

      window.addEventListener('message', handleMessage);

      // Polling fallback to detect if user closed popup without completing
      const pollTimer = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollTimer);
          setTimeout(() => {
            setSocialLoading((current) => (current === provider ? null : current));
          }, 500);
        }
      }, 500);
    } catch (err: unknown) {
      setSocialLoading(null);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-md p-6 bg-white dark:bg-[#131b28] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl space-y-4 text-slate-900 dark:text-white overflow-hidden max-h-[90vh] overflow-y-auto no-scrollbar"
          dir={isArabic ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">
                  {tab === 'verify'
                    ? (isArabic ? 'تأكيد البريد الإلكتروني' : 'Verify Email')
                    : tab === 'register'
                    ? (isArabic ? 'إنشاء حساب صانع جديد' : 'Create Creator Account')
                    : (isArabic ? 'تسجيل الدخول' : 'Sign in to SparkLoop')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {tab === 'verify'
                    ? (isArabic ? 'أدخل الرمز المكون من 6 أرقام لتفعيل حسابك' : 'Enter 6-digit code to activate your account')
                    : tab === 'register'
                    ? (isArabic ? 'انضم إلى مجتمع الميمز والقصص التفاعلية' : 'Join the interactive storytelling and memes loop')
                    : (isArabic ? 'مرحباً بك مجدداً في استوديو SparkLoop' : 'Welcome back to SparkLoop studio')}
                </p>
              </div>
            </div>

            <button
              onClick={closeAuthModal}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Selector (Login / Register) */}
          {tab !== 'verify' && (
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-[#0b0f17] rounded-2xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  tab === 'login'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{isArabic ? 'تسجيل الدخول' : 'Sign In'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  tab === 'register'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isArabic ? 'حساب جديد' : 'Register'}</span>
              </button>
            </div>
          )}

          {/* Social Logins Bar */}
          {tab !== 'verify' && (
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-3 gap-2">
                {/* Google */}
                <button
                  type="button"
                  disabled={isLoading || !!socialLoading}
                  onClick={() => handleSocialAuth('google')}
                  className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {socialLoading === 'google' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span className="text-red-500 font-black">G</span>
                  )}
                  <span>Google</span>
                </button>

                {/* Facebook */}
                <button
                  type="button"
                  disabled={isLoading || !!socialLoading}
                  onClick={() => handleSocialAuth('facebook')}
                  className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {socialLoading === 'facebook' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span className="text-blue-600 font-black">f</span>
                  )}
                  <span>Facebook</span>
                </button>

                {/* Twitter / X */}
                <button
                  type="button"
                  disabled={isLoading || !!socialLoading}
                  onClick={() => handleSocialAuth('twitter')}
                  className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {socialLoading === 'twitter' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span className="text-slate-900 dark:text-white font-black">𝕏</span>
                  )}
                  <span>Twitter / X</span>
                </button>
              </div>

              <div className="relative flex items-center justify-center py-1">
                <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
                <span className="bg-white dark:bg-[#131b28] px-2 text-[10px] text-slate-400 font-bold uppercase shrink-0">
                  {isArabic ? 'أو عبر البريد المباشر' : 'Or with Email'}
                </span>
              </div>
            </div>
          )}

          {/* Feedback Messages */}
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-2xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-2xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {isArabic ? 'اسم المستخدم أو البريد الإلكتروني' : 'Username or Email'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder={isArabic ? 'مثال: alice أو creator@sparkloop.app' : 'e.g. alice or creator@sparkloop.app'}
                    className="w-full bg-slate-50 dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white pl-9 rtl:pl-3.5 rtl:pr-9 focus:outline-none focus:border-indigo-500 shadow-sm"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {isArabic ? 'كلمة المرور' : 'Password'}
                </label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white pl-9 pr-9 rtl:pl-9 rtl:pr-9 focus:outline-none focus:border-indigo-500 shadow-sm"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                <span>{isLoading ? (isArabic ? 'جاري التحقق...' : 'Signing in...') : (isArabic ? 'تسجيل الدخول' : 'Sign In')}</span>
              </button>
            </form>
          )}

          {/* TAB 2: REGISTER */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              {/* Avatar Generator */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                <img
                  src={generatedAvatarUrl}
                  alt="Avatar preview"
                  className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 border-2 border-indigo-500/40 object-cover shadow-sm shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                    {isArabic ? 'الصورة الرمزية التلقائية' : 'Avatar generator'}
                  </div>
                  <button
                    type="button"
                    onClick={handleRandomizeAvatar}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-colors shadow-sm"
                  >
                    <Shuffle className="w-3 h-3 text-indigo-500" />
                    <span>{isArabic ? 'تغيير الشكل' : 'Randomize'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    {isArabic ? 'اسم المستخدم (User handle)' : 'Username'}
                  </label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="e.g. sam_creator"
                    className="w-full bg-slate-50 dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 shadow-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    {isArabic ? 'الاسم الظاهر (Display Name)' : 'Display Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={regDisplayName}
                    onChange={(e) => setRegDisplayName(e.target.value)}
                    placeholder={isArabic ? 'مثال: سامر صانع الميمز' : 'e.g. Sam The Creator'}
                    className="w-full bg-slate-50 dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {isArabic ? 'البريد الإلكتروني (فريد)' : 'Email Address (Unique)'}
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="creator@domain.com"
                    className="w-full bg-slate-50 dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white pl-8 rtl:pl-3 rtl:pr-8 focus:outline-none focus:border-indigo-500 shadow-sm"
                  />
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 rtl:left-auto rtl:right-2.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    {isArabic ? 'كلمة المرور' : 'Password'}
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min. 6 chars"
                      className="w-full bg-slate-50 dark:bg-[#0b0f17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white pr-8 rtl:pr-3 rtl:pl-8 focus:outline-none focus:border-indigo-500 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-2.5 rtl:right-auto rtl:left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      {isArabic ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                    </label>
                    {regConfirmPassword && (
                      <span className={`text-[10px] font-bold ${regPassword === regConfirmPassword ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {regPassword === regConfirmPassword ? (isArabic ? '✓ متطابقة' : '✓ Match') : (isArabic ? '✕ غير متطابقة' : '✕ Mismatch')}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showRegConfirmPassword ? 'text' : 'password'}
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Re-type password"
                      className={`w-full bg-slate-50 dark:bg-[#0b0f17] border rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white pr-8 rtl:pr-3 rtl:pl-8 focus:outline-none shadow-sm ${
                        regConfirmPassword && regPassword !== regConfirmPassword
                          ? 'border-rose-500 focus:border-rose-500'
                          : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                      className="absolute right-2.5 rtl:right-auto rtl:left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showRegConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 pt-2"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                <span>{isLoading ? (isArabic ? 'جاري التسجيل...' : 'Creating Account...') : (isArabic ? 'إنشاء الحساب وتأكيد البريد' : 'Register & Confirm Email')}</span>
              </button>
            </form>
          )}

          {/* TAB 3: VERIFY EMAIL */}
          {tab === 'verify' && (
            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-500/30 rounded-2xl text-center space-y-1">
                <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                  {isArabic ? 'تم إرسال رمز التحقق إلى:' : 'Verification code sent to:'}
                </div>
                <div className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                  {verifyEmail}
                </div>
              </div>

              <div className="space-y-1.5 text-center">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isArabic ? 'رمز التحقق (6 أرقام)' : '6-Digit Verification Code'}
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="123456"
                  className="w-full max-w-[200px] mx-auto text-center tracking-[0.5em] font-mono text-lg font-black bg-slate-50 dark:bg-[#0b0f17] border border-slate-300 dark:border-slate-700 rounded-xl py-2.5 focus:outline-none focus:border-indigo-500 shadow-inner"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={resendCooldown > 0}
                  onClick={handleResendCode}
                  className="flex-1 py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>
                    {resendCooldown > 0
                      ? `${resendCooldown}s`
                      : (isArabic ? 'إعادة إرسال الرمز' : 'Resend Code')}
                  </span>
                </button>

                <button
                  type="submit"
                  disabled={isLoading || verificationCode.length < 4}
                  className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>{isArabic ? 'تأكيد الحساب' : 'Verify & Continue'}</span>
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

