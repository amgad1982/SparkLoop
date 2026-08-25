import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore, Persona } from '../../stores/useAuthStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { api, getMediaUrl } from '../../services/apiClient';
import { UserProfileDto } from '../../types/api';
import { PersonaSwitcher } from '../layout/PersonaSwitcher';
import { Tooltip } from '../ui/Tooltip';
import { FollowButton } from '../ui/FollowButton';
import { FollowListModal } from './FollowListModal';
import { FollowRequestsDrawer } from './FollowRequestsDrawer';
import {
  AlertCircle,
  Award,
  Bell,
  Calendar,
  Camera,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  Flame,
  GitBranch,
  Globe,
  Heart,
  Key,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Moon,
  RefreshCw,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Sun,
  Trophy,
  Upload,
  User,
  UserCheck,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';

interface ProfileViewProps {
  username?: string;
  onOpenCanvas?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ username, onOpenCanvas }) => {
  const { currentPersona, setPersona, addCustomPersona, logout } = useAuthStore();
  const { locale, theme, setTheme, setLocale } = useThemeStore();
  const isArabic = locale === 'ar';

  const targetUsername = username || currentPersona.username;
  const isOwnProfile = targetUsername.toLowerCase() === currentPersona.username.toLowerCase();

  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'edit' | 'security'>('portfolio');
  const [portfolioSubTab, setPortfolioSubTab] = useState<'posts' | 'chains' | 'badges'>('posts');

  // Switcher Modal State
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

  // Follow Modals & Drawers State
  const [isFollowListOpen, setIsFollowListOpen] = useState(false);
  const [followListType, setFollowListType] = useState<'followers' | 'following'>('followers');
  const [isRequestsDrawerOpen, setIsRequestsDrawerOpen] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const fetchPendingRequestsCount = async () => {
    if (!isOwnProfile) return;
    try {
      const pending = await api.getPendingFollowRequests();
      setPendingRequestsCount(pending.length);
    } catch {
      // ignore
    }
  };

  // Edit Profile Form State
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editPreferredTheme, setEditPreferredTheme] = useState<'dark' | 'light'>(theme);
  const [editPreferredLanguage, setEditPreferredLanguage] = useState<'en' | 'ar'>(locale);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const data = await api.getUserProfile(targetUsername);
        setProfile(data);
        setEditDisplayName(data.displayName || '');
        setEditBio(data.bio || '');
        setEditEmail(data.email || '');
        setEditAvatarUrl(data.avatarUrl || currentPersona.avatarUrl);
        setEditPreferredTheme(data.preferredTheme || theme);
        setEditPreferredLanguage(data.preferredLanguage || locale);
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
    fetchPendingRequestsCount();
  }, [targetUsername, currentPersona.username]);

  // Handle Photo File Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setProfileMessage({
        type: 'error',
        text: isArabic ? 'حجم الصورة يجب ألا يتجاوز 5 ميغابايت.' : 'Image size must not exceed 5MB.',
      });
      return;
    }

    setIsUploadingPhoto(true);
    setProfileMessage(null);

    try {
      const media = await api.uploadMedia(file);
      setEditAvatarUrl(media.url);
      setProfileMessage({
        type: 'success',
        text: isArabic ? 'تم رفع الصورة بنجاح! احفظ التعديلات لتطبيقها.' : 'Photo uploaded! Save changes to apply.',
      });
    } catch (err: unknown) {
      console.error('Upload photo error:', err);
      setProfileMessage({
        type: 'error',
        text: isArabic ? 'فشل رفع الصورة. يرجى المحاولة مرة أخرى.' : 'Failed to upload photo. Please try again.',
      });
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Randomize Avatar Seed using Dicebear
  const randomizeAvatar = () => {
    const styles = ['bottts', 'adventurer', 'fun-emoji', 'micah', 'thumbs'];
    const randomStyle = styles[Math.floor(Math.random() * styles.length)];
    const randomSeed = Math.random().toString(36).substring(2, 9);
    const newAvatar = `https://api.dicebear.com/7.x/${randomStyle}/svg?seed=${randomSeed}`;
    setEditAvatarUrl(newAvatar);
  };

  // Handle Save Profile Details
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsSavingProfile(true);
    setProfileMessage(null);

    try {
      const updated = await api.updateProfile({
        displayName: editDisplayName.trim(),
        bio: editBio.trim(),
        avatarUrl: editAvatarUrl.trim(),
        email: editEmail.trim(),
        preferredTheme: editPreferredTheme,
        preferredLanguage: editPreferredLanguage,
      });

      // Apply theme and locale immediately
      setTheme(editPreferredTheme, false);
      setLocale(editPreferredLanguage, false);

      const updatedPersona: Persona = {
        id: updated.id,
        username: updated.username,
        displayName: updated.displayName,
        avatarUrl: updated.avatarUrl || editAvatarUrl,
        role: updated.bio || currentPersona.role,
        isCustom: true,
      };

      setPersona(updatedPersona);
      addCustomPersona(updatedPersona);

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              displayName: updated.displayName,
              bio: updated.bio || '',
              avatarUrl: updated.avatarUrl || editAvatarUrl,
              email: updated.email || editEmail,
              preferredTheme: updated.preferredTheme || editPreferredTheme,
              preferredLanguage: updated.preferredLanguage || editPreferredLanguage,
            }
          : null
      );

      setProfileMessage({
        type: 'success',
        text: isArabic ? 'تم حفظ بيانات الملف الشخصي بنجاح!' : 'Profile updated successfully!',
      });
    } catch (err: unknown) {
      console.error('Update profile error:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to update profile.';
      setProfileMessage({
        type: 'error',
        text: isArabic ? `خطأ: ${errMsg}` : `Error: ${errMsg}`,
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 6) {
      setPasswordMessage({
        type: 'error',
        text: isArabic
          ? 'كلمة المرور الجديدة يجب أن تتكون من 6 أحرف على الأقل.'
          : 'New password must be at least 6 characters long.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({
        type: 'error',
        text: isArabic ? 'كلمة المرور وتأكيدها غير متطابقين.' : 'New password and confirmation do not match.',
      });
      return;
    }

    setIsChangingPassword(true);

    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordMessage({
        type: 'success',
        text: isArabic ? 'تم تغيير كلمة المرور بنجاح!' : 'Password changed successfully!',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      console.error('Change password error:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to change password.';
      setPasswordMessage({
        type: 'error',
        text: isArabic ? `خطأ: ${errMsg}` : `Error: ${errMsg}`,
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getRepTier = (rep: number) => {
    if (rep >= 500)
      return {
        name: isArabic ? 'الماسي 💎' : 'Diamond Tier 💎',
        max: 1000,
        color: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10',
      };
    if (rep >= 300)
      return {
        name: isArabic ? 'الذهبي 🥇' : 'Gold Tier 🥇',
        max: 500,
        color: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
      };
    if (rep >= 150)
      return {
        name: isArabic ? 'الفضي 🥈' : 'Silver Tier 🥈',
        max: 300,
        color: 'text-zinc-300 border-zinc-500/40 bg-zinc-500/10',
      };
    return {
      name: isArabic ? 'البرونزي 🥉' : 'Bronze Tier 🥉',
      max: 150,
      color: 'text-orange-400 border-orange-500/40 bg-orange-500/10',
    };
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3 text-zinc-400">
        <RefreshCw className="w-7 h-7 animate-spin text-fuchsia-400" />
        <p className="text-xs font-semibold">
          {isArabic ? 'جاري تحميل الملف الشخصي...' : 'Loading creator profile...'}
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center glass-card rounded-3xl space-y-3">
        <User className="w-12 h-12 text-zinc-600 mx-auto" />
        <h3 className="text-base font-bold text-zinc-200">
          {isArabic ? 'المستخدم غير موجود' : 'User profile not found'}
        </h3>
      </div>
    );
  }

  const repTier = getRepTier(profile.repScore);
  const repProgress = Math.min(100, Math.round((profile.repScore / repTier.max) * 100));

  return (
    <div className="space-y-6 text-zinc-900 dark:text-white pb-10 transition-colors duration-200">
      {/* 1. Header Banner & Profile Info Card */}
      <div className="glass-card rounded-3xl border border-zinc-200 dark:border-zinc-800/80 overflow-hidden shadow-2xl relative">
        {/* Banner Graphic */}
        <div className="h-32 sm:h-44 w-full bg-gradient-to-r from-fuchsia-900 via-purple-900 to-cyan-900 relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-fuchsia-500/20 via-transparent to-transparent" />
          <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-md ${repTier.color}`}>
              {repTier.name}
            </span>
          </div>
        </div>

        {/* Profile Details Bar */}
        <div className="px-6 sm:px-8 pb-7 relative -mt-14 sm:-mt-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            {/* Large Avatar with Online / Creator Status */}
            <div className="relative group">
              <img
                src={getMediaUrl(profile.avatarUrl) || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.username}`}
                alt={profile.username}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-zinc-100 dark:bg-zinc-900 border-4 border-white dark:border-zinc-950 object-cover shadow-2xl transition-colors"
              />
              <div className="absolute bottom-1 right-1 rtl:right-auto rtl:left-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white dark:border-zinc-950" />

              {isOwnProfile && (
                <Tooltip content={isArabic ? 'تغيير الصورة الشخصية' : 'Change Profile Avatar'} position="top">
                  <button
                    onClick={() => {
                      setActiveTab('edit');
                      fileInputRef.current?.click();
                    }}
                    className="absolute inset-0 bg-black/60 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1 border-4 border-transparent"
                  >
                    <Camera className="w-5 h-5 text-fuchsia-400" />
                    <span>{isArabic ? 'تغيير' : 'Upload'}</span>
                  </button>
                </Tooltip>
              )}
            </div>

            {/* Actions: Portfolio / Edit Profile / Security / Switch Persona / Follow */}
            {isOwnProfile ? (
              <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
                <Tooltip content={isArabic ? 'عرض الأوسمة والمشاركات' : 'View your badges and creations'} position="top">
                  <button
                    onClick={() => setActiveTab('portfolio')}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeTab === 'portfolio'
                        ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-600/30'
                        : 'bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'الأعمال والأوسمة' : 'Portfolio'}</span>
                  </button>
                </Tooltip>

                <Tooltip content={isArabic ? 'عرض وإدارة طلبات المتابعة المعلقة' : 'View pending follow requests'} position="top">
                  <button
                    onClick={() => setIsRequestsDrawerOpen(true)}
                    className="relative px-3.5 py-2.5 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <Bell className="w-3.5 h-3.5 text-amber-500" />
                    <span className="hidden sm:inline">{isArabic ? 'طلبات المتابعة' : 'Requests'}</span>
                    {pendingRequestsCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-black animate-pulse">
                        {pendingRequestsCount}
                      </span>
                    )}
                  </button>
                </Tooltip>

                <Tooltip content={isArabic ? 'تعديل البيانات والمظهر واللغة' : 'Edit profile info, theme & language'} position="top">
                  <button
                    onClick={() => setActiveTab('edit')}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeTab === 'edit'
                        ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-600/30'
                        : 'bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'تعديل البيانات' : 'Edit Profile'}</span>
                  </button>
                </Tooltip>

                <Tooltip content={isArabic ? 'تغيير كلمة المرور وإعدادات الأمان' : 'Change password & security'} position="top">
                  <button
                    onClick={() => setActiveTab('security')}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeTab === 'security'
                        ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-600/30'
                        : 'bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'الأمان وكلمة المرور' : 'Security'}</span>
                  </button>
                </Tooltip>

                <Tooltip content={isArabic ? 'تبديل الحساب / تسجيل مستخدم جديد' : 'Switch Account / New User'} position="top">
                  <button
                    onClick={() => setIsSwitcherOpen(true)}
                    className="px-3.5 py-2.5 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <Users className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
                    <span className="hidden sm:inline">{isArabic ? 'تبديل الحساب' : 'Switch'}</span>
                  </button>
                </Tooltip>

                {currentPersona.username !== 'guest' && (
                  <Tooltip content={isArabic ? 'تسجيل الخروج من الحساب' : 'Log out of current persona'} position="top">
                    <button
                      onClick={() => logout()}
                      className="px-3.5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 rounded-2xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{isArabic ? 'خروج' : 'Log Out'}</span>
                    </button>
                  </Tooltip>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 self-start sm:self-auto">
                <FollowButton
                  targetUserId={profile.id}
                  targetUsername={profile.username}
                  initialStatus={profile.followStatus as any}
                  size="md"
                  onStatusChange={(newStatus) => {
                    setProfile((prev) =>
                      prev
                        ? {
                            ...prev,
                            followStatus: newStatus,
                            followersCount:
                              newStatus === 'following' || newStatus === 'mutual'
                                ? (prev.followersCount || 0) + 1
                                : Math.max(0, (prev.followersCount || 0) - 1),
                          }
                        : null
                    );
                  }}
                />
              </div>
            )}
          </div>

          {/* User Bio & Meta */}
          <div className="mt-5 space-y-2.5">
            <div className="flex items-center gap-3">
              <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                {profile.displayName}
              </h2>
              <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-semibold">@{profile.username}</span>
            </div>

            <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 max-w-2xl leading-relaxed">
              {profile.bio ||
                (isArabic
                  ? 'صانع محتوى وميمز ومشارك في سلاسل SparkLoop القصصية'
                  : 'SparkLoop Creator & Storyteller')}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 pt-1.5">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                <span>{profile.email}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                <span>
                  {isArabic ? 'انضم في' : 'Joined'} {new Date(profile.createdAtUtc).toLocaleDateString()}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>{isArabic ? 'حساب نشط' : 'Active Member'}</span>
              </span>
            </div>

            {/* Followers & Following Interactive Counts */}
            <div className="flex items-center gap-4 text-xs font-bold pt-2">
              <button
                type="button"
                onClick={() => {
                  setFollowListType('followers');
                  setIsFollowListOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-500/20 transition-colors cursor-pointer shadow-sm"
              >
                <Users className="w-3.5 h-3.5 text-fuchsia-600 dark:text-fuchsia-400" />
                <span className="font-black">{profile.followersCount || 0}</span>
                <span className="font-semibold text-[11px] opacity-80">{isArabic ? 'متابع' : 'Followers'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFollowListType('following');
                  setIsFollowListOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 transition-colors cursor-pointer shadow-sm"
              >
                <UserCheck className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span className="font-black">{profile.followingCount || 0}</span>
                <span className="font-semibold text-[11px] opacity-80">{isArabic ? 'يتابع' : 'Following'}</span>
              </button>
            </div>
          </div>

          {/* Reputation XP Bar */}
          <div className="mt-6 p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="font-bold flex items-center gap-1.5 text-amber-500 dark:text-amber-400">
                <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                {isArabic ? 'نقاط السمعة والتفاعل' : 'Reputation Score'}
              </span>
              <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                {profile.repScore} / {repTier.max} XP
              </span>
            </div>
            <div className="w-full h-2.5 bg-zinc-200 dark:bg-zinc-950 rounded-full overflow-hidden border border-zinc-300 dark:border-zinc-800/80">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-fuchsia-500 to-cyan-400 rounded-full transition-all duration-700"
                style={{ width: `${repProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. TAB: PORTFOLIO & ACHIEVEMENTS */}
      {activeTab === 'portfolio' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass-card rounded-2xl p-5 border border-zinc-800 text-center space-y-1.5 shadow-md">
              <MessageSquare className="w-6 h-6 text-fuchsia-400 mx-auto" />
              <div className="text-xl font-black text-white">{profile.postsCount}</div>
              <div className="text-xs text-zinc-400 font-medium">{isArabic ? 'التدوينات والميمز' : 'Posts & Memes'}</div>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-zinc-800 text-center space-y-1.5 shadow-md">
              <Heart className="w-6 h-6 text-rose-400 mx-auto" />
              <div className="text-xl font-black text-white">{profile.totalReactionsReceived}</div>
              <div className="text-xs text-zinc-400 font-medium">{isArabic ? 'التفاعلات المستلمة' : 'Reactions'}</div>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-zinc-800 text-center space-y-1.5 shadow-md">
              <GitBranch className="w-6 h-6 text-purple-400 mx-auto" />
              <div className="text-xl font-black text-white">{profile.chainsCount}</div>
              <div className="text-xs text-zinc-400 font-medium">{isArabic ? 'سلاسل القصص' : 'Story Chains'}</div>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-zinc-800 text-center space-y-1.5 shadow-md">
              <Trophy className="w-6 h-6 text-amber-400 mx-auto" />
              <div className="text-xl font-black text-white">{profile.sparksWonCount}</div>
              <div className="text-xs text-zinc-400 font-medium">{isArabic ? 'تحديات السبارك' : 'Sparks Won'}</div>
            </div>
          </div>

          {/* Badges Showcase */}
          {profile.badges.length > 0 && (
            <div className="glass-card rounded-3xl p-6 sm:p-7 border border-zinc-800 space-y-4 shadow-lg">
              <div className="flex items-center gap-2.5">
                <Award className="w-5 h-5 text-fuchsia-400" />
                <h3 className="font-bold text-sm sm:text-base text-white">
                  {isArabic ? 'الأوسمة والجوائز المكتسبة' : 'Awarded Badges & Trophies'}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {profile.badges.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 bg-zinc-900/80 rounded-2xl border border-zinc-800 flex items-center gap-3.5"
                  >
                    <span className="text-2xl p-2.5 bg-zinc-950 rounded-xl border border-zinc-800 shrink-0">
                      {b.icon}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs sm:text-sm text-zinc-100 truncate">{b.name}</h4>
                      <p className="text-[11px] text-zinc-400 line-clamp-1">{b.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabbed Portfolio: Posts / Chains */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
              <button
                onClick={() => setPortfolioSubTab('posts')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  portfolioSubTab === 'posts'
                    ? 'bg-fuchsia-600 text-white shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {isArabic ? 'المشاركات' : 'Posts & Memes'} ({profile.recentPosts.length})
              </button>

              <button
                onClick={() => setPortfolioSubTab('chains')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  portfolioSubTab === 'chains'
                    ? 'bg-fuchsia-600 text-white shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {isArabic ? 'سلاسل القصص' : 'Story Chains'} ({profile.recentChains.length})
              </button>
            </div>

            {/* Posts Content */}
            {portfolioSubTab === 'posts' && (
              <div className="space-y-3">
                {profile.recentPosts.length === 0 ? (
                  <div className="p-8 text-center glass-card rounded-2xl text-xs text-zinc-500 space-y-2">
                    <p>{isArabic ? 'لا توجد مشاركات بعد.' : 'No posts created yet.'}</p>
                    {isOwnProfile && onOpenCanvas && (
                      <button
                        onClick={onOpenCanvas}
                        className="py-1.5 px-3 bg-fuchsia-600 text-white text-xs font-bold rounded-xl"
                      >
                        {isArabic ? 'أنشئ أول ميم الآن' : 'Create First Meme'}
                      </button>
                    )}
                  </div>
                ) : (
                  profile.recentPosts.map((post) => (
                    <div
                      key={post.id}
                      className="glass-card rounded-2xl p-4 border border-zinc-800 space-y-3 shadow-md"
                    >
                      <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                        {post.content}
                      </p>
                      {post.media?.url && (
                        <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950/80 flex items-center justify-center p-1">
                          <img
                            src={getMediaUrl(post.media.url)}
                            alt="Post media"
                            className="w-full h-auto max-h-[500px] object-contain rounded-lg"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs text-zinc-500 pt-1 border-t border-zinc-800/60">
                        <span>{new Date(post.createdAtUtc).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1 font-bold text-fuchsia-400">
                          <Flame className="w-3.5 h-3.5" />
                          {post.reactionCount}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Chains Content */}
            {portfolioSubTab === 'chains' && (
              <div className="space-y-3">
                {profile.recentChains.length === 0 ? (
                  <div className="p-8 text-center glass-card rounded-2xl text-xs text-zinc-500">
                    {isArabic ? 'لم يشارك في سلاسل مايك بعد.' : 'No chain contributions yet.'}
                  </div>
                ) : (
                  profile.recentChains.map((c) => (
                    <div
                      key={c.id}
                      className="glass-card rounded-2xl p-4 border border-zinc-800 space-y-2 shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-xs text-zinc-100">{c.title}</h4>
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-500/20 text-purple-300 rounded-full">
                          {c.currentStepCount}/{c.maxSteps} {isArabic ? 'أدوار' : 'steps'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 line-clamp-2">
                        {c.steps[c.steps.length - 1]?.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. TAB: EDIT PROFILE & PHOTO & PREFERENCES */}
      {activeTab === 'edit' && isOwnProfile && (
        <div className="glass-card rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 space-y-6 shadow-xl transition-colors duration-200">
          <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <Edit3 className="w-5 h-5 text-fuchsia-500 dark:text-fuchsia-400" />
            <div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                {isArabic ? 'تعديل البيانات الشخصية والتفضيلات' : 'Edit Profile Information & Preferences'}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {isArabic ? 'حدّث اسمك المعروض، النبذة، المظهر المفضل، لغة الواجهة والصورة الشخصية' : 'Update your display name, bio, theme mode, language, and avatar'}
              </p>
            </div>
          </div>

          {/* Hidden File Input for Avatar Upload */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoUpload}
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
          />

          {/* Avatar Preview & Customization Section */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900/90 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center gap-4 shadow-sm">
            <div className="relative">
              <img
                src={getMediaUrl(editAvatarUrl) || getMediaUrl(profile.avatarUrl) || currentPersona.avatarUrl}
                alt="Avatar preview"
                className="w-20 h-20 rounded-2xl bg-white dark:bg-zinc-950 border-2 border-fuchsia-500/50 object-cover shadow-lg"
              />
              {isUploadingPhoto && (
                <div className="absolute inset-0 bg-black/70 rounded-2xl flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-fuchsia-400 animate-spin" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2 text-center sm:text-left rtl:sm:text-right">
              <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                {isArabic ? 'الصورة الشخصية (Avatar)' : 'Profile Avatar'}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {isArabic
                  ? 'يمكنك رفع صورة من جهازك أو إنشاء شخصية عشوائية فورية'
                  : 'Upload an image from your device or randomize a creative avatar'}
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start rtl:sm:justify-end pt-1">
                <Tooltip content={isArabic ? 'رفع صورة من جهازك (حتى 5 ميغابايت)' : 'Upload image from device (max 5MB)'} position="top">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    <span>{isUploadingPhoto ? (isArabic ? 'جاري الرفع...' : 'Uploading...') : (isArabic ? 'رفع صورة' : 'Upload Image')}</span>
                  </button>
                </Tooltip>

                <Tooltip content={isArabic ? 'توليد شخصية عشوائية جديدة' : 'Generate random creative avatar'} position="top">
                  <button
                    type="button"
                    onClick={randomizeAvatar}
                    className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Shuffle className="w-3.5 h-3.5 text-fuchsia-600 dark:text-fuchsia-400" />
                    <span>{isArabic ? 'توليد شخصية' : 'Randomize Avatar'}</span>
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            {/* Preferences & Appearance Section */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 space-y-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  {isArabic ? 'تفضيلات المظهر واللغة (Theme & Language)' : 'Appearance & Language Preferences'}
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Theme Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                    {isArabic ? 'المظهر الافتراضي للواجهة' : 'Preferred Theme'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Tooltip content={isArabic ? 'الوضع الداكن المريح للعين' : 'Dark Mode (Night)'} position="top" className="w-full">
                      <button
                        type="button"
                        onClick={() => setEditPreferredTheme('dark')}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                          editPreferredTheme === 'dark'
                            ? 'bg-zinc-900 text-white border-fuchsia-500 shadow-md ring-1 ring-fuchsia-500/50'
                            : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <Moon className="w-3.5 h-3.5 text-fuchsia-400" />
                        <span>{isArabic ? 'داكن 🌙' : 'Dark 🌙'}</span>
                      </button>
                    </Tooltip>

                    <Tooltip content={isArabic ? 'الوضع الفاتح فائق الوضوح' : 'Light Mode (Day)'} position="top" className="w-full">
                      <button
                        type="button"
                        onClick={() => setEditPreferredTheme('light')}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                          editPreferredTheme === 'light'
                            ? 'bg-white text-zinc-900 border-amber-500 shadow-md ring-1 ring-amber-500/50 font-black'
                            : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                        <span>{isArabic ? 'فاتح ☀️' : 'Light ☀️'}</span>
                      </button>
                    </Tooltip>
                  </div>
                </div>

                {/* Language Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                    {isArabic ? 'لغة الواجهة والاتجاه' : 'Interface Language'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Tooltip content="English interface with LTR direction" position="top" className="w-full">
                      <button
                        type="button"
                        onClick={() => setEditPreferredLanguage('en')}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                          editPreferredLanguage === 'en'
                            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-cyan-400 shadow-md'
                            : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5 text-cyan-300" />
                        <span>English (EN)</span>
                      </button>
                    </Tooltip>

                    <Tooltip content="الواجهة باللغة العربية مع اتجاه من اليمين لليسار" position="top" className="w-full">
                      <button
                        type="button"
                        onClick={() => setEditPreferredLanguage('ar')}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                          editPreferredLanguage === 'ar'
                            ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white border-fuchsia-400 shadow-md'
                            : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5 text-fuchsia-300" />
                        <span>العربية (AR)</span>
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  {isArabic ? 'الاسم المعروض' : 'Display Name'}
                </label>
                <input
                  type="text"
                  required
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-fuchsia-500 shadow-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  {isArabic ? 'البريد الإلكتروني' : 'Email Address'}
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-fuchsia-500 shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {isArabic ? 'رابط الصورة الشخصية المخصص (اختياري)' : 'Custom Avatar Image URL (Optional)'}
              </label>
              <input
                type="url"
                value={editAvatarUrl}
                onChange={(e) => setEditAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-fuchsia-500 shadow-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {isArabic ? 'النبذة التعريفية' : 'Bio'}
              </label>
              <textarea
                rows={3}
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder={isArabic ? 'اكتب نبذة عن اهتماماتك وإبداعك...' : 'Tell the community about yourself...'}
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white resize-none focus:outline-none focus:border-fuchsia-500 shadow-sm"
              />
            </div>

            {profileMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  profileMessage.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300'
                }`}
              >
                {profileMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                )}
                <span>{profileMessage.text}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Tooltip content={isArabic ? 'حفظ البيانات وتطبيق التفضيلات وحفظها في الحساب' : 'Save details & persist preferences in profile'} position="top">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-6 py-2.5 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-fuchsia-600/25 active:scale-95"
                >
                  {isSavingProfile && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSavingProfile ? (isArabic ? 'جاري الحفظ...' : 'Saving Changes...') : (isArabic ? 'حفظ التعديلات' : 'Save Changes')}</span>
                </button>
              </Tooltip>
            </div>
          </form>
        </div>
      )}

      {/* 4. TAB: SECURITY & CHANGE PASSWORD */}
      {activeTab === 'security' && isOwnProfile && (
        <div className="glass-card rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 space-y-6 shadow-xl transition-colors duration-200">
          <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <Lock className="w-5 h-5 text-fuchsia-500 dark:text-fuchsia-400" />
            <div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                {isArabic ? 'الأمان وتغيير كلمة المرور' : 'Account Security & Password'}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {isArabic ? 'قم بتحديث كلمة المرور لحماية حسابك' : 'Update your password to keep your account safe'}
              </p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {isArabic ? 'كلمة المرور الحالية' : 'Current Password'}
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white pr-10 rtl:pr-3.5 rtl:pl-10 focus:outline-none focus:border-fuchsia-500 shadow-sm"
                />
                <Tooltip content={showCurrentPassword ? (isArabic ? 'إخفاء كلمة المرور' : 'Hide password') : (isArabic ? 'إظهار كلمة المرور' : 'Show password')} position="left">
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </Tooltip>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {isArabic ? 'كلمة المرور الجديدة' : 'New Password'}
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="•••••••• (Min. 6 chars)"
                  className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white pr-10 rtl:pr-3.5 rtl:pl-10 focus:outline-none focus:border-fuchsia-500 shadow-sm"
                />
                <Tooltip content={showNewPassword ? (isArabic ? 'إخفاء كلمة المرور' : 'Hide password') : (isArabic ? 'إظهار كلمة المرور' : 'Show password')} position="left">
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </Tooltip>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {isArabic ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-fuchsia-500 shadow-sm"
              />
            </div>

            {passwordMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  passwordMessage.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300'
                }`}
              >
                {passwordMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                )}
                <span>{passwordMessage.text}</span>
              </div>
            )}

            <div className="pt-2">
              <Tooltip content={isArabic ? 'تحديث وتعيين كلمة المرور الجديدة' : 'Update and apply new password'} position="top">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-6 py-2.5 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-fuchsia-600/25 active:scale-95"
                >
                  {isChangingPassword && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isChangingPassword ? (isArabic ? 'جاري التغيير...' : 'Updating Password...') : (isArabic ? 'تحديث كلمة المرور' : 'Update Password')}</span>
                </button>
              </Tooltip>
            </div>
          </form>

          {/* Session & Account Actions */}
          <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
            <div>
              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-200">
                {isArabic ? 'إدارة الجلسة والحساب' : 'Session & Account Actions'}
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {isArabic
                  ? 'تسجيل الخروج من الجلسة الحالية على هذا الجهاز'
                  : 'Log out of your current session on this device.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Tooltip content={isArabic ? 'تسجيل الخروج وإنهاء الجلسة' : 'Log out and end current session'} position="top">
                <button
                  type="button"
                  onClick={() => logout()}
                  className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-2 transition-all active:scale-95 shadow-sm"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{isArabic ? 'تسجيل الخروج من SparkLoop' : 'Log Out of SparkLoop'}</span>
                </button>
              </Tooltip>

              <Tooltip content={isArabic ? 'تبديل الحساب أو إنشاء مستخدم جديد' : 'Switch persona or create account'} position="top">
                <button
                  type="button"
                  onClick={() => setIsSwitcherOpen(true)}
                  className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white flex items-center gap-2 transition-all shadow-sm"
                >
                  <Users className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span>{isArabic ? 'تبديل أو إضافة حساب' : 'Switch or Add Persona'}</span>
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}

      {/* Account Switcher Modal */}
      <PersonaSwitcher
        isOpen={isSwitcherOpen}
        initialTab="switch"
        onClose={() => setIsSwitcherOpen(false)}
      />

      {/* Follow List Modal (Followers / Following) */}
      <FollowListModal
        isOpen={isFollowListOpen}
        onClose={() => setIsFollowListOpen(false)}
        username={targetUsername}
        type={followListType}
      />

      {/* Follow Requests Management Drawer */}
      <FollowRequestsDrawer
        isOpen={isRequestsDrawerOpen}
        onClose={() => setIsRequestsDrawerOpen(false)}
        onRequestHandled={() => {
          fetchPendingRequestsCount();
          // Reload profile to refresh follower count
          api.getUserProfile(targetUsername).then(setProfile).catch(console.error);
        }}
      />
    </div>
  );
};
