import React, { useState, useEffect, useRef } from 'react';
import {
  Music2,
  UploadCloud,
  Trash2,
  Play,
  Pause,
  Edit2,
  Check,
  X,
  Search,
  ShieldCheck,
  Radio,
  HardDrive,
  Loader2,
  Plus,
} from 'lucide-react';
import { apiClient, getMediaUrl } from '../../services/apiClient';
import { UserMusicTrackDto } from '../../types/api';
import { useThemeStore } from '../../stores/useThemeStore';
import { useDjRadioStore } from '../../stores/useDjRadioStore';
import { CopyrightAgreementModal } from './CopyrightAgreementModal';

export const UserMusicLibraryView: React.FC = () => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';
  const { setActiveModalTab } = useDjRadioStore();

  const [tracks, setTracks] = useState<UserMusicTrackDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio Preview State
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Rename Track State
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete Track State
  const [deletingTrackId, setDeletingTrackId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Upload New Track State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingCloudTracks, setPendingCloudTracks] = useState<
    Array<{ file: File; title: string; artist?: string; durationSeconds?: number }>
  >([]);
  const [isCopyrightModalOpen, setIsCopyrightModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<
    { current: number; total: number; trackTitle: string } | undefined
  >(undefined);

  const loadTracks = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await apiClient.getMyMusicTracks();
      setTracks(data || []);
    } catch (err: any) {
      setErrorMessage(err.message || (isArabic ? 'فشل تحميل مكتبة المسارات' : 'Failed to load tracks library'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTracks();
  }, []);

  // Handle Audio Preview
  const handleTogglePreview = (track: UserMusicTrackDto) => {
    if (previewTrackId === track.id) {
      if (isPreviewPlaying) {
        audioPreviewRef.current?.pause();
        setIsPreviewPlaying(false);
      } else {
        audioPreviewRef.current?.play();
        setIsPreviewPlaying(true);
      }
    } else {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      const audio = new Audio(getMediaUrl(track.mediaUrl));
      audioPreviewRef.current = audio;
      setPreviewTrackId(track.id);
      setIsPreviewPlaying(true);

      audio.play().catch(() => {
        setIsPreviewPlaying(false);
      });

      audio.onended = () => {
        setIsPreviewPlaying(false);
        setPreviewTrackId(null);
      };
    }
  };

  useEffect(() => {
    return () => {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current = null;
      }
    };
  }, []);

  // Handle File Input Change
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const mapped = files.map((file) => ({
      file,
      title: file.name.replace(/\.[^/.]+$/, ''),
      artist: 'My Audio Track',
      durationSeconds: 180,
    }));
    setPendingCloudTracks(mapped);
    setIsCopyrightModalOpen(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Execute Upload after copyright attestation
  const handleConfirmUpload = async () => {
    if (pendingCloudTracks.length === 0) return;

    setIsUploading(true);
    setErrorMessage(null);

    let successCount = 0;
    try {
      for (let i = 0; i < pendingCloudTracks.length; i++) {
        const item = pendingCloudTracks[i];
        setUploadProgress({
          current: i + 1,
          total: pendingCloudTracks.length,
          trackTitle: item.title,
        });

        await apiClient.uploadMusicTrack(item.file, item.file.name, {
          title: item.title,
          artist: item.artist || 'My Audio Track',
          acceptCopyrightPolicy: true,
          durationSeconds: item.durationSeconds || 180,
          policyVersion: '1.0',
        });

        successCount++;
      }

      await loadTracks();
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          (isArabic
            ? `حدث خطأ أثناء رفع المقاطع (${successCount}/${pendingCloudTracks.length} تم رفعها بنجاح)`
            : `Upload failed (${successCount}/${pendingCloudTracks.length} succeeded)`)
      );
    } finally {
      setIsUploading(false);
      setPendingCloudTracks([]);
      setUploadProgress(undefined);
      setIsCopyrightModalOpen(false);
    }
  };

  // Start Inline Edit
  const handleStartEdit = (track: UserMusicTrackDto) => {
    setEditingTrackId(track.id);
    setEditTitle(track.trackTitle);
    setEditArtist(track.trackArtist);
  };

  // Save Inline Edit
  const handleSaveEdit = async () => {
    if (!editingTrackId) return;
    setIsSavingEdit(true);
    try {
      await apiClient.updateMyMusicTrack(editingTrackId, {
        title: editTitle.trim() || undefined,
        artist: editArtist.trim() || undefined,
      });

      setTracks((prev) =>
        prev.map((t) =>
          t.id === editingTrackId
            ? {
                ...t,
                trackTitle: editTitle.trim() || t.trackTitle,
                trackArtist: editArtist.trim() || t.trackArtist,
              }
            : t
        )
      );
      setEditingTrackId(null);
    } catch (err: any) {
      setErrorMessage(err.message || (isArabic ? 'فشل تحديث بيانات المسار' : 'Failed to update track metadata'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Confirm Delete Track
  const handleConfirmDelete = async () => {
    if (!deletingTrackId) return;
    setIsDeleting(true);
    try {
      await apiClient.deleteMyMusicTrack(deletingTrackId);
      if (previewTrackId === deletingTrackId) {
        audioPreviewRef.current?.pause();
        setPreviewTrackId(null);
        setIsPreviewPlaying(false);
      }
      setTracks((prev) => prev.filter((t) => t.id !== deletingTrackId));
      setDeletingTrackId(null);
    } catch (err: any) {
      setErrorMessage(err.message || (isArabic ? 'فشل حذف المقطع الصوتي' : 'Failed to delete audio track'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Format Helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredTracks = tracks.filter((t) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      t.trackTitle.toLowerCase().includes(query) ||
      t.trackArtist.toLowerCase().includes(query)
    );
  });

  const totalBytes = tracks.reduce((acc, t) => acc + (t.fileSizeBytes || 0), 0);

  return (
    <div className="space-y-4">
      {/* Hidden File Input */}
      <input
        type="file"
        multiple
        accept="audio/*"
        ref={fileInputRef}
        onChange={handleFilesSelected}
        className="hidden"
      />

      {/* Header Banner & Stats */}
      <div className="bg-gradient-to-r from-slate-900/90 via-fuchsia-950/40 to-indigo-950/40 border border-fuchsia-500/20 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-fuchsia-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-fuchsia-500/30">
            <Music2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>{isArabic ? 'مكتبتي الموسيقية' : 'My Music Library'}</span>
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>DMCA Safe</span>
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isArabic
                ? 'إدارة مقاطعك الصوتية المرفوعة، الاستماع إليها، أو إضافتها لمحطات الراديو'
                : 'Manage your audio tracks, preview them, or add to radio stations'}
            </p>
          </div>
        </div>

        {/* Stats & Upload Button */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="text-right sm:text-left text-xs text-slate-300 bg-slate-800/60 border border-slate-700/60 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <HardDrive className="w-3.5 h-3.5 text-fuchsia-400" />
            <span>{tracks.length} {isArabic ? 'مقطع' : 'tracks'}</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400 text-[11px]">{formatBytes(totalBytes)}</span>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-fuchsia-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{uploadProgress ? `${uploadProgress.current}/${uploadProgress.total}` : '...'}</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>{isArabic ? 'رفع مقطع جديد' : 'Upload Track'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={isArabic ? 'ابحث عن مسار أو فنان...' : 'Search by track title or artist...'}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tracks List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500 mb-2" />
          <p className="text-xs">{isArabic ? 'جاري تحميل مقاطعك الصوتية...' : 'Loading your audio library...'}</p>
        </div>
      ) : filteredTracks.length === 0 ? (
        <div className="border border-dashed border-slate-800 bg-slate-900/30 rounded-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center text-fuchsia-400 mx-auto mb-3">
            <UploadCloud className="w-7 h-7" />
          </div>
          <h4 className="text-sm font-bold text-white">
            {tracks.length === 0
              ? isArabic
                ? 'لا توجد مقاطع صوتية مرفوعة بعد'
                : 'No uploaded tracks yet'
              : isArabic
              ? 'لا توجد نتائج مطابقة لبحثك'
              : 'No tracks match your search'}
          </h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {tracks.length === 0
              ? isArabic
                ? 'ارفع مقطوعاتك الموسيقية لتخزينها على السيرفر واستخدامها بسهولة في محطات الراديو مع ضمان حقوق الملكية الفكرية.'
                : 'Upload music tracks to store them permanently and easily pick them when creating radio stations.'
              : isArabic
              ? 'جرب البحث بكلمات أخرى'
              : 'Try searching with a different title or artist name.'}
          </p>
          {tracks.length === 0 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 px-4 py-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold transition-all shadow-md shadow-fuchsia-600/30 inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isArabic ? 'رفع أول مقطع الآن' : 'Upload First Track Now'}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTracks.map((track) => {
            const isPlayingThis = previewTrackId === track.id && isPreviewPlaying;
            const isEditingThis = editingTrackId === track.id;

            return (
              <div
                key={track.id}
                className={`group border rounded-xl p-3 sm:p-3.5 transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  isPlayingThis
                    ? 'border-fuchsia-500/60 bg-gradient-to-r from-fuchsia-950/40 via-slate-900/70 to-slate-900/60 shadow-lg shadow-fuchsia-500/5'
                    : 'border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/70 hover:border-slate-700'
                }`}
              >
                {/* Left: Play Button & Info */}
                <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
                  {/* Play / Pause Preview Button */}
                  <button
                    onClick={() => handleTogglePreview(track)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
                      isPlayingThis
                        ? 'bg-fuchsia-500 text-white shadow-md shadow-fuchsia-500/40 scale-105'
                        : 'bg-slate-800 text-slate-300 hover:bg-fuchsia-600 hover:text-white'
                    }`}
                    title={isPlayingThis ? 'Pause Preview' : 'Play Preview'}
                  >
                    {isPlayingThis ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>

                  {/* Track Details or Inline Edit */}
                  {isEditingThis ? (
                    <div className="flex-1 flex flex-col sm:flex-row gap-2 min-w-0">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Title"
                        className="px-2.5 py-1 bg-slate-800 border border-fuchsia-500 rounded-lg text-xs text-white focus:outline-none"
                      />
                      <input
                        type="text"
                        value={editArtist}
                        onChange={(e) => setEditArtist(e.target.value)}
                        placeholder="Artist"
                        className="px-2.5 py-1 bg-slate-800 border border-fuchsia-500 rounded-lg text-xs text-white focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-white truncate group-hover:text-fuchsia-300 transition-colors">
                        {track.trackTitle}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="truncate">{track.trackArtist}</span>
                        <span>•</span>
                        <span>{formatDuration(track.durationSeconds || 180)}</span>
                        <span>•</span>
                        <span>{formatBytes(track.fileSizeBytes)}</span>
                        <span>•</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(track.attestedAtUtc).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end flex-shrink-0">
                  {isEditingThis ? (
                    <>
                      <button
                        onClick={handleSaveEdit}
                        disabled={isSavingEdit}
                        className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="Save Changes"
                      >
                        {isSavingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => setEditingTrackId(null)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Create Station with this track */}
                      <button
                        onClick={() => setActiveModalTab('create')}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-fuchsia-600/30 border border-slate-700/60 hover:border-fuchsia-500/40 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        title={isArabic ? 'إنشاء محطة بهذا المقطع' : 'Create Station with this track'}
                      >
                        <Radio className="w-3 h-3 text-fuchsia-400" />
                        <span className="hidden sm:inline">{isArabic ? 'محطة' : 'Station'}</span>
                      </button>

                      {/* Rename */}
                      <button
                        onClick={() => handleStartEdit(track)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                        title={isArabic ? 'تعديل البيانات' : 'Rename'}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setDeletingTrackId(track.id)}
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title={isArabic ? 'حذف المقطع' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTrackId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {isArabic ? 'حذف المقطع الصوتي' : 'Delete Audio Track'}
                </h4>
                <p className="text-xs text-slate-400">
                  {isArabic
                    ? 'هل أنت متأكد من حذف هذا المقطع من مكتبتك السحابية؟'
                    : 'Are you sure you want to delete this track from your cloud library?'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-[11px] text-slate-400">
              {isArabic
                ? 'سيتم حذف الملف الصوتي نهائياً من خوادم الاستضافة، ولن تتمكن من بثه في المحطات المستقبلية.'
                : 'The audio file will be permanently removed from storage and will no longer be available for broadcasting.'}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingTrackId(null)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                {isArabic ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md shadow-red-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isArabic ? 'تأكيد الحذف' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copyright Agreement Modal before Upload */}
      <CopyrightAgreementModal
        isOpen={isCopyrightModalOpen}
        onClose={() => {
          if (!isUploading) {
            setIsCopyrightModalOpen(false);
            setPendingCloudTracks([]);
          }
        }}
        onConfirmUpload={handleConfirmUpload}
        pendingTracks={pendingCloudTracks}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
      />
    </div>
  );
};
