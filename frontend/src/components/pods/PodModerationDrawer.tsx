import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { api, getMediaUrl } from '../../services/apiClient';
import { MoodPodDto, PodSpeaker, UserDto } from '../../types/api';
import { Tooltip } from '../ui/Tooltip';
import {
  Check,
  Copy,
  Crown,
  Globe,
  Image as ImageIcon,
  Key,
  Link as LinkIcon,
  Loader2,
  Lock,
  Mic,
  MicOff,
  Music,
  Palette,
  Radio,
  Send,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PodModerationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pod: MoodPodDto;
  isHost: boolean;
  isModerator: boolean;
  speakers: PodSpeaker[];
  listeners?: { userId: string; username: string; displayName: string; avatarUrl?: string }[];
  onSettingsUpdated: (updatedPod: MoodPodDto) => void;
}

const THEMES = [
  { id: 'cosmic-purple', name: 'Cosmic Nebula', nameAr: 'سديم كوني' },
  { id: 'cyber-neon', name: 'Cyberpunk Synth', nameAr: 'سايبر بانك نيون' },
  { id: 'lofi-chill', name: 'Late Night Lo-Fi', nameAr: 'مقهى لو-فاي هادئ' },
  { id: 'rain-forest', name: 'Rainy Night', nameAr: 'أمطار هادئة' },
  { id: 'neon-amber', name: 'Electric Amber', nameAr: 'كهرباء ذهبية' },
];

