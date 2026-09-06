import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Radio,
  Music,
  Plus,
  Trash2,
  Play,
  Upload,
  Search,
  Disc3,
  Users,
  Globe,
  Lock,
  Sparkles,
  Loader2,
  Check,
} from 'lucide-react';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { api, getMediaUrl } from '../../services/apiClient';
import { DjListDto, DjTrackDto, CreateDjListDto } from '../../types/api';

interface DjListsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStreamList?: (djList: DjListDto) => void;
  activePodId?: string;
}

const GENRES = ['All', 'Chill', 'Lofi', 'Synthwave', 'Ambient', 'Electronic', 'Acoustic', 'HipHop'];

export const DjListsModal: React.FC<DjListsModalProps> = ({
  isOpen,
  onClose,
  onStreamList,
  activePodId,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';
  const { currentPersona } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'browse' | 'my' | 'create'>('browse');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [lists, setLists] = useState<DjListDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreamingId, setIsStreamingId] = useState<string | null>(null);

  // Form state for creating a new DJ list
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newGenre, setNewGenre] = useState('Chill');
  const [isPublic, setIsPublic] = useState(true);
  const [followersOnly, setFollowersOnly] = useState(false);
  const [tracks, setTracks] = useState<DjTrackDto[]>([]);
  const [isUploadingTrack, setIsUploadingTrack] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);

  // New track form inputs
  const [trackTitle, setTrackTitle] = useState('');
  const [trackArtist, setTrackArtist] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchLists = async () => {
    setIsLoading(true);
    try {
      const genre = selectedGenre === 'All' ? undefined : selectedGenre;
      const targetUserId = activeTab === 'my' ? currentPersona.id : undefined;
      const data = await api.getDjLists(genre, targetUserId);
      setLists(data || []);
    } catch (err) {
      console.error('Failed to load DJ lists:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === 'browse' || activeTab === 'my') {
      fetchLists();
    }
  }, [isOpen, activeTab, selectedGenre]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingTrack(true);
    try {
      const res = await api.uploadMedia(file, file.name);
      const title = trackTitle.trim() || file.name.replace(/\.[^/.]+$/, '');
      const artist = trackArtist.trim() || currentPersona.displayName || 'DJ';

      const newTrack: DjTrackDto = {
        id: crypto.randomUUID ? crypto.randomUUID() : `track-${Date.now()}`,
        title,
        artist,
        url: res.url,
        durationSeconds: 180,
      };

      setTracks((prev) => [...prev, newTrack]);
      setTrackTitle('');
      setTrackArtist('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Track upload failed:', err);
      alert(isArabic ? 'فشل رفع الملف الصوتي' : 'Audio upload failed');
    } finally {
      setIsUploadingTrack(false);
    }
  };

  const handleRemoveTrack = (index: number) => {
    setTracks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateList = async () => {
    if (!newTitle.trim()) {
      alert(isArabic ? 'يرجى كتابة عنوان القائمة' : 'Please enter a list title');
      return;
    }
    if (tracks.length === 0) {
      alert(isArabic ? 'يرجى إضافة مقطع صوتي واحد على الأقل' : 'Please add at least one track');
      return;
    }

    setIsCreating(true);
    try {
      const payload: CreateDjListDto = {
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        genre: newGenre,
        isPublic,
        followersOnly,
        tracks,
      };

      await api.createDjList(payload);
      setCreateSuccess(true);
      setTimeout(() => {
        setCreateSuccess(false);
        setActiveTab('my');
        // Reset form
        setNewTitle('');
        setNewDesc('');
        setTracks([]);
      }, 800);
    } catch (err) {
      console.error('Failed to create DJ list:', err);
      alert(isArabic ? 'فشل إنشاء قائمة الـ DJ' : 'Failed to create DJ list');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteList = async (id: string) => {
    if (!confirm(isArabic ? 'هل أنت متأكد من حذف هذه القائمة؟' : 'Delete this DJ list?')) return;
    try {
      await api.deleteDjList(id);
      setLists((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Failed to delete list:', err);
    }
  };

  const handleStream = async (djList: DjListDto) => {
    setIsStreamingId(djList.id);
    try {
      if (onStreamList) {
        onStreamList(djList);
      } else {
        await api.streamDjList(djList.id, {
          podId: activePodId,
          followersOnly: djList.followersOnly,
        });
        alert(
          isArabic
            ? 'تم بدء بث قائمة الـ DJ بنجاح! 🎧'
            : 'DJ List broadcast started successfully! 🎧'
        );
      }
      onClose();
    } catch (err) {
      console.error('Failed to stream DJ list:', err);
      alert(isArabic ? 'فشل بدء البث' : 'Failed to stream DJ list');
    } finally {
      setIsStreamingId(null);
    }
  };

  const filteredLists = lists.filter((l) => {
    const matchesSearch =
      l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.userDisplayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.genre.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

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
          className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl text-zinc-900 dark:text-white space-y-5 relative z-10 max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-fuchsia-600 to-pink-600 p-0.5 flex items-center justify-center shadow-lg shadow-fuchsia-500/20">
                <div className="w-full h-full bg-white dark:bg-zinc-950 rounded-[14px] flex items-center justify-center">
                  <Radio className="w-5 h-5 text-fuchsia-500" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
                  {isArabic ? 'استوديو وقوائم الـ DJ 🎧' : 'DJ Studio & Broadcast Hub 🎧'}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {isArabic
                    ? 'استمع إلى مقاطع وبثوث المستخدمين أو شارك موسيقاك مع متابعيك'
                    : 'Discover user-curated DJ playlists or broadcast local music'}
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

          {/* Tabs */}
          <div className="flex items-center gap-2 p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('browse')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'browse'
                  ? 'bg-white dark:bg-zinc-900 text-fuchsia-600 dark:text-fuchsia-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{isArabic ? 'استكشاف القوائم' : 'Explore DJ Lists'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('my')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'my'
                  ? 'bg-white dark:bg-zinc-900 text-fuchsia-600 dark:text-fuchsia-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>{isArabic ? 'قوائمي' : 'My Lists'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-white dark:bg-zinc-900 text-fuchsia-600 dark:text-fuchsia-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isArabic ? 'إنشاء قائمة جديدة' : 'Create New List'}</span>
            </button>
          </div>

          {/* Tab 1 & 2: Browse / My Lists */}
          {(activeTab === 'browse' || activeTab === 'my') && (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Search & Genre Filter */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder={isArabic ? 'البحث عن قائمة أو صانع محتوى...' : 'Search lists or creators...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-100 dark:bg-zinc-800/60 rounded-xl border border-transparent focus:border-fuchsia-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  {GENRES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setSelectedGenre(g)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                        selectedGenre === g
                          ? 'bg-fuchsia-500 text-white shadow-sm'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lists Grid */}
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-400 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-fuchsia-500" />
                  <span className="text-xs">{isArabic ? 'جارٍ تحميل القوائم...' : 'Loading DJ lists...'}</span>
                </div>
              ) : filteredLists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-400 space-y-3">
                  <Disc3 className="w-12 h-12 text-zinc-300 dark:text-zinc-700" />
                  <div className="text-sm font-bold text-zinc-600 dark:text-zinc-400">
                    {isArabic ? 'لا توجد قوائم تطابق البحث' : 'No DJ lists found'}
                  </div>
                  <p className="text-xs text-zinc-500 max-w-xs">
                    {activeTab === 'my'
                      ? isArabic
                        ? 'لم تنشئ أي قائمة DJ بعد. ابدأ بإنشاء قائمة جديدة وشاركها!'
                        : "You haven't created any DJ lists yet. Create one now!"
                      : isArabic
                        ? 'كن أول من ينشئ قائمة DJ ويبثها للمجتمع!'
                        : 'Be the first to create and broadcast a DJ list!'}
                  </p>
                  {activeTab === 'my' && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('create')}
                      className="px-4 py-2 text-xs font-bold bg-fuchsia-600 text-white rounded-xl shadow cursor-pointer"
                    >
                      {isArabic ? 'إنشاء قائمة الآن' : 'Create List Now'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredLists.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between space-y-3 group hover:border-fuchsia-500/50 transition-all"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                              {item.title}
                            </h4>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                              {item.description || (isArabic ? 'مجموعة مقاطع صوتية منتقاة' : 'Curated sound tracks')}
                            </p>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-300 shrink-0">
                            {item.genre}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                          <img
                            src={
                              item.userAvatarUrl ||
                              `https://api.dicebear.com/7.x/bottts/svg?seed=${item.username}`
                            }
                            alt={item.userDisplayName}
                            className="w-4 h-4 rounded-full"
                          />
                          <span className="truncate">{item.userDisplayName}</span>
                          <span>•</span>
                          <span>{item.trackCount} {isArabic ? 'مقاطع' : 'tracks'}</span>
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                          {item.followersOnly ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {isArabic ? 'للمتابعين فقط' : 'Followers Only'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              {isArabic ? 'عام للجميع' : 'Public Access'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60">
                        {item.userId === currentPersona.id && (
                          <button
                            type="button"
                            onClick={() => handleDeleteList(item.id)}
                            className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                            title={isArabic ? 'حذف القائمة' : 'Delete list'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={isStreamingId === item.id}
                          onClick={() => handleStream(item)}
                          className="ml-auto px-3.5 py-1.5 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-fuchsia-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isStreamingId === item.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3 fill-white" />
                          )}
                          <span>{isArabic ? 'بث القائمة الآن' : 'Broadcast Live'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Create New DJ List */}
          {activeTab === 'create' && (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {isArabic ? 'عنوان القائمة' : 'List Title'} *
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={isArabic ? 'مثال: نغمات استرخاء منتصف الليل 🌃' : 'e.g. Midnight Beats 🌃'}
                    className="w-full px-3.5 py-2 text-xs bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:border-fuchsia-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {isArabic ? 'الوصف' : 'Description'}
                  </label>
                  <textarea
                    rows={2}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder={isArabic ? 'وصف مختصر لأجواء ومقاطع هذه القائمة...' : 'Brief description of the vibes...'}
                    className="w-full px-3.5 py-2 text-xs bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:border-fuchsia-500 focus:outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      {isArabic ? 'النوع / التصنيف' : 'Genre'}
                    </label>
                    <select
                      value={newGenre}
                      onChange={(e) => setNewGenre(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-800 focus:border-fuchsia-500 focus:outline-none cursor-pointer"
                    >
                      {GENRES.filter((g) => g !== 'All').map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Access Mode */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      {isArabic ? 'نطاق الوصول' : 'Access Mode'}
                    </label>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsPublic(true);
                          setFollowersOnly(false);
                        }}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          !followersOnly
                            ? 'border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300'
                            : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'
                        }`}
                      >
                        {isArabic ? 'عام للجميع' : 'Public'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsPublic(false);
                          setFollowersOnly(true);
                        }}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          followersOnly
                            ? 'border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300'
                            : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'
                        }`}
                      >
                        {isArabic ? 'للمتابعين فقط' : 'Followers Only'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Track Upload Section */}
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-fuchsia-500" />
                      {isArabic ? 'رفع مقاطع من جهازك' : 'Upload Local Audio Tracks'}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {tracks.length} {isArabic ? 'مقاطع مضافة' : 'tracks added'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder={isArabic ? 'اسم المقطع (اختياري)' : 'Track title (optional)'}
                      value={trackTitle}
                      onChange={(e) => setTrackTitle(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder={isArabic ? 'اسم الفنان / العازف' : 'Artist / Performer'}
                      value={trackArtist}
                      onChange={(e) => setTrackArtist(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 focus:outline-none"
                    />
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  <button
                    type="button"
                    disabled={isUploadingTrack}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 px-3 border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-fuchsia-500 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-fuchsia-600 dark:hover:text-fuchsia-300 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isUploadingTrack ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-fuchsia-500" />
                        <span>{isArabic ? 'جارٍ رفع المقطع الصوتي...' : 'Uploading audio file...'}</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>{isArabic ? 'اختر ملفاً صوتياً من جهازك (.mp3, .wav, .m4a)' : 'Choose audio file from device (.mp3, .wav, .m4a)'}</span>
                      </>
                    )}
                  </button>

                  {/* List of uploaded tracks */}
                  {tracks.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      {tracks.map((t, idx) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Music className="w-3.5 h-3.5 text-fuchsia-500 shrink-0" />
                            <span className="font-bold truncate">{t.title}</span>
                            <span className="text-zinc-400 text-[10px] truncate">({t.artist})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveTrack(idx)}
                            className="p-1 text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={isCreating || tracks.length === 0}
                  onClick={handleCreateList}
                  className="px-6 py-2.5 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-fuchsia-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isArabic ? 'جارٍ حفظ القائمة...' : 'Saving DJ List...'}</span>
                    </>
                  ) : createSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>{isArabic ? 'تم الحفظ بنجاح!' : 'Saved Successfully!'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{isArabic ? 'إنشاء وبدء القائمة' : 'Create & Save DJ List'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

