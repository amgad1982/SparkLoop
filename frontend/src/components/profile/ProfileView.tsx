import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { api, getMediaUrl } from '../../services/apiClient';
import { UserProfileDto, DeviceSessionDto, LinkedSocialAccountDto } from '../../types/api';
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
  Image as ImageIcon,
  Key,
  Laptop,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Moon,
  Palette,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Shuffle,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  Trophy,
  Upload,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';

export interface BannerPreset {
  id: string;
  name: string;
  nameAr: string;
  gradientClass: string;
  previewClass: string;
  accentClass: string;
}

export const BANNER_PRESETS: BannerPreset[] = [
  {
    id: 'gradient:cosmic-indigo',
    name: 'Cosmic Indigo',
    nameAr: 'كوني نيلي',
    gradientClass: 'bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950',
    previewClass: 'from-indigo-950 via-slate-900 to-purple-950',
    accentClass: 'text-indigo-400',
  },
  {
    id: 'gradient:cyber-neon',
    name: 'Cyber Neon',
    nameAr: 'سايبر نيون',
    gradientClass: 'bg-gradient-to-r from-[#0d1b2a] via-[#1b263b] to-[#415a77]',
    previewClass: 'from-[#0d1b2a] via-[#1b263b] to-[#415a77]',
    accentClass: 'text-cyan-400',
  },
  {
    id: 'gradient:sunset-rose',
    name: 'Sunset Rose',
    nameAr: 'غروب وردي',
    gradientClass: 'bg-gradient-to-r from-rose-950 via-orange-950 to-amber-950',
    previewClass: 'from-rose-950 via-orange-950 to-amber-950',
    accentClass: 'text-rose-400',
  },
  {
    id: 'gradient:nordic-aurora',
    name: 'Nordic Aurora',
    nameAr: 'شفق نورديك',
    gradientClass: 'bg-gradient-to-r from-slate-950 via-teal-950 to-emerald-950',
    previewClass: 'from-slate-950 via-teal-950 to-emerald-950',
    accentClass: 'text-emerald-400',
  },
  {
    id: 'gradient:amethyst-glow',
    name: 'Amethyst Glow',
    nameAr: 'توهج الجمشت',
    gradientClass: 'bg-gradient-to-r from-purple-950 via-fuchsia-950 to-slate-950',
    previewClass: 'from-purple-950 via-fuchsia-950 to-slate-950',
    accentClass: 'text-fuchsia-400',
  },
  {
    id: 'gradient:ocean-depths',
    name: 'Ocean Depths',
    nameAr: 'أعماق المحيط',
    gradientClass: 'bg-gradient-to-r from-blue-950 via-sky-950 to-slate-950',
    previewClass: 'from-blue-950 via-sky-950 to-slate-950',
    accentClass: 'text-sky-400',
  },
  {
    id: 'gradient:solar-flare',
    name: 'Solar Flare',
    nameAr: 'توهج شمسي',
    gradientClass: 'bg-gradient-to-r from-amber-950 via-orange-950 to-red-950',
    previewClass: 'from-amber-950 via-orange-950 to-red-950',
    accentClass: 'text-amber-400',
  },
  {
    id: 'gradient:minimal-slate',
    name: 'Minimal Slate',
    nameAr: 'رمادي أدنى',
    gradientClass: 'bg-gradient-to-r from-slate-900 via-zinc-900 to-slate-950',
    previewClass: 'from-slate-900 via-zinc-900 to-slate-950',
    accentClass: 'text-slate-400',
  },
];

