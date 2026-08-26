import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { api, getMediaUrl } from '../../services/apiClient';
import { MoodPodDto, PodSpeaker, UserDto } from '../../types/api';
import { Tooltip } from '../ui/Tooltip';
import {
  Check,
  Clock,
  Copy,
  Crown,
  Globe,
  Hand,
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
  onPodClosed?: () => void;
  onPromoteModerator?: (userId: string, username: string) => void;
  onDemoteModerator?: (userId: string, username: string) => void;
  onRemoteMuteSpeaker?: (userId: string, username: string) => void;
  onRemoveSpeaker?: (userId: string, username: string) => void;
}

const THEMES = [
  { id: 'cosmic-purple', name: 'Cosmic Nebula', nameAr: 'سديم كوني' },
  { id: 'cyber-neon', name: 'Cyberpunk Synth', nameAr: 'سايبر بانك نيون' },
  { id: 'lofi-chill', name: 'Late Night Lo-Fi', nameAr: 'مقهى لو-فاي هادئ' },
  { id: 'rain-forest', name: 'Rainy Night', nameAr: 'أمطار هادئة' },
  { id: 'neon-amber', name: 'Electric Amber', nameAr: 'كهرباء ذهبية' },
];

const EXTEND_DURATION_OPTIONS = [
  { value: 1, labelEn: '1 Hour', labelAr: '1 ساعة' },
  { value: 6, labelEn: '6 Hours', labelAr: '6 ساعات' },
  { value: 12, labelEn: '12 Hours', labelAr: '12 ساعة' },
  { value: 24, labelEn: '24 Hours', labelAr: '24 ساعة' },
  { value: 72, labelEn: '3 Days', labelAr: '3 أيام' },
  { value: 168, labelEn: '7 Days', labelAr: '7 أيام' },
  { value: -1, labelEn: 'Permanent ♾️', labelAr: 'دائمة بلا إغلاق ♾️' },
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
  onPodClosed,
  onPromoteModerator,
  onDemoteModerator,
  onRemoteMuteSpeaker,
  onRemoveSpeaker,
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
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isClosingPod, setIsClosingPod] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
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
        durationHours: selectedDuration !== null ? selectedDuration : undefined,
      });
      onSettingsUpdated(updated);
      onClose();
    } catch (err) {
      console.error('Failed to update pod settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Handle Close / Terminate Pod
  const handleClosePod = async () => {
    setIsClosingPod(true);
    try {
      await api.closePod(pod.id);
      onPodClosed?.();
      onClose();
    } catch (err) {
      console.error('Failed to close pod:', err);
    } finally {
      setIsClosingPod(false);
    }
  };

  // Moderation Action (Mute, Kick, Promote, Demote)
  const handleModerateAction = async (targetUserId: string, targetUsername: string, action: string) => {
    try {
      await api.moderatePodParticipant(pod.id, targetUserId, targetUsername, action);
      if (action === 'promote_moderator') {
        onPromoteModerator?.(targetUserId, targetUsername);
      } else if (action === 'demote_moderator') {
        onDemoteModerator?.(targetUserId, targetUsername);
      } else if (action === 'remote_mute') {
        onRemoteMuteSpeaker?.(targetUserId, targetUsername);
      } else if (action === 'kick_stage' || action === 'kick') {
        onRemoveSpeaker?.(targetUserId, targetUsername);
      }
    } catch (err) {
      console.error(`Failed to execute moderation action ${action}:`, err);
    }
  };

  // Invite User by ID
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
              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 p-1.5 bg-zinc-50 dark:bg-zinc-950/60 gap-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
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
              className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
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
              className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
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
                        className={`p-2.5 rounded-2xl border text-left rtl:text-right transition-all flex items-center justify-between cursor-pointer ${
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
                      className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl transition-colors shrink-0 cursor-pointer"
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

                {/* Room Lifetime / Duration Option (Host & Moderator) */}
                {(isHost || isModerator) && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>{isArabic ? 'تغيير مدة بقاء الحجرة (Lifetime):' : 'Change Room Lifetime:'}</span>
                      </span>
                      {selectedDuration !== null && (
                        <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-bold">
                          {EXTEND_DURATION_OPTIONS.find((d) => d.value === selectedDuration)?.[isArabic ? 'labelAr' : 'labelEn']}
                        </span>
                      )}
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {EXTEND_DURATION_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setSelectedDuration(selectedDuration === opt.value ? null : opt.value)}
                          className={`py-1.5 px-1.5 rounded-xl text-[10px] font-bold border transition-all text-center cursor-pointer ${
                            selectedDuration === opt.value
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500 shadow-sm'
                              : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                          }`}
                        >
                          {isArabic ? opt.labelAr : opt.labelEn}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Privacy Toggle (Host & Moderator) */}
                {(isHost || isModerator) && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      {isArabic ? 'خصوصية الحجرة' : 'Room Privacy Mode'}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIsPrivate(false)}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
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
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
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

                {/* Speaking Access Mode (Host & Moderators) */}
                {(isHost || isModerator) && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-cyan-500" />
                      <span>{isArabic ? 'نظام التحدث والمايك في الحجرة' : 'Stage Speaking Access Mode'}</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAllowOpenMic(false)}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center text-center gap-1 transition-all cursor-pointer ${
                          !allowOpenMic
                            ? 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300 shadow-sm'
                            : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <Hand className="w-3.5 h-3.5 text-amber-500" />
                          <span>{isArabic ? 'برفع اليد فقط ✋' : 'Request to Speak ✋'}</span>
                        </div>
                        <span className="text-[9.5px] font-normal text-zinc-500 dark:text-zinc-400">
                          {isArabic ? 'المشرف يوافق على الطلب' : 'Approval required'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAllowOpenMic(true)}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center text-center gap-1 transition-all cursor-pointer ${
                          allowOpenMic
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-sm'
                            : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <Mic className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{isArabic ? 'مايك مفتوح 🎙️' : 'Open Mic 🎙️'}</span>
                        </div>
                        <span className="text-[9.5px] font-normal text-zinc-500 dark:text-zinc-400">
                          {isArabic ? 'الجميع يمكنه التحدث' : 'Anyone can speak'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Host & Moderator Permission Rules */}
                {(isHost || isModerator) && (
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-950/80 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                    <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-cyan-500" />
                      <span>{isArabic ? 'صلاحيات الحضور الإضافية' : 'Additional Permissions'}</span>
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
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isSavingSettings ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{isArabic ? 'حفظ وتطبيق الإعدادات لجميع الحضور' : 'Save & Apply Settings'}</span>
                </button>

                {/* Danger Zone: Close Pod for Host/Moderator */}
                {(isHost || isModerator) && (
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                    {!showCloseConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowCloseConfirm(true)}
                        className="w-full py-2 px-3 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isArabic ? 'إغلاق وإنهاء الحجرة نهائياً' : 'Close & End Mood Pod'}</span>
                      </button>
                    ) : (
                      <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/40 space-y-2.5">
                        <p className="text-xs font-bold text-rose-600 dark:text-rose-400 text-center">
                          {isArabic
                            ? '⚠️ هل أنت متأكد من إغلاق الحجرة نهائياً؟ سيتم إنهاء البث وفصل جميع الحضور.'
                            : '⚠️ Are you sure you want to end this room? All participants will be disconnected.'}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowCloseConfirm(false)}
                            className="flex-1 py-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                          >
                            {isArabic ? 'تراجع' : 'Cancel'}
                          </button>
                          <button
                            type="button"
                            disabled={isClosingPod}
                            onClick={handleClosePod}
                            className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
                          >
                            {isClosingPod ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            <span>{isArabic ? 'نعم، إغلاق الآن' : 'Yes, Close Now'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
                              className="p-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-rose-500/20 hover:text-rose-500 text-zinc-600 dark:text-zinc-400 transition-colors cursor-pointer"
                            >
                              <MicOff className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>

                          {/* Remove from Stage Button */}
                          <Tooltip content={isArabic ? 'إنزال المتحدث من المسرح' : 'Remove from stage'} position="top">
                            <button
                              type="button"
                              onClick={() => handleModerateAction(sp.userId, sp.username, 'kick_stage')}
                              className="p-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-amber-500/20 hover:text-amber-500 text-zinc-600 dark:text-zinc-400 transition-colors cursor-pointer"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>

                          {/* Kick from Room Button */}
                          <Tooltip content={isArabic ? 'طرد من الحجرة' : 'Kick from room'} position="top">
                            <button
                              type="button"
                              onClick={() => handleModerateAction(sp.userId, sp.username, 'kick')}
                              className="p-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-rose-500/20 hover:text-rose-500 text-zinc-600 dark:text-zinc-400 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>

                          {/* Promote/Demote Moderator (Host Only) */}
                          {isHost && (
                            <Tooltip
                              content={
                                isUserMod
                                  ? isArabic
                                    ? 'إلغاء صلاحية المشرف'
                                    : 'Demote Moderator'
                                  : isArabic
                                  ? 'ترقية إلى مشرف'
                                  : 'Promote to Moderator'
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
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  isUserMod
                                    ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-cyan-500/10 hover:text-cyan-500'
                                }`}
                              >
                                <Crown className="w-3.5 h-3.5" />
                              </button>
                            </Tooltip>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Listeners List */}
                {listeners.length > 0 && (
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                      {listeners.length} {isArabic ? 'مستمعين بالحجرة' : 'Listeners'}
                    </div>
                    {listeners.map((ls) => (
                      <div
                        key={ls.userId}
                        className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={ls.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${ls.username}`}
                            alt={ls.username}
                            className="w-7 h-7 rounded-lg object-cover"
                          />
                          <span className="text-xs font-medium truncate">{ls.displayName || ls.username}</span>
                        </div>
                        {isHost && ls.userId !== currentPersona.id && (
                          <button
                            type="button"
                            onClick={() => handleModerateAction(ls.userId, ls.username, 'kick')}
                            className="p-1 text-zinc-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors"
                            title="Kick listener"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. INVITES TAB */}
            {activeTab === 'invites' && (
              <div className="space-y-4">
                {/* Invite Code Card */}
                {pod.inviteCode && (
                  <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/80 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-cyan-500" />
                      <span>{isArabic ? 'كود الدخول المباشر للحجرة' : 'Pod Invite Code'}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2">
                      <span className="font-mono text-sm font-black tracking-widest text-cyan-600 dark:text-cyan-400">
                        {pod.inviteCode}
                      </span>
                      <button
                        type="button"
                        onClick={copyInviteCode}
                        className="text-xs font-bold text-zinc-500 hover:text-cyan-500 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        {copiedCode ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedCode ? (isArabic ? 'تم النسخ' : 'Copied') : (isArabic ? 'نسخ' : 'Copy')}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Direct Share Link */}
                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/80 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <LinkIcon className="w-4 h-4 text-cyan-500" />
                    <span>{isArabic ? 'رابط مشاركة الحجرة' : 'Shareable Pod Link'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className="w-full py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-cyan-500/50 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    {copiedLink ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-cyan-500" />
                    )}
                    <span>
                      {copiedLink
                        ? isArabic
                          ? 'تم نسخ الرابط للحافظة! 📋'
                          : 'Link copied to clipboard! 📋'
                        : isArabic
                        ? 'نسخ رابط الحجرة ومشاركته'
                        : 'Copy Shareable Link'}
                    </span>
                  </button>
                </div>

                {/* Direct User Invitation Form */}
                <form onSubmit={handleSendInvite} className="p-3.5 bg-zinc-50 dark:bg-zinc-950/80 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                  <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Send className="w-4 h-4 text-cyan-500" />
                    <span>{isArabic ? 'إرسال دعوة مباشرة لمستخدم' : 'Invite User Directly'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={isArabic ? 'أدخل معرف المستخدم (User ID)...' : 'Enter User ID (Guid)...'}
                      value={inviteTargetUserId}
                      onChange={(e) => setInviteTargetUserId(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isInviting || !inviteTargetUserId.trim()}
                      className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      {isInviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>{isArabic ? 'إرسال' : 'Invite'}</span>
                    </button>
                  </div>
                  {inviteSuccessMsg && (
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
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