export const PodModerationDrawer: React.FC<PodModerationDrawerProps> = ({
  isOpen,
  onClose,
  pod,
  isHost,
  isModerator,
  speakers,
  listeners = [],
  onSettingsUpdated,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';
  const { currentPersona } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'settings' | 'participants' | 'invites'>('settings');

  // Room Settings State
  const [theme, setTheme] = useState(pod.backgroundTheme || 'cosmic-purple');
  const [customBgImage, setCustomBgImage] = useState(pod.customBackgroundImageUrl || '');
  const [allowChangeTheme, setAllowChangeTheme] = useState(pod.allowParticipantsChangeTheme ?? false);
  const [allowPlayMusic, setAllowPlayMusic] = useState(pod.allowParticipantsPlayBgMusic ?? true);
  const [allowOpenMic, setAllowOpenMic] = useState(pod.allowOpenMic ?? true);
  const [isPrivate, setIsPrivate] = useState(pod.isPrivate ?? false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Invite user state
  const [inviteTargetUserId, setInviteTargetUserId] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState<string | null>(null);

  const bgFileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Handle Custom Wallpaper Upload
  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingBg(true);
    try {
      const res = await api.uploadMedia(file, `pod_bg_${pod.id}.webp`);
      setCustomBgImage(res.url);
    } catch (err) {
      console.error('Wallpaper upload failed:', err);
    } finally {
      setIsUploadingBg(false);
      if (bgFileInputRef.current) bgFileInputRef.current.value = '';
    }
  };

  // Handle Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const updated = await api.updatePodSettings(pod.id, {
        backgroundTheme: theme,
        customBackgroundImageUrl: customBgImage,
        allowParticipantsChangeTheme: allowChangeTheme,
        allowParticipantsPlayBgMusic: allowPlayMusic,
        allowOpenMic: allowOpenMic,
        isPrivate: isPrivate,
      });
      onSettingsUpdated(updated);
      onClose();
    } catch (err) {
      console.error('Failed to update pod settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Moderation Action (Mute, Kick, Promote, Demote)
  const handleModerateAction = async (targetUserId: string, targetUsername: string, action: string) => {
    try {
      await api.moderatePodParticipant(pod.id, targetUserId, targetUsername, action);
    } catch (err) {
      console.error('Moderation action failed:', err);
    }
  };

  // Send Pod Invite to User
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteTargetUserId.trim()) return;

    setIsInviting(true);
    setInviteSuccessMsg(null);
    try {
      await api.inviteUserToPod(pod.id, inviteTargetUserId.trim());
      setInviteSuccessMsg(isArabic ? 'تم إرسال دعوة الحجرة بنجاح! 🚀' : 'Invitation sent successfully! 🚀');
      setInviteTargetUserId('');
    } catch (err) {
      console.error('Failed to send invite:', err);
    } finally {
      setIsInviting(false);
    }
  };

  const copyInviteCode = () => {
    if (!pod.inviteCode) return;
    navigator.clipboard.writeText(pod.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/?podId=${pod.id}${pod.inviteCode ? `&code=${pod.inviteCode}` : ''}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, x: isArabic ? -320 : 320 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: isArabic ? -320 : 320 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-md h-full bg-white dark:bg-zinc-900 border-l rtl:border-l-0 rtl:border-r border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden text-zinc-900 dark:text-white"
        >
          {/* Header */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                  {isArabic ? 'إدارة وتحكم الحجرة' : 'Pod Control & Moderation'}
                </h3>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium truncate block max-w-[200px]">
                  {pod.title}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 p-1.5 bg-zinc-50 dark:bg-zinc-950/60 gap-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'settings'
                  ? 'bg-white dark:bg-zinc-850 text-cyan-600 dark:text-cyan-400 shadow-sm border border-zinc-200 dark:border-zinc-700'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>{isArabic ? 'الإعدادات' : 'Settings'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('participants')}
              className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'participants'
                  ? 'bg-white dark:bg-zinc-850 text-cyan-600 dark:text-cyan-400 shadow-sm border border-zinc-200 dark:border-zinc-700'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{isArabic ? 'المشاركون' : 'Moderation'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('invites')}
              className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'invites'
                  ? 'bg-white dark:bg-zinc-850 text-cyan-600 dark:text-cyan-400 shadow-sm border border-zinc-200 dark:border-zinc-700'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{isArabic ? 'الدعوات' : 'Invites'}</span>
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* 1. ROOM SETTINGS TAB */}
            {activeTab === 'settings' && (
              <form onSubmit={handleSaveSettings} className="space-y-4">
                {/* Visual Theme Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    {isArabic ? 'السمة البصرية للحجرة' : 'Pod Visual Theme'}
                  </label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(t.id)}
                        className={`p-2.5 rounded-2xl border text-left rtl:text-right transition-all flex items-center justify-between ${
                          theme === t.id
                            ? 'bg-cyan-500/10 border-cyan-500 text-cyan-700 dark:text-cyan-300 ring-2 ring-cyan-500/30'
                            : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        <span className="text-xs font-bold">{isArabic ? t.nameAr : t.name}</span>
                        {theme === t.id && <Sparkles className="w-3.5 h-3.5 text-cyan-500" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Wallpaper Image Upload */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    {isArabic ? 'صورة خلفية مخصصة (Wallpaper)' : 'Custom Background Wallpaper'}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="https://images.unsplash.com/..."
                      value={customBgImage}
                      onChange={(e) => setCustomBgImage(e.target.value)}
                      className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none"
                    />
                    <input
                      type="file"
                      ref={bgFileInputRef}
                      onChange={handleBgUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isUploadingBg}
                      onClick={() => bgFileInputRef.current?.click()}
                      className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl transition-colors shrink-0"
                      title="Upload wallpaper image"
                    >
                      {isUploadingBg ? (
                        <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
                      ) : (
                        <Upload className="w-4 h-4 text-cyan-500" />
                      )}
                    </button>
                  </div>
                  {customBgImage && (
                    <div className="relative rounded-xl overflow-hidden h-20 border border-zinc-200 dark:border-zinc-800">
                      <img src={getMediaUrl(customBgImage)} alt="Custom Wallpaper Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setCustomBgImage('')}
                        className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full hover:bg-rose-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Privacy Toggle (Host only) */}
                {isHost && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      {isArabic ? 'خصوصية الحجرة' : 'Room Privacy Mode'}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIsPrivate(false)}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          !isPrivate
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                            : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{isArabic ? 'عامة 🌐' : 'Public 🌐'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsPrivate(true)}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          isPrivate
                            ? 'bg-purple-500/15 border-purple-500 text-purple-700 dark:text-purple-300'
                            : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        <Lock className="w-3.5 h-3.5 text-purple-500" />
                        <span>{isArabic ? 'خاصة 🔒' : 'Private 🔒'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Host Permission Rules */}
                {isHost && (
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-950/80 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                    <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-cyan-500" />
                      <span>{isArabic ? 'صلاحيات الحضور في الحجرة' : 'Participant Permissions'}</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {isArabic ? 'تغيير ثيم وخلفية الغرفة' : 'Allow changing theme & wallpaper'}
                        </span>
                        <input
                          type="checkbox"
                          checked={allowChangeTheme}
                          onChange={(e) => setAllowChangeTheme(e.target.checked)}
                          className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                        />
                      </label>

                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {isArabic ? 'تشغيل موسيقى الخلفية (DJ)' : 'Allow playing background music'}
                        </span>
                        <input
                          type="checkbox"
                          checked={allowPlayMusic}
                          onChange={(e) => setAllowPlayMusic(e.target.checked)}
                          className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                        />
                      </label>

                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {isArabic ? 'مسرح مايك مفتوح للجميع' : 'Open mic for everyone'}
                        </span>
                        <input
                          type="checkbox"
                          checked={allowOpenMic}
                          onChange={(e) => setAllowOpenMic(e.target.checked)}
                          className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  {isSavingSettings ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{isArabic ? 'حفظ وتطبيق التغييرات لجميع الحضور' : 'Save & Broadcast Changes'}</span>
                </button>
              </form>
            )}

            {/* 2. PARTICIPANTS & MODERATION TAB */}
            {activeTab === 'participants' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                  {speakers.length} {isArabic ? 'متحدث على المسرح' : 'Speakers on Stage'}
                </div>

                {speakers.map((sp) => {
                  const isUserHost = sp.username === pod.hostUsername;
                  const isUserMod = pod.moderatorUserIds?.includes(sp.userId);
                  const isMe = sp.userId === currentPersona.id;

                  return (
                    <div
                      key={sp.userId}
                      className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 shadow-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={sp.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${sp.username}`}
                          alt={sp.username}
                          className="w-9 h-9 rounded-xl bg-zinc-200 dark:bg-zinc-800 object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                              {sp.displayName || sp.username}
                            </span>
                            {isUserHost && (
                              <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[9px] font-black rounded-md border border-amber-500/30">
                                Host 👑
                              </span>
                            )}
                            {isUserMod && !isUserHost && (
                              <span className="px-1.5 py-0.2 bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 text-[9px] font-black rounded-md border border-cyan-500/30">
                                Mod 🛡️
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate block">
                            @{sp.username}
                          </span>
                        </div>
                      </div>

                      {/* Moderation Controls */}
                      {!isMe && (isHost || (isModerator && !isUserHost)) && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Remote Mute Button */}
                          <Tooltip content={isArabic ? 'كتم مايك المتحدث' : 'Remote mute speaker'} position="top">
                            <button
                              type="button"
                              onClick={() => handleModerateAction(sp.userId, sp.username, 'remote_mute')}
                              className="p-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-rose-500/20 hover:text-rose-500 text-zinc-600 dark:text-zinc-400 transition-colors"
                            >
                              <MicOff className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>

                          {/* Host only: Promote / Demote Moderator */}
                          {isHost && (
                            <Tooltip
                              content={
                                isUserMod
                                  ? isArabic
                                    ? 'إلغاء صلاحية المشرف'
                                    : 'Demote moderator'
                                  : isArabic
                                  ? 'ترقية إلى مشرف الغرفة 🛡️'
                                  : 'Promote to moderator 🛡️'
                              }
                              position="top"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  handleModerateAction(
                                    sp.userId,
                                    sp.username,
                                    isUserMod ? 'demote_moderator' : 'promote_moderator'
                                  )
                                }
                                className={`p-1.5 rounded-lg transition-colors ${
                                  isUserMod
                                    ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-cyan-500'
                                }`}
                              >
                                <Shield className="w-3.5 h-3.5" />
                              </button>
                            </Tooltip>
                          )}

                          {/* Kick from Pod */}
                          <Tooltip content={isArabic ? 'طرد من الحجرة' : 'Kick from room'} position="top">
                            <button
                              type="button"
                              onClick={() => handleModerateAction(sp.userId, sp.username, 'kick')}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-600 dark:text-rose-400 transition-colors"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. INVITES TAB */}
            {activeTab === 'invites' && (
              <div className="space-y-4">
                {/* Invite Code & Link Card */}
                <div className="p-4 bg-purple-500/10 dark:bg-purple-950/40 rounded-2xl border border-purple-500/30 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-900 dark:text-purple-300">
                    <Key className="w-4 h-4 text-purple-500" />
                    <span>{isArabic ? 'كود ورابط الدخول للحجرة' : 'Room Invite Code & Link'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3.5 py-2 bg-white dark:bg-zinc-900 rounded-xl border border-purple-500/30 font-mono font-black text-sm text-center text-purple-700 dark:text-purple-300 tracking-wider">
                      {pod.inviteCode || `POD-${pod.id.substring(0, 4).toUpperCase()}`}
                    </div>
                    <Tooltip content={copiedCode ? (isArabic ? 'تم النسخ!' : 'Copied!') : (isArabic ? 'نسخ كود الدخول' : 'Copy Code')} position="top">
                      <button
                        type="button"
                        onClick={copyInviteCode}
                        className="p-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-md transition-all active:scale-95"
                      >
                        {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </Tooltip>
                  </div>

                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className="w-full py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-800 dark:text-purple-200 border border-purple-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <LinkIcon className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? (isArabic ? 'تم نسخ الرابط المباشر!' : 'Direct Link Copied!') : (isArabic ? 'نسخ رابط الانضمام المباشر' : 'Copy Direct Invite Link')}</span>
                  </button>
                </div>

                {/* Direct User Invite Input */}
                <form onSubmit={handleSendInvite} className="space-y-2">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    {isArabic ? 'إرسال دعوة مباشرة لمبدع (User ID)' : 'Direct User ID Invitation'}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 11111111-1111-1111-1111-111111111111"
                      value={inviteTargetUserId}
                      onChange={(e) => setInviteTargetUserId(e.target.value)}
                      className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isInviting || !inviteTargetUserId.trim()}
                      className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md disabled:opacity-50 transition-all active:scale-95"
                    >
                      {isInviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>{isArabic ? 'إرسال' : 'Invite'}</span>
                    </button>
                  </div>

                  {inviteSuccessMsg && (
                    <div className="p-2.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-500/30 text-xs font-bold">
                      {inviteSuccessMsg}
                    </div>
                  )}
                </form>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