interface ProfileViewProps {
  username?: string;
  onOpenCanvas?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ username, onOpenCanvas }) => {
  const { currentUser, currentPersona, setUser, logout, openAuthModal } = useAuthStore();
  const { locale, theme, setTheme, setLocale } = useThemeStore();
  const isArabic = locale === 'ar';

  const targetUsername = username || currentPersona.username;
  const isOwnProfile = targetUsername.toLowerCase() === currentPersona.username.toLowerCase();

  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'edit' | 'privacy' | 'security'>('portfolio');
  const [portfolioSubTab, setPortfolioSubTab] = useState<'posts' | 'chains' | 'badges'>('posts');

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
  const [editBannerUrl, setEditBannerUrl] = useState('');
  const [editPreferredTheme, setEditPreferredTheme] = useState<'dark' | 'light'>(theme);
  const [editPreferredLanguage, setEditPreferredLanguage] = useState<'en' | 'ar'>(locale);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isSavingBanner, setIsSavingBanner] = useState(false);
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bannerFileInputRef = useRef<HTMLInputElement | null>(null);

  // Privacy Settings Form State
  const [privacyIsPrivate, setPrivacyIsPrivate] = useState(false);
  const [privacyIsSearchDiscoverable, setPrivacyIsSearchDiscoverable] = useState(true);
  const [privacyShowBio, setPrivacyShowBio] = useState(true);
  const [privacyShowFollowersCount, setPrivacyShowFollowersCount] = useState(true);
  const [privacyShowBadges, setPrivacyShowBadges] = useState(true);
  const [privacyShowActivityStats, setPrivacyShowActivityStats] = useState(true);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Active Device Sessions State
  const [sessions, setSessions] = useState<DeviceSessionDto[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const [sessionActionMessage, setSessionActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Linked Social Accounts State
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedSocialAccountDto[]>([]);
  const [isLoadingLinked, setIsLoadingLinked] = useState(false);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const [socialActionMessage, setSocialActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSessions = async () => {
    if (!isOwnProfile) return;
    setIsLoadingSessions(true);
    try {
      const data = await api.getSessions();
      setSessions(data);
    } catch (err) {
      console.warn('Failed to load device sessions:', err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const fetchLinkedAccounts = async () => {
    if (!isOwnProfile) return;
    setIsLoadingLinked(true);
    try {
      const data = await api.getLinkedAccounts();
      setLinkedAccounts(data);
    } catch (err) {
      console.warn('Failed to load linked social accounts:', err);
    } finally {
      setIsLoadingLinked(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'security' && isOwnProfile) {
      fetchSessions();
      fetchLinkedAccounts();
    }
  }, [activeTab, isOwnProfile]);

  const handleLinkSocial = async (provider: 'google' | 'facebook' | 'twitter') => {
    setLinkingProvider(provider);
    setSocialActionMessage(null);
    try {
      const redirectUri = `${window.location.origin}/oauth-callback.html`;
      const { url } = await api.getOAuthUrl(provider, redirectUri, 'link');

      // Center popup window
      const width = 560;
      const height = 650;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        url,
        `sparkloop_link_${provider}`,
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        throw new Error(isArabic ? 'تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.' : 'Popup blocked. Please allow popups for SparkLoop.');
      }

      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (!event.data || event.data.type !== 'SPARKLOOP_OAUTH_RESPONSE') return;

        window.removeEventListener('message', handleMessage);

        const { code, state, error: oauthError } = event.data;

        if (oauthError) {
          setLinkingProvider(null);
          setSocialActionMessage({ type: 'error', text: oauthError });
          return;
        }

        if (!code || !state) {
          setLinkingProvider(null);
          setSocialActionMessage({
            type: 'error',
            text: isArabic ? 'لم يتم استلام رمز التوثيق من المزود' : 'No authorization code received from provider',
          });
          return;
        }

        try {
          const res = await api.linkOAuthCallback(provider, {
            code,
            state,
            redirectUri,
          });

          setLinkedAccounts((prev) => [res, ...prev.filter((p) => p.provider.toLowerCase() !== provider.toLowerCase())]);
          setSocialActionMessage({
            type: 'success',
            text: isArabic ? `تم ربط حساب ${provider.toUpperCase()} بنجاح!` : `Successfully linked ${provider.toUpperCase()} account!`,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          setSocialActionMessage({ type: 'error', text: msg });
        } finally {
          setLinkingProvider(null);
        }
      };

      window.addEventListener('message', handleMessage);

      // Polling fallback to detect if popup was closed
      const pollTimer = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollTimer);
          setTimeout(() => {
            setLinkingProvider((current) => (current === provider ? null : current));
          }, 500);
        }
      }, 500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSocialActionMessage({ type: 'error', text: msg });
      setLinkingProvider(null);
    }
  };

  const handleUnlinkSocial = async (provider: string) => {
    setUnlinkingProvider(provider);
    setSocialActionMessage(null);
    try {
      await api.unlinkSocialAccount(provider);
      setLinkedAccounts((prev) => prev.filter((p) => p.provider.toLowerCase() !== provider.toLowerCase()));
      setSocialActionMessage({
        type: 'success',
        text: isArabic ? `تم إلغاء ربط حساب ${provider.toUpperCase()}` : `Unlinked ${provider.toUpperCase()} account`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSocialActionMessage({ type: 'error', text: msg });
    } finally {
      setUnlinkingProvider(null);
    }
  };

  const handleTrustSession = async (sessionId: string, currentTrust: boolean) => {
    try {
      const updated = await api.trustSession(sessionId, !currentTrust);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
      setSessionActionMessage({
        type: 'success',
        text: !currentTrust
          ? (isArabic ? 'تم تمييز هذا الجهاز كجهاز موثوق 🛡️' : 'Device marked as trusted 🛡️')
          : (isArabic ? 'تمت إزالة حالة الوثوق عن هذا الجهاز' : 'Device untrusted'),
      });
    } catch {
      setSessionActionMessage({
        type: 'error',
        text: isArabic ? 'فشل تعديل حالة الوثوق للجهاز' : 'Failed to update device trust status',
      });
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId);
    setSessionActionMessage(null);
    try {
      await api.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setSessionActionMessage({
        type: 'success',
        text: isArabic ? 'تم إنهاء الجلسة وتسجيل الخروج من ذلك الجهاز بنجاح' : 'Session revoked successfully',
      });
    } catch {
      setSessionActionMessage({
        type: 'error',
        text: isArabic ? 'فشل إنهاء الجلسة' : 'Failed to revoke session',
      });
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleRevokeAllOtherSessions = async () => {
    setIsRevokingAll(true);
    setSessionActionMessage(null);
    try {
      const currentToken = useAuthStore.getState().refreshToken || undefined;
      await api.revokeAllSessions(true, currentToken);
      await fetchSessions();
      setSessionActionMessage({
        type: 'success',
        text: isArabic ? 'تم إنهاء كافة الجلسات الأخرى بنجاح 🔒' : 'All other sessions revoked successfully 🔒',
      });
    } catch {
      setSessionActionMessage({
        type: 'error',
        text: isArabic ? 'فشل إنهاء الجلسات الأخرى' : 'Failed to revoke other sessions',
      });
    } finally {
      setIsRevokingAll(false);
    }
  };

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
        setEditBannerUrl(data.bannerUrl || '');
        setEditPreferredTheme(data.preferredTheme || theme);
        setEditPreferredLanguage(data.preferredLanguage || locale);

        // Sync privacy settings
        setPrivacyIsPrivate(data.isPrivate ?? false);
        setPrivacyIsSearchDiscoverable(data.isSearchDiscoverable ?? true);
        setPrivacyShowBio(data.showBio ?? true);
        setPrivacyShowFollowersCount(data.showFollowersCount ?? true);
        setPrivacyShowBadges(data.showBadges ?? true);
        setPrivacyShowActivityStats(data.showActivityStats ?? true);
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

  // Handle Banner File Upload
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setProfileMessage({
        type: 'error',
        text: isArabic ? 'حجم صورة الغلاف يجب ألا يتجاوز 8 ميغابايت.' : 'Banner image size must not exceed 8MB.',
      });
      return;
    }

    setIsUploadingBanner(true);
    setProfileMessage(null);

    try {
      const media = await api.uploadMedia(file);
      setEditBannerUrl(media.url);
      setProfileMessage({
        type: 'success',
        text: isArabic ? 'تم رفع صورة الغلاف بنجاح! احفظ التعديلات لتطبيقها.' : 'Cover photo uploaded! Save changes to apply.',
      });
    } catch (err: unknown) {
      console.error('Upload banner error:', err);
      setProfileMessage({
        type: 'error',
        text: isArabic ? 'فشل رفع صورة الغلاف. يرجى المحاولة مرة أخرى.' : 'Failed to upload cover banner.',
      });
    } finally {
      setIsUploadingBanner(false);
      if (bannerFileInputRef.current) bannerFileInputRef.current.value = '';
    }
  };

  // Quick Save Banner (from quick modal)
  const handleQuickSaveBanner = async (newBannerUrl?: string) => {
    const urlToSave = newBannerUrl !== undefined ? newBannerUrl : editBannerUrl;
    setIsSavingBanner(true);
    try {
      const updated = await api.updateProfile({
        displayName: editDisplayName.trim() || profile?.displayName,
        bio: editBio.trim() || profile?.bio,
        avatarUrl: editAvatarUrl.trim() || profile?.avatarUrl,
        bannerUrl: urlToSave,
        email: editEmail.trim() || profile?.email,
        preferredTheme: editPreferredTheme,
        preferredLanguage: editPreferredLanguage,
      });
      setEditBannerUrl(updated.bannerUrl || urlToSave);
      setProfile((prev) =>
        prev ? { ...prev, bannerUrl: updated.bannerUrl !== undefined ? updated.bannerUrl : urlToSave } : null
      );
      setIsBannerModalOpen(false);
    } catch (err) {
      console.error('Failed to quick save banner:', err);
    } finally {
      setIsSavingBanner(false);
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
        bannerUrl: editBannerUrl.trim(),
        email: editEmail.trim(),
        preferredTheme: editPreferredTheme,
        preferredLanguage: editPreferredLanguage,
      });

      // Apply theme and locale immediately
      setTheme(editPreferredTheme, false);
      setLocale(editPreferredLanguage, false);

      setUser(updated);

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              displayName: updated.displayName,
              bio: updated.bio || '',
              avatarUrl: updated.avatarUrl || editAvatarUrl,
              bannerUrl: updated.bannerUrl !== undefined ? updated.bannerUrl : editBannerUrl,
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

  // Handle Save Privacy Settings
  const handleSavePrivacySettings = async () => {
    setIsSavingPrivacy(true);
    setPrivacyMessage(null);
    try {
      const updatedUser = await api.updatePrivacySettings({
        isPrivateProfile: privacyIsPrivate,
        isSearchDiscoverable: privacyIsSearchDiscoverable,
        showBio: privacyShowBio,
        showFollowersCount: privacyShowFollowersCount,
        showBadges: privacyShowBadges,
        showActivityStats: privacyShowActivityStats,
      });

      if (currentUser) {
        setUser({
          ...currentUser,
          isPrivateProfile: updatedUser.isPrivateProfile,
          isSearchDiscoverable: updatedUser.isSearchDiscoverable,
          showBio: updatedUser.showBio,
          showFollowersCount: updatedUser.showFollowersCount,
          showBadges: updatedUser.showBadges,
          showActivityStats: updatedUser.showActivityStats,
        });
      }

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              isPrivate: updatedUser.isPrivateProfile,
              isSearchDiscoverable: updatedUser.isSearchDiscoverable,
              showBio: updatedUser.showBio,
              showFollowersCount: updatedUser.showFollowersCount,
              showBadges: updatedUser.showBadges,
              showActivityStats: updatedUser.showActivityStats,
            }
          : null
      );

      setPrivacyMessage({
        type: 'success',
        text: isArabic ? 'تم حفظ إعدادات الخصوصية والظهور بنجاح!' : 'Privacy & discoverability settings saved successfully!',
      });
    } catch (err: unknown) {
      console.error('Save privacy settings error:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to save privacy settings.';
      setPrivacyMessage({
        type: 'error',
        text: isArabic ? `خطأ: ${errMsg}` : `Error: ${errMsg}`,
      });
    } finally {
      setIsSavingPrivacy(false);
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

  const renderBannerContent = (bannerUrl?: string) => {
    if (!bannerUrl) {
      return (
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-[#0b0f17] dark:via-[#131b28] dark:to-[#0b0f17]">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:16px_16px]" />
        </div>
      );
    }

    if (bannerUrl.startsWith('gradient:')) {
      const preset = BANNER_PRESETS.find((p) => p.id === bannerUrl) || BANNER_PRESETS[0];
      return (
        <div className={`absolute inset-0 ${preset.gradientClass}`}>
          <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:18px_18px]" />
        </div>
      );
    }

    return (
      <div className="absolute inset-0 bg-slate-950">
        <img
          src={getMediaUrl(bannerUrl)}
          alt="Profile banner"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-black/20 to-black/30" />
      </div>
    );
  };

  return (
    <div className="space-y-6 text-zinc-900 dark:text-white pb-10 transition-colors duration-200">
      {/* 1. Header Banner & Profile Info Card */}
      <div className="glass-card rounded-3xl border border-slate-200 dark:border-slate-800/80 overflow-hidden shadow-sm relative">
        {/* Banner Graphic Area */}
        <div className="h-36 sm:h-48 w-full bg-slate-900 dark:bg-[#0b0f17] border-b border-slate-200 dark:border-slate-800 relative overflow-hidden group">
          {renderBannerContent(profile.bannerUrl)}

          {/* Quick Customize Banner Button for Profile Owner */}
          {isOwnProfile && (
            <div className="absolute top-4 left-4 rtl:left-auto rtl:right-4 z-10">
              <Tooltip content={isArabic ? 'تخصيص وتغيير غلاف الملف الشخصي' : 'Customize profile cover banner'} position="bottom">
                <button
                  type="button"
                  onClick={() => setIsBannerModalOpen(true)}
                  className="h-8 px-3 rounded-xl bg-slate-900/65 hover:bg-slate-900/85 active:bg-slate-900 text-white backdrop-blur-md border border-white/20 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <Palette className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">{isArabic ? 'تخصيص الغلاف' : 'Edit Cover'}</span>
                </button>
              </Tooltip>
            </div>
          )}

          {/* Reputation Tier Badge */}
          <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4 z-10">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-md shadow-sm ${repTier.color}`}>
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
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-slate-100 dark:bg-slate-900 border-4 border-white dark:border-[#131b28] object-cover shadow-sm transition-colors"
              />
              <div className="absolute bottom-1 right-1 rtl:right-auto rtl:left-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white dark:border-[#131b28]" />

              {isOwnProfile && (
                <Tooltip content={isArabic ? 'تغيير الصورة الشخصية' : 'Change Profile Avatar'} position="top">
                  <button
                    onClick={() => {
                      setActiveTab('edit');
                      fileInputRef.current?.click();
                    }}
                    className="absolute inset-0 bg-black/60 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1 border-4 border-transparent"
                  >
                    <Camera className="w-5 h-5 text-indigo-400" />
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
                    className={`h-9 px-3.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border ${
                      activeTab === 'portfolio'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'الأعمال والأوسمة' : 'Portfolio'}</span>
                  </button>
                </Tooltip>

                <Tooltip content={isArabic ? 'عرض وإدارة طلبات المتابعة المعلقة' : 'View pending follow requests'} position="top">
                  <button
                    onClick={() => setIsRequestsDrawerOpen(true)}
                    className="relative h-9 px-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Bell className="w-3.5 h-3.5 text-amber-500" />
                    <span className="hidden sm:inline">{isArabic ? 'طلبات المتابعة' : 'Requests'}</span>
                    {pendingRequestsCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-bold">
                        {pendingRequestsCount}
                      </span>
                    )}
                  </button>
                </Tooltip>

                <Tooltip content={isArabic ? 'تعديل البيانات والمظهر واللغة' : 'Edit profile info, theme & language'} position="top">
                  <button
                    onClick={() => setActiveTab('edit')}
                    className={`h-9 px-3.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border ${
                      activeTab === 'edit'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'تعديل البيانات' : 'Edit Profile'}</span>
                  </button>
                </Tooltip>

                <Tooltip content={isArabic ? 'الخصوصية والظهور في البحث ومشاركة الحساب' : 'Privacy, discoverability & visibility'} position="top">
                  <button
                    onClick={() => setActiveTab('privacy')}
                    className={`h-9 px-3.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border ${
                      activeTab === 'privacy'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{isArabic ? 'الخصوصية والظهور' : 'Privacy'}</span>
                  </button>
                </Tooltip>

                <Tooltip content={isArabic ? 'تغيير كلمة المرور وإعدادات الأمان' : 'Change password & security'} position="top">
                  <button
                    onClick={() => setActiveTab('security')}
                    className={`h-9 px-3.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border ${
                      activeTab === 'security'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'الأمان وكلمة المرور' : 'Security'}</span>
                  </button>
                </Tooltip>

                <Tooltip content={isArabic ? 'تسجيل الدخول بحساب آخر' : 'Sign in with another account'} position="top">
                  <button
                    onClick={() => openAuthModal('login')}
                    className="h-9 px-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <User className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                    <span className="hidden sm:inline">{isArabic ? 'تبديل الحساب' : 'Switch'}</span>
                  </button>
                </Tooltip>

                {currentPersona.username !== 'guest' && (
                  <Tooltip content={isArabic ? 'تسجيل الخروج من الحساب' : 'Log out of current persona'} position="top">
                    <button
                      onClick={() => logout()}
                      className="h-9 px-3.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 transition-colors shadow-sm"
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
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                {profile.displayName}
              </h2>
              <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-semibold">@{profile.username}</span>
              {profile.isPrivate && (
                <span
                  title={isArabic ? 'حساب خاص - للمتابعين فقط' : 'Private Profile - Followers Only'}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold shrink-0 shadow-sm"
                >
                  <Lock className="w-3 h-3" />
                  <span>{isArabic ? 'حساب خاص' : 'Private Profile'}</span>
                </span>
              )}
            </div>

            {(isOwnProfile || profile.showBio !== false) && profile.bio && (
              <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 max-w-2xl leading-relaxed">
                {profile.bio}
              </p>
            )}

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
            {(isOwnProfile || profile.showFollowersCount !== false) && (
              <div className="flex items-center gap-4 text-xs font-bold pt-2">
                <button
                  type="button"
                  disabled={!isOwnProfile && profile.isPrivate && !profile.canViewFullProfile}
                  onClick={() => {
                    if (!isOwnProfile && profile.isPrivate && !profile.canViewFullProfile) return;
                    setFollowListType('followers');
                    setIsFollowListOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-500/20 transition-colors cursor-pointer shadow-sm disabled:cursor-default"
                >
                  <Users className="w-3.5 h-3.5 text-fuchsia-600 dark:text-fuchsia-400" />
                  <span className="font-black">{profile.followersCount || 0}</span>
                  <span className="font-semibold text-[11px] opacity-80">{isArabic ? 'متابع' : 'Followers'}</span>
                </button>

                <button
                  type="button"
                  disabled={!isOwnProfile && profile.isPrivate && !profile.canViewFullProfile}
                  onClick={() => {
                    if (!isOwnProfile && profile.isPrivate && !profile.canViewFullProfile) return;
                    setFollowListType('following');
                    setIsFollowListOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 transition-colors cursor-pointer shadow-sm disabled:cursor-default"
                >
                  <UserCheck className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span className="font-black">{profile.followingCount || 0}</span>
                  <span className="font-semibold text-[11px] opacity-80">{isArabic ? 'يتابع' : 'Following'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Reputation XP Bar */}
          {(isOwnProfile || profile.showActivityStats !== false) && (
            <div className="mt-6 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="font-bold flex items-center gap-1.5 text-amber-500 dark:text-amber-400">
                  <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  {isArabic ? 'نقاط السمعة والتفاعل' : 'Reputation Score'}
                </span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {profile.repScore} / {repTier.max} XP
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-300 dark:border-slate-800/80">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-fuchsia-500 to-cyan-400 rounded-full transition-all duration-700"
                  style={{ width: `${repProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* LOCKED PRIVATE PROFILE VIEW */}
      {!isOwnProfile && profile.isPrivate && !profile.canViewFullProfile && (
        <div className="glass-card rounded-3xl p-8 sm:p-14 border border-slate-200 dark:border-slate-800 text-center space-y-6 shadow-sm max-w-lg mx-auto my-8">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-500 shadow-inner">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              {isArabic ? 'هذا الحساب خاص ومحمي' : 'This Account is Private'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
              {isArabic
                ? `تابع @${profile.username} للاطلاع على منشوراته وسلاسل المايك والشارات الخاصة به.`
                : `Follow @${profile.username} to view their posts, story chains, and badges.`}
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <FollowButton
              targetUserId={profile.id}
              targetUsername={profile.username}
              initialStatus={profile.followStatus as any}
              size="lg"
              onStatusChange={(newStatus) => {
                setProfile((prev) =>
                  prev
                    ? {
                        ...prev,
                        followStatus: newStatus,
                        followersCount:
                          newStatus === 'following' || newStatus === 'mutual'
                            ? (prev.followersCount || 0) + 1
                            : newStatus === 'none'
                            ? Math.max(0, (prev.followersCount || 0) - 1)
                            : prev.followersCount,
                      }
                    : null
                );
              }}
            />
          </div>
        </div>
      )}

      {/* 2. TAB: PORTFOLIO & ACHIEVEMENTS */}
      {activeTab === 'portfolio' && (isOwnProfile || !profile.isPrivate || profile.canViewFullProfile) && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 text-center space-y-1.5 shadow-sm">
              <MessageSquare className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mx-auto" />
              <div className="text-xl font-black text-slate-900 dark:text-white">{profile.postsCount}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">{isArabic ? 'التدوينات والميمز' : 'Posts & Memes'}</div>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 text-center space-y-1.5 shadow-sm">
              <Heart className="w-6 h-6 text-rose-500 mx-auto" />
              <div className="text-xl font-black text-slate-900 dark:text-white">{profile.totalReactionsReceived}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">{isArabic ? 'التفاعلات المستلمة' : 'Reactions'}</div>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 text-center space-y-1.5 shadow-sm">
              <GitBranch className="w-6 h-6 text-purple-600 dark:text-purple-400 mx-auto" />
              <div className="text-xl font-black text-slate-900 dark:text-white">{profile.chainsCount}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">{isArabic ? 'سلاسل القصص' : 'Story Chains'}</div>
            </div>
          </div>

          {/* Badges Showcase */}
          {profile.badges.length > 0 && (
            <div className="glass-card rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
              <div className="flex items-center gap-2.5">
                <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  {isArabic ? 'الأوسمة والجوائز المكتسبة' : 'Awarded Badges & Trophies'}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {profile.badges.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 bg-slate-50 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3.5"
                  >
                    <span className="text-2xl p-2.5 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0 shadow-sm">
                      {b.icon}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">{b.name}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{b.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabbed Portfolio: Posts / Chains */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <button
                onClick={() => setPortfolioSubTab('posts')}
                className={`h-8 px-3.5 rounded-xl text-xs font-semibold transition-colors border ${
                  portfolioSubTab === 'posts'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {isArabic ? 'المشاركات' : 'Posts & Memes'} ({profile.recentPosts.length})
              </button>

              <button
                onClick={() => setPortfolioSubTab('chains')}
                className={`h-8 px-3.5 rounded-xl text-xs font-semibold transition-colors border ${
                  portfolioSubTab === 'chains'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {isArabic ? 'سلاسل القصص' : 'Story Chains'} ({profile.recentChains.length})
              </button>
            </div>

            {/* Posts Content */}
            {portfolioSubTab === 'posts' && (
              <div className="space-y-3">
                {profile.recentPosts.length === 0 ? (
                  <div className="p-8 text-center glass-card rounded-2xl text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 space-y-2">
                    <p>{isArabic ? 'لا توجد مشاركات بعد.' : 'No posts created yet.'}</p>
                    {isOwnProfile && onOpenCanvas && (
                      <button
                        onClick={onOpenCanvas}
                        className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
                      >
                        {isArabic ? 'أنشئ أول ميم الآن' : 'Create First Meme'}
                      </button>
                    )}
                  </div>
                ) : (
                  profile.recentPosts.map((post) => (
                    <div
                      key={post.id}
                      className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm"
                    >
                      <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap">
                        {post.content}
                      </p>
                      {post.media?.url && (
                        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/80 flex items-center justify-center p-1">
                          <img
                            src={getMediaUrl(post.media.url)}
                            alt="Post media"
                            className="w-full h-auto max-h-[500px] object-contain rounded-lg"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800/60">
                        <span>{new Date(post.createdAtUtc).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
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
                  <div className="p-8 text-center glass-card rounded-2xl text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                    {isArabic ? 'لم يشارك في سلاسل مايك بعد.' : 'No chain contributions yet.'}
                  </div>
                ) : (
                  profile.recentChains.map((c) => (
                    <div
                      key={c.id}
                      className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{c.title}</h4>
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 rounded-full">
                          {c.currentStepCount}/{c.maxSteps} {isArabic ? 'أدوار' : 'steps'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
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
        <div className="glass-card rounded-3xl p-6 border border-slate-200 dark:border-slate-800 space-y-6 shadow-xl transition-colors duration-200">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <Edit3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {isArabic ? 'تعديل البيانات الشخصية والتفضيلات' : 'Edit Profile Information & Preferences'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
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
          <div className="p-4 bg-slate-50 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-4 shadow-sm">
            <div className="relative">
              <img
                src={getMediaUrl(editAvatarUrl) || getMediaUrl(profile.avatarUrl) || currentPersona.avatarUrl}
                alt="Avatar preview"
                className="w-20 h-20 rounded-2xl bg-white dark:bg-slate-950 border-2 border-indigo-500/50 object-cover shadow-md"
              />
              {isUploadingPhoto && (
                <div className="absolute inset-0 bg-black/70 rounded-2xl flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2 text-center sm:text-left rtl:sm:text-right">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {isArabic ? 'الصورة الشخصية (Avatar)' : 'Profile Avatar'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
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
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    <span>{isUploadingPhoto ? (isArabic ? 'جاري الرفع...' : 'Uploading...') : (isArabic ? 'رفع صورة' : 'Upload Image')}</span>
                  </button>
                </Tooltip>

                <Tooltip content={isArabic ? 'توليد شخصية عشوائية جديدة' : 'Generate random creative avatar'} position="top">
                  <button
                    type="button"
                    onClick={randomizeAvatar}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Shuffle className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>{isArabic ? 'توليد شخصية' : 'Randomize Avatar'}</span>
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Hidden File Input for Banner Upload */}
          <input
            type="file"
            ref={bannerFileInputRef}
            onChange={handleBannerUpload}
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
          />

          {/* Banner & Cover Customization Section */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{isArabic ? 'غلاف الملف الشخصي (Profile Banner)' : 'Profile Cover Banner'}</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {isArabic
                    ? 'اختر من المظاهر اللونية المنسقة أو ارفع صورة غلاف مخصصة'
                    : 'Select a theme gradient preset or upload a custom cover photo'}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Tooltip content={isArabic ? 'رفع صورة غلاف من جهازك (حتى 8 ميغابايت)' : 'Upload cover banner from device (max 8MB)'} position="top">
                  <button
                    type="button"
                    onClick={() => bannerFileInputRef.current?.click()}
                    disabled={isUploadingBanner}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    <span>{isUploadingBanner ? (isArabic ? 'جاري الرفع...' : 'Uploading...') : (isArabic ? 'رفع غلاف' : 'Upload Cover')}</span>
                  </button>
                </Tooltip>

                {editBannerUrl && (
                  <Tooltip content={isArabic ? 'إعادة ضبط الغلاف للوضع الافتراضي' : 'Reset banner to default'} position="top">
                    <button
                      type="button"
                      onClick={() => setEditBannerUrl('')}
                      className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isArabic ? 'إزالة' : 'Reset'}</span>
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>

            {/* Banner Live Preview Box */}
            <div className="h-24 sm:h-28 w-full rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative shadow-inner">
              {renderBannerContent(editBannerUrl)}
              <div className="absolute bottom-2 right-3 rtl:right-auto rtl:left-3 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-black/60 text-white backdrop-blur-md">
                {isArabic ? 'معاينة مباشرة' : 'Preview'}
              </div>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {BANNER_PRESETS.map((preset) => {
                const isSelected = editBannerUrl === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setEditBannerUrl(preset.id)}
                    className={`p-2 rounded-xl border text-left rtl:text-right transition-all flex items-center gap-2 ${
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-500/50 bg-indigo-50/50 dark:bg-indigo-950/30 font-bold'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-950/60'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-lg bg-gradient-to-r ${preset.previewClass} border border-white/20 shrink-0`} />
                    <span className="text-[11px] text-slate-800 dark:text-slate-200 truncate">
                      {isArabic ? preset.nameAr : preset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            {/* Preferences & Appearance Section */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800/80 space-y-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {isArabic ? 'تفضيلات المظهر واللغة (Theme & Language)' : 'Appearance & Language Preferences'}
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Theme Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    {isArabic ? 'المظهر الافتراضي للواجهة' : 'Preferred Theme'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Tooltip content={isArabic ? 'الوضع الداكن المريح للعين' : 'Dark Mode (Night)'} position="top" className="w-full">
                      <button
                        type="button"
                        onClick={() => setEditPreferredTheme('dark')}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-colors ${
                          editPreferredTheme === 'dark'
                            ? 'bg-[#131b28] text-white border-indigo-500 shadow-sm ring-1 ring-indigo-500/50'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Moon className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{isArabic ? 'داكن 🌙' : 'Dark 🌙'}</span>
                      </button>
                    </Tooltip>

                    <Tooltip content={isArabic ? 'الوضع الفاتح فائق الوضوح' : 'Light Mode (Day)'} position="top" className="w-full">
                      <button
                        type="button"
                        onClick={() => setEditPreferredTheme('light')}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-colors ${
                          editPreferredTheme === 'light'
                            ? 'bg-white text-slate-900 border-amber-500 shadow-sm ring-1 ring-amber-500/50 font-bold'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
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
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    {isArabic ? 'لغة الواجهة والاتجاه' : 'Interface Language'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Tooltip content="English interface with LTR direction" position="top" className="w-full">
                      <button
                        type="button"
                        onClick={() => setEditPreferredLanguage('en')}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-colors ${
                          editPreferredLanguage === 'en'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5 text-white" />
                        <span>English (EN)</span>
                      </button>
                    </Tooltip>

                    <Tooltip content="الواجهة باللغة العربية مع اتجاه من اليمين لليسار" position="top" className="w-full">
                      <button
                        type="button"
                        onClick={() => setEditPreferredLanguage('ar')}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-colors ${
                          editPreferredLanguage === 'ar'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5 text-white" />
                        <span>العربية (AR)</span>
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isArabic ? 'الاسم المعروض' : 'Display Name'}
                </label>
                <input
                  type="text"
                  required
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full bg-white dark:bg-[#0b0f17] border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 shadow-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isArabic ? 'البريد الإلكتروني' : 'Email Address'}
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-white dark:bg-[#0b0f17] border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isArabic ? 'رابط الصورة الشخصية المخصص (اختياري)' : 'Custom Avatar Image URL (Optional)'}
              </label>
              <input
                type="url"
                value={editAvatarUrl}
                onChange={(e) => setEditAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-white dark:bg-[#0b0f17] border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 shadow-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isArabic ? 'النبذة التعريفية' : 'Bio'}
              </label>
              <textarea
                rows={3}
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder={isArabic ? 'اكتب نبذة عن اهتماماتك وإبداعك...' : 'Tell the community about yourself...'}
                className="w-full bg-white dark:bg-[#0b0f17] border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white resize-none focus:outline-none focus:border-indigo-500 shadow-sm"
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
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                >
                  {isSavingProfile && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSavingProfile ? (isArabic ? 'جاري الحفظ...' : 'Saving Changes...') : (isArabic ? 'حفظ التعديلات' : 'Save Changes')}</span>
                </button>
              </Tooltip>
            </div>
          </form>
        </div>
      )}

      {/* 3. TAB: PRIVACY & DISCOVERABILITY SETTINGS */}
      {activeTab === 'privacy' && isOwnProfile && (
        <div className="glass-card rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 space-y-8 shadow-sm transition-colors duration-200">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {isArabic ? 'الخصوصية والظهور في البحث' : 'Privacy & Search Discoverability'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isArabic
                    ? 'تحكم في إمكانية العثور على حسابك ومَن يمكنه رؤية منشوراتك وبياناتك الشخصية'
                    : 'Control who can find your profile in search, and who can view your posts and details'}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isSavingPrivacy}
              onClick={handleSavePrivacySettings}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 self-start sm:self-auto"
            >
              {isSavingPrivacy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{isSavingPrivacy ? (isArabic ? 'جاري الحفظ...' : 'Saving...') : (isArabic ? 'حفظ إعدادات الخصوصية' : 'Save Privacy Settings')}</span>
            </button>
          </div>

          {/* Feedback message */}
          {privacyMessage && (
            <div
              className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2.5 ${
                privacyMessage.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
              }`}
            >
              {privacyMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />}
              <span>{privacyMessage.text}</span>
            </div>
          )}

          {/* Core Privacy Toggles */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-500" />
              <span>{isArabic ? 'خيارات الخصوصية الرئيسية' : 'Core Account Privacy'}</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Toggle 1: Search Discoverability */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-indigo-500" />
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {isArabic ? 'الظهور في نتائج البحث' : 'Allow Search Discovery'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {isArabic
                      ? 'عند تفعيل هذا الخيار، سيتمكن المستخدمون من العثور على حسابك عبر شريط البحث في التطبيق.'
                      : 'When enabled, other users can find your profile using the search bar in the application.'}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={privacyIsSearchDiscoverable}
                  onClick={() => setPrivacyIsSearchDiscoverable(!privacyIsSearchDiscoverable)}
                  className={`w-12 h-6.5 rounded-full p-1 transition-colors relative shrink-0 ${
                    privacyIsSearchDiscoverable ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${
                      privacyIsSearchDiscoverable ? 'translate-x-5.5 rtl:-translate-x-5.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Toggle 2: Private Account (Followers Only) */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {isArabic ? 'حساب خاص (للمتابعين فقط)' : 'Private Account (Followers Only)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {isArabic
                      ? 'لن يتمكن سوى المتابعين المقبولين من مشاهدة منشوراتك وسلاسل المايك ومحفظتك. سيتطلب أي متابع جديد إرسال طلب متابعة لموافقتك.'
                      : 'Only approved followers can view your posts and creations. New followers must send a follow request for your approval.'}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={privacyIsPrivate}
                  onClick={() => setPrivacyIsPrivate(!privacyIsPrivate)}
                  className={`w-12 h-6.5 rounded-full p-1 transition-colors relative shrink-0 ${
                    privacyIsPrivate ? 'bg-amber-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${
                      privacyIsPrivate ? 'translate-x-5.5 rtl:-translate-x-5.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Granular Field Visibility Controls */}
          <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-cyan-500" />
              <span>{isArabic ? 'التحكم في ظهور عناصر الملف الشخصي للعامة' : 'Profile Field Visibility to Non-Followers'}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Field 1: Bio */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{isArabic ? 'إظهار النبذة التعريفية (Bio)' : 'Show Bio'}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {privacyShowBio ? (isArabic ? 'مرئية للجميع' : 'Visible to public') : (isArabic ? 'مخفية عن غير المتابعين' : 'Hidden from non-followers')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPrivacyShowBio(!privacyShowBio)}
                  className={`w-10 h-5.5 rounded-full p-0.5 transition-colors relative shrink-0 ${
                    privacyShowBio ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${privacyShowBio ? 'translate-x-4.5 rtl:-translate-x-4.5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Field 2: Followers/Following Count */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{isArabic ? 'إظهار عدد المتابعين والمتابَعين' : 'Show Followers & Following Count'}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {privacyShowFollowersCount ? (isArabic ? 'مرئي للجميع' : 'Visible to public') : (isArabic ? 'مخفي عن غير المتابعين' : 'Hidden from non-followers')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPrivacyShowFollowersCount(!privacyShowFollowersCount)}
                  className={`w-10 h-5.5 rounded-full p-0.5 transition-colors relative shrink-0 ${
                    privacyShowFollowersCount ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${privacyShowFollowersCount ? 'translate-x-4.5 rtl:-translate-x-4.5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Field 3: Badges */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-slate-400" />
                    <span>{isArabic ? 'إظهار الأوسمة والشارات المكتسبة' : 'Show Badges & Trophies'}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {privacyShowBadges ? (isArabic ? 'مرئية للجميع' : 'Visible to public') : (isArabic ? 'مخفية عن غير المتابعين' : 'Hidden from non-followers')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPrivacyShowBadges(!privacyShowBadges)}
                  className={`w-10 h-5.5 rounded-full p-0.5 transition-colors relative shrink-0 ${
                    privacyShowBadges ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${privacyShowBadges ? 'translate-x-4.5 rtl:-translate-x-4.5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Field 4: Activity stats */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-slate-400" />
                    <span>{isArabic ? 'إظهار نقاط السمعة وإحصائيات النشاط' : 'Show Rep Score & Activity Stats'}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {privacyShowActivityStats ? (isArabic ? 'مرئية للجميع' : 'Visible to public') : (isArabic ? 'مخفية عن غير المتابعين' : 'Hidden from non-followers')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPrivacyShowActivityStats(!privacyShowActivityStats)}
                  className={`w-10 h-5.5 rounded-full p-0.5 transition-colors relative shrink-0 ${
                    privacyShowActivityStats ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${privacyShowActivityStats ? 'translate-x-4.5 rtl:-translate-x-4.5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB: SECURITY & ACCOUNT SETTINGS */}
      {activeTab === 'security' && isOwnProfile && (
        <div className="glass-card rounded-3xl p-6 border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm transition-colors duration-200">
          
          {/* Section 1: Email Confirmation Status */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border ${
                profile?.isEmailConfirmed
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
              }`}>
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                    {isArabic ? 'البريد الإلكتروني الموثق' : 'Email Address'}
                  </h4>
                  {profile?.isEmailConfirmed ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      {isArabic ? 'مؤكد وموثق' : 'Verified'}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {isArabic ? 'غير مؤكد' : 'Unverified'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  {profile?.email || `${currentPersona.username}@sparkloop.app`}
                </p>
              </div>
            </div>

            {!profile?.isEmailConfirmed && (
              <button
                type="button"
                onClick={() => openAuthModal('verify', profile?.email)}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isArabic ? 'تأكيد البريد الآن' : 'Verify Email Now'}</span>
              </button>
            )}
          </div>

          {/* Section 2: Linked Social Accounts */}
          <div className="pt-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-500" />
                  <span>{isArabic ? 'الحسابات المرتبطة' : 'Linked Accounts'}</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isArabic
                    ? 'اربط حساباتك المفضلة لتسجيل دخول سريع وسلس'
                    : 'Link your favorite accounts for fast and secure sign-in'}
                </p>
              </div>

              <Tooltip content={isArabic ? 'تحديث قائمة الحسابات المرتبطة' : 'Refresh linked accounts'} position="top">
                <button
                  type="button"
                  onClick={fetchLinkedAccounts}
                  disabled={isLoadingLinked}
                  className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLinked ? 'animate-spin' : ''}`} />
                </button>
              </Tooltip>
            </div>

            {socialActionMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  socialActionMessage.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300'
                }`}
              >
                {socialActionMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                )}
                <span>{socialActionMessage.text}</span>
              </div>
            )}

            {/* List of 3 major providers: Google, Facebook, Twitter */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['google', 'facebook', 'twitter'] as const).map((prov) => {
                const isLinked = linkedAccounts.some((a) => a.provider.toLowerCase() === prov);
                const account = linkedAccounts.find((a) => a.provider.toLowerCase() === prov);
                const isBusy = linkingProvider === prov || unlinkingProvider === prov;

                return (
                  <div
                    key={prov}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shadow-sm ${
                          prov === 'google'
                            ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                            : prov === 'facebook'
                            ? 'bg-blue-600/10 text-blue-600 border border-blue-600/20'
                            : 'bg-slate-900/10 dark:bg-slate-100/10 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700'
                        }`}>
                          {prov === 'google' ? 'G' : prov === 'facebook' ? 'f' : '𝕏'}
                        </span>
                        <span className="text-xs font-bold capitalize text-slate-900 dark:text-white">
                          {prov === 'twitter' ? 'Twitter / 𝕏' : prov}
                        </span>
                      </div>

                      {isLinked ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          {isArabic ? 'متصل' : 'Connected'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 dark:bg-slate-800 text-slate-500">
                          {isArabic ? 'غير متصل' : 'Not Linked'}
                        </span>
                      )}
                    </div>

                    {isLinked && account && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
                        {account.providerEmail || account.displayName || account.providerUserId}
                      </div>
                    )}

                    <div>
                      {isLinked ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleUnlinkSocial(prov)}
                          className="w-full py-1.5 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                        >
                          {isBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          <span>{isArabic ? 'إلغاء الربط' : 'Disconnect'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleLinkSocial(prov)}
                          className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all shadow-sm disabled:opacity-50"
                        >
                          {isBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                          <span>{isArabic ? 'ربط الحساب' : 'Connect'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Change Password */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Lock className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {isArabic ? 'الأمان وتغيير كلمة المرور' : 'Account Security & Password'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isArabic ? 'قم بتحديث كلمة المرور لحماية حسابك' : 'Update your password to keep your account safe'}
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isArabic ? 'كلمة المرور الحالية' : 'Current Password'}
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white dark:bg-[#0b0f17] border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white pr-10 rtl:pr-3.5 rtl:pl-10 focus:outline-none focus:border-indigo-500 shadow-sm"
                  />
                  <Tooltip content={showCurrentPassword ? (isArabic ? 'إخفاء كلمة المرور' : 'Hide password') : (isArabic ? 'إظهار كلمة المرور' : 'Show password')} position="left">
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((prev) => !prev)}
                      className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </Tooltip>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isArabic ? 'كلمة المرور الجديدة' : 'New Password'}
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="•••••••• (Min. 6 chars)"
                    className="w-full bg-white dark:bg-[#0b0f17] border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white pr-10 rtl:pr-3.5 rtl:pl-10 focus:outline-none focus:border-indigo-500 shadow-sm"
                  />
                  <Tooltip content={showNewPassword ? (isArabic ? 'إخفاء كلمة المرور' : 'Hide password') : (isArabic ? 'إظهار كلمة المرور' : 'Show password')} position="left">
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </Tooltip>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isArabic ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white dark:bg-[#0b0f17] border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 shadow-sm"
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
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                  >
                    {isChangingPassword && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isChangingPassword ? (isArabic ? 'جاري التغيير...' : 'Updating Password...') : (isArabic ? 'تحديث كلمة المرور' : 'Update Password')}</span>
                  </button>
                </Tooltip>
              </div>
            </form>
          </div>

          {/* Section 4: Active Device Sessions */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>{isArabic ? 'الأجهزة والجلسات النشطة' : 'Active Device Sessions'}</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isArabic
                    ? 'الأجهزة والمتصفحات المسجل دخولها حالياً بحسابك'
                    : 'Devices and browsers currently logged into your account'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Tooltip content={isArabic ? 'تحديث قائمة الأجهزة' : 'Refresh session list'} position="top">
                  <button
                    type="button"
                    onClick={fetchSessions}
                    disabled={isLoadingSessions}
                    className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSessions ? 'animate-spin' : ''}`} />
                  </button>
                </Tooltip>

                {sessions.length > 1 && (
                  <Tooltip content={isArabic ? 'إنهاء كافة الجلسات الأخرى ما عدا هذا الجهاز' : 'Log out from all other devices except this one'} position="top">
                    <button
                      type="button"
                      disabled={isRevokingAll}
                      onClick={handleRevokeAllOtherSessions}
                      className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {isRevokingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                      <span>{isArabic ? 'إنهاء باقي الجلسات' : 'Revoke Other Devices'}</span>
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>

            {sessionActionMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  sessionActionMessage.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300'
                }`}
              >
                {sessionActionMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                )}
                <span>{sessionActionMessage.text}</span>
              </div>
            )}

            <div className="space-y-2.5">
              {isLoadingSessions && sessions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                  <span>{isArabic ? 'جاري جلب الجلسات...' : 'Loading active sessions...'}</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                  {isArabic ? 'الجلسة الحالية نشطة فقط.' : 'Only current active session.'}
                </div>
              ) : (
                sessions.map((sess) => {
                  const isMobile = sess.deviceType?.toLowerCase().includes('mobile') || sess.userAgent?.toLowerCase().includes('mobile') || sess.userAgent?.toLowerCase().includes('android') || sess.userAgent?.toLowerCase().includes('iphone');
                  return (
                    <div
                      key={sess.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 shrink-0 shadow-sm">
                          {isMobile ? <Smartphone className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {sess.deviceName || (isMobile ? 'Mobile Device' : 'Desktop Browser')}
                            </span>
                            {sess.isTrusted && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" />
                                {isArabic ? 'موثوق' : 'Trusted'}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5 flex-wrap">
                            {sess.ipAddress && <span>IP: {sess.ipAddress}</span>}
                            <span>{new Date(sess.lastActiveAtUtc).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <Tooltip content={sess.isTrusted ? (isArabic ? 'إلغاء الوثوق' : 'Untrust device') : (isArabic ? 'تمييز كجهاز موثوق' : 'Trust device')} position="top">
                          <button
                            type="button"
                            onClick={() => handleTrustSession(sess.id, sess.isTrusted)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1 ${
                              sess.isTrusted
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>{sess.isTrusted ? (isArabic ? 'موثوق' : 'Trusted') : (isArabic ? 'توثيق' : 'Trust')}</span>
                          </button>
                        </Tooltip>

                        <Tooltip content={isArabic ? 'إنهاء الجلسة وتسجيل الخروج من هذا الجهاز' : 'Revoke session from this device'} position="top">
                          <button
                            type="button"
                            disabled={revokingSessionId === sess.id}
                            onClick={() => handleDeleteSession(sess.id)}
                            className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                          >
                            {revokingSessionId === sess.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            <span>{isArabic ? 'إنهاء' : 'Revoke'}</span>
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Section 5: Session & Account Actions */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {isArabic ? 'إدارة الجلسة والحساب' : 'Session & Account Actions'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isArabic
                  ? 'تسجيل الخروج من الجلسة الحالية على هذا الجهاز أو الدخول بحساب آخر'
                  : 'Log out of your current session on this device or switch account.'}
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

              <Tooltip content={isArabic ? 'تسجيل الدخول بحساب آخر' : 'Sign in with another account'} position="top">
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-2 transition-colors shadow-sm"
                >
                  <User className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span>{isArabic ? 'تسجيل الدخول بحساب آخر' : 'Switch Account'}</span>
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}

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

      {/* Banner Customizer Quick Modal */}
      {isBannerModalOpen && isOwnProfile && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div
            className="glass-card w-full max-w-xl rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 animate-scale-up"
            dir={isArabic ? 'rtl' : 'ltr'}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <Palette className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {isArabic ? 'تخصيص غلاف الملف الشخصي' : 'Customize Profile Cover Banner'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isArabic ? 'اختر مظهراً مخصصاً أو ارفع صورة غلاف خاصة بك' : 'Choose a preset gradient or upload your custom cover image'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsBannerModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Banner Preview Box */}
            <div className="h-28 sm:h-36 w-full rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative shadow-inner">
              {renderBannerContent(editBannerUrl)}
              <div className="absolute bottom-2 right-3 rtl:right-auto rtl:left-3 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-black/60 text-white backdrop-blur-md">
                {isArabic ? 'معاينة حية' : 'Live Preview'}
              </div>
            </div>

            {/* Preset Gradients Grid */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{isArabic ? 'المظاهر اللونية المنسقة' : 'Curated Theme Gradients'}</span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto pr-1 no-scrollbar">
                {BANNER_PRESETS.map((preset) => {
                  const isSelected = editBannerUrl === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setEditBannerUrl(preset.id)}
                      className={`p-2.5 rounded-xl border text-left rtl:text-right transition-all group flex flex-col gap-1.5 ${
                        isSelected
                          ? 'border-indigo-600 ring-2 ring-indigo-500/50 bg-indigo-50/50 dark:bg-indigo-950/30'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-900/60'
                      }`}
                    >
                      <div className={`h-8 w-full rounded-lg bg-gradient-to-r ${preset.previewClass} border border-white/10 shadow-sm relative overflow-hidden`}>
                        {isSelected && (
                          <div className="absolute inset-0 bg-indigo-600/30 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
                        {isArabic ? preset.nameAr : preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Tooltip content={isArabic ? 'رفع صورة غلاف من جهازك (حتى 8 ميغابايت)' : 'Upload cover banner from device (max 8MB)'} position="top">
                  <button
                    type="button"
                    onClick={() => bannerFileInputRef.current?.click()}
                    disabled={isUploadingBanner}
                    className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    <span>{isUploadingBanner ? (isArabic ? 'جاري الرفع...' : 'Uploading...') : (isArabic ? 'رفع صورة غلاف' : 'Upload Image')}</span>
                  </button>
                </Tooltip>

                {editBannerUrl && (
                  <Tooltip content={isArabic ? 'إعادة ضبط الغلاف للوضع الافتراضي' : 'Reset banner to default'} position="top">
                    <button
                      type="button"
                      onClick={() => setEditBannerUrl('')}
                      className="px-3 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isArabic ? 'إزالة' : 'Reset'}</span>
                    </button>
                  </Tooltip>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBannerModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                >
                  {isArabic ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  type="button"
                  disabled={isSavingBanner}
                  onClick={() => handleQuickSaveBanner(editBannerUrl)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingBanner ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{isSavingBanner ? (isArabic ? 'جاري الحفظ...' : 'Saving...') : (isArabic ? 'حفظ الغلاف' : 'Apply & Save')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
