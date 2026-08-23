import React, { useState, useEffect } from 'react';
import { useAuthStore, Persona } from '../../stores/useAuthStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { api } from '../../services/apiClient';
import { UserProfileDto } from '../../types/api';
import {
  Award,
  Calendar,
  CheckCircle2,
  Edit3,
  Flame,
  GitBranch,
  Heart,
  MessageSquare,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  Trophy,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProfileViewProps {
  username?: string;
  onOpenCanvas?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ username, onOpenCanvas }) => {
  const { currentPersona, setPersona, addCustomPersona } = useAuthStore();
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  const targetUsername = username || currentPersona.username;
  const isOwnProfile = targetUsername.toLowerCase() === currentPersona.username.toLowerCase();

  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'chains' | 'badges'>('posts');
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Edit Profile Form State
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const data = await api.getUserProfile(targetUsername);
        setProfile(data);
        setEditDisplayName(data.displayName);
        setEditBio(data.bio || '');
        setEditAvatarUrl(data.avatarUrl || currentPersona.avatarUrl);
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [targetUsername, currentPersona.username]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const updated = await api.updateProfile({
        displayName: editDisplayName.trim(),
        bio: editBio.trim(),
        avatarUrl: editAvatarUrl,
      });

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
            }
          : null
      );

      setSaveSuccess(true);
      setTimeout(() => {
        setIsSaving(false);
        setIsEditOpen(false);
      }, 800);
    } catch (err) {
      console.error('Update profile error:', err);
      setIsSaving(false);
    }
  };

  const getRepTier = (rep: number) => {
    if (rep >= 500) return { name: isArabic ? 'الماسي 💎' : 'Diamond Tier 💎', max: 1000, color: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10' };
    if (rep >= 300) return { name: isArabic ? 'الذهبي 🥇' : 'Gold Tier 🥇', max: 500, color: 'text-amber-400 border-amber-500/40 bg-amber-500/10' };
    if (rep >= 150) return { name: isArabic ? 'الفضي 🥈' : 'Silver Tier 🥈', max: 300, color: 'text-zinc-300 border-zinc-500/40 bg-zinc-500/10' };
    return { name: isArabic ? 'البرونزي 🥉' : 'Bronze Tier 🥉', max: 150, color: 'text-orange-400 border-orange-500/40 bg-orange-500/10' };
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3 text-zinc-400">
        <RefreshCw className="w-7 h-7 animate-spin text-fuchsia-400" />
        <p className="text-xs font-semibold">{isArabic ? 'جاري تحميل الملف الشخصي...' : 'Loading profile...'}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center glass-card rounded-3xl space-y-3">
        <User className="w-12 h-12 text-zinc-600 mx-auto" />
        <h3 className="text-base font-bold text-zinc-200">{isArabic ? 'المستخدم غير موجود' : 'User profile not found'}</h3>
      </div>
    );
  }

  const repTier = getRepTier(profile.repScore);
  const repProgress = Math.min(100, Math.round((profile.repScore / repTier.max) * 100));

  return (
    <div className="space-y-6 text-white">
      {/* 1. Header Banner & Profile Info Card */}
      <div className="glass-card rounded-3xl border border-zinc-800/80 overflow-hidden shadow-2xl relative">
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
        <div className="px-5 sm:px-8 pb-6 relative -mt-14 sm:-mt-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            {/* Large Avatar */}
            <div className="relative group">
              <img
                src={profile.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.username}`}
                alt={profile.username}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-zinc-900 border-4 border-zinc-950 object-cover shadow-2xl"
              />
              <div className="absolute bottom-1 right-1 rtl:right-auto rtl:left-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-zinc-950" />
            </div>

            {/* Actions: Edit Profile (if own) */}
            {isOwnProfile && (
              <button
                onClick={() => setIsEditOpen(true)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-2xl text-xs font-bold text-white flex items-center gap-2 transition-all self-start sm:self-auto shadow-lg"
              >
                <Edit3 className="w-3.5 h-3.5 text-fuchsia-400" />
                <span>{isArabic ? 'تعديل الملف الشخصي' : 'Edit Profile'}</span>
              </button>
            )}
          </div>

          {/* User Bio & Meta */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {profile.displayName}
              </h2>
              <span className="text-xs text-zinc-400 font-semibold">@{profile.username}</span>
            </div>

            <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl leading-relaxed">
              {profile.bio || (isArabic ? 'صانع محتوى وقصص في SparkLoop' : 'SparkLoop Creator & Storyteller')}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-1">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                <span>{isArabic ? 'انضم في' : 'Joined'} {new Date(profile.createdAtUtc).toLocaleDateString()}</span>
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isArabic ? 'حساب موثق' : 'Verified Creator'}</span>
              </span>
            </div>
          </div>

          {/* Reputation XP Bar */}
          <div className="mt-5 p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1 text-amber-400">
                <Zap className="w-4 h-4 text-amber-400" />
                {isArabic ? 'نقاط السمعة والتفاعل' : 'Reputation Score'}
              </span>
              <span className="font-mono font-bold text-zinc-200">
                {profile.repScore} / {repTier.max} XP
              </span>
            </div>
            <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/80">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-fuchsia-500 to-cyan-400 rounded-full transition-all duration-700"
                style={{ width: `${repProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-4 border border-zinc-800 text-center space-y-1">
          <MessageSquare className="w-5 h-5 text-fuchsia-400 mx-auto" />
          <div className="text-lg font-black text-white">{profile.postsCount}</div>
          <div className="text-[11px] text-zinc-400">{isArabic ? 'التدوينات والميمز' : 'Posts & Memes'}</div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-zinc-800 text-center space-y-1">
          <Heart className="w-5 h-5 text-rose-400 mx-auto" />
          <div className="text-lg font-black text-white">{profile.totalReactionsReceived}</div>
          <div className="text-[11px] text-zinc-400">{isArabic ? 'التفاعلات المستلمة' : 'Reactions'}</div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-zinc-800 text-center space-y-1">
          <GitBranch className="w-5 h-5 text-purple-400 mx-auto" />
          <div className="text-lg font-black text-white">{profile.chainsCount}</div>
          <div className="text-[11px] text-zinc-400">{isArabic ? 'سلاسل القصص' : 'Story Chains'}</div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-zinc-800 text-center space-y-1">
          <Trophy className="w-5 h-5 text-amber-400 mx-auto" />
          <div className="text-lg font-black text-white">{profile.sparksWonCount}</div>
          <div className="text-[11px] text-zinc-400">{isArabic ? 'تحديات السبارك' : 'Sparks Won'}</div>
        </div>
      </div>

      {/* 3. Badges Showcase */}
      {profile.badges.length > 0 && (
        <div className="glass-card rounded-3xl p-5 border border-zinc-800 space-y-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-fuchsia-400" />
            <h3 className="font-bold text-sm text-white">
              {isArabic ? 'الأوسمة والجوائز المكتسبة' : 'Awarded Badges & Trophies'}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {profile.badges.map((b) => (
              <div
                key={b.id}
                className="p-3 bg-zinc-900/80 rounded-2xl border border-zinc-800 flex items-center gap-3"
              >
                <span className="text-2xl p-2 bg-zinc-950 rounded-xl border border-zinc-800 shrink-0">
                  {b.icon}
                </span>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs text-zinc-100 truncate">{b.name}</h4>
                  <p className="text-[11px] text-zinc-400 line-clamp-1">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Tabbed Portfolio: Posts / Chains */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
          <button
            onClick={() => setActiveTab('posts')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'posts'
                ? 'bg-fuchsia-600 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {isArabic ? 'المشاركات' : 'Posts & Memes'} ({profile.recentPosts.length})
          </button>

          <button
            onClick={() => setActiveTab('chains')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'chains'
                ? 'bg-fuchsia-600 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {isArabic ? 'سلاسل القصص' : 'Story Chains'} ({profile.recentChains.length})
          </button>
        </div>

        {/* Posts Tab Content */}
        {activeTab === 'posts' && (
          <div className="space-y-3">
            {profile.recentPosts.length === 0 ? (
              <div className="p-8 text-center glass-card rounded-2xl text-xs text-zinc-500">
                {isArabic ? 'لا توجد مشاركات بعد' : 'No posts created yet.'}
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
                    <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 max-h-72 flex items-center justify-center">
                      <img src={post.media.url} alt="Post media" className="w-full h-auto object-cover max-h-72" />
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

        {/* Chains Tab Content */}
        {activeTab === 'chains' && (
          <div className="space-y-3">
            {profile.recentChains.length === 0 ? (
              <div className="p-8 text-center glass-card rounded-2xl text-xs text-zinc-500">
                {isArabic ? 'لم يشارك في سلاسل مايك بعد' : 'No chain contributions yet.'}
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

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl space-y-4 text-white"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-fuchsia-400" />
                  {isArabic ? 'تعديل الملف الشخصي' : 'Edit Profile'}
                </h3>
                <button
                  onClick={() => setIsEditOpen(false)}
                  className="p-2 text-zinc-400 hover:text-white rounded-full bg-zinc-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">
                    {isArabic ? 'الاسم المعروض' : 'Display Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-fuchsia-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">
                    {isArabic ? 'النبذة التعريفية' : 'Bio'}
                  </label>
                  <textarea
                    rows={3}
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder={isArabic ? 'اكتب نبذة عن اهتماماتك وإبداعك...' : 'Tell the community about yourself...'}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white resize-none focus:outline-none focus:border-fuchsia-500"
                  />
                </div>

                {saveSuccess && (
                  <div className="p-2.5 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{isArabic ? 'تم حفظ التعديلات بنجاح!' : 'Profile updated successfully!'}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditOpen(false)}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-semibold"
                  >
                    {isArabic ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {isSaving ? (isArabic ? 'جاري الحفظ...' : 'Saving...') : (isArabic ? 'حفظ التعديلات' : 'Save Changes')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
