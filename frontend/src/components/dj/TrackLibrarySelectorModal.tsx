import React, { useState, useEffect, useRef } from 'react';
import {
  Music2,
  Search,
  Check,
  Play,
  Pause,
  ShieldCheck,
  X,
  Plus,
  Loader2,
  CheckSquare,
  Square,
  UploadCloud,
} from 'lucide-react';
import { apiClient, getMediaUrl } from '../../services/apiClient';
import { UserMusicTrackDto, DjTrackDto } from '../../types/api';
import { useThemeStore } from '../../stores/useThemeStore';

export interface TrackLibrarySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTracks: (tracks: DjTrackDto[]) => void;
  onOpenUpload: () => void;
  alreadySelectedUrls?: string[];
}

export const TrackLibrarySelectorModal: React.FC<TrackLibrarySelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectTracks,
  onOpenUpload,
  alreadySelectedUrls = [],
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  const [tracks, setTracks] = useState<UserMusicTrackDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());

  // Preview Audio
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedTrackIds(new Set());
      loadTracks();
    } else {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current = null;
      }
      setPreviewTrackId(null);
      setIsPreviewPlaying(false);
    }
  }, [isOpen]);

  const loadTracks = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getMyMusicTracks();
      setTracks(data || []);
    } catch {
      setTracks([]);
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedTrackIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedTrackIds(next);
  };

  const handleSelectAll = () => {
    if (selectedTrackIds.size === filteredTracks.length) {
      setSelectedTrackIds(new Set());
    } else {
      setSelectedTrackIds(new Set(filteredTracks.map((t) => t.id)));
    }
  };

  const handleConfirmSelection = () => {
    const chosenTracks = tracks
      .filter((t) => selectedTrackIds.has(t.id))
      .map(
        (t): DjTrackDto => ({
          id: `track_cloud_${t.id.replace(/-/g, '')}`,
          title: t.trackTitle,
          artist: t.trackArtist,
          url: t.mediaUrl,
          durationSeconds: t.durationSeconds || 180,
          isServerHosted: true,
          attestationId: t.id,
        })
      );

    onSelectTracks(chosenTracks);
    onClose();
  };

  const filteredTracks = tracks.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      t.trackTitle.toLowerCase().includes(q) ||
      t.trackArtist.toLowerCase().includes(q)
    );
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-fuchsia-500/30 rounded-3xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl shadow-fuchsia-500/10 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400">
              <Music2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>{isArabic ? 'اختر من مكتبتك الموسيقية' : 'Select from Music Library'}</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  <span>Licensed</span>
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {isArabic
                  ? 'المقاطع المرفوعة سابقاً والمقر بملكيتها الفكرية'
                  : 'Your attested tracks ready to broadcast'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Controls & Search */}
        <div className="p-3 sm:p-4 border-b border-slate-800/80 bg-slate-950/40 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isArabic ? 'ابحث عن مسار...' : 'Search your tracks...'}
                className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500"
              />
            </div>

            <button
              onClick={() => {
                onClose();
                onOpenUpload();
              }}
              className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>{isArabic ? 'رفع جديد' : 'Upload New'}</span>
            </button>
          </div>

          {filteredTracks.length > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-1.5 text-fuchsia-400 hover:text-fuchsia-300 cursor-pointer font-medium"
              >
                {selectedTrackIds.size === filteredTracks.length ? (
                  <CheckSquare className="w-3.5 h-3.5" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
                <span>
                  {selectedTrackIds.size === filteredTracks.length
                    ? isArabic
                      ? 'إلغاء تحديد الكل'
                      : 'Deselect All'
                    : isArabic
                    ? 'تحديد الكل'
                    : 'Select All'}
                </span>
              </button>

              <span>
                {selectedTrackIds.size} / {filteredTracks.length}{' '}
                {isArabic ? 'تم اختيارها' : 'selected'}
              </span>
            </div>
          )}
        </div>

        {/* Tracks List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 max-h-80 min-h-[160px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-fuchsia-500 mb-2" />
              <p className="text-xs">{isArabic ? 'جاري التحميل...' : 'Loading tracks...'}</p>
            </div>
          ) : filteredTracks.length === 0 ? (
            <div className="py-8 text-center text-slate-400 space-y-2">
              <Music2 className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs">
                {tracks.length === 0
                  ? isArabic
                    ? 'لا توجد مقاطع في مكتبتك السحابية حتى الآن.'
                    : 'No tracks uploaded in your cloud library yet.'
                  : isArabic
                  ? 'لا توجد نتائج تطابق بحثك.'
                  : 'No tracks match your search.'}
              </p>
              <button
                onClick={() => {
                  onClose();
                  onOpenUpload();
                }}
                className="text-xs text-amber-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>{isArabic ? 'رفع مقطع جديد الآن' : 'Upload a new track now'}</span>
              </button>
            </div>
          ) : (
            filteredTracks.map((track) => {
              const isSelected = selectedTrackIds.has(track.id);
              const isAlreadyInStation = alreadySelectedUrls.includes(track.mediaUrl);
              const isPlayingThis = previewTrackId === track.id && isPreviewPlaying;

              return (
                <div
                  key={track.id}
                  onClick={() => !isAlreadyInStation && handleToggleSelect(track.id)}
                  className={`border rounded-xl p-2.5 transition-all flex items-center justify-between gap-3 cursor-pointer ${
                    isAlreadyInStation
                      ? 'border-slate-800/60 bg-slate-900/30 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'border-fuchsia-500 bg-fuchsia-950/30 shadow-md shadow-fuchsia-500/10'
                      : 'border-slate-800 bg-slate-900/50 hover:bg-slate-900/80 hover:border-slate-700'
                  }`}
                >
                  {/* Left: Checkbox + Play + Info */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Checkbox */}
                    <div
                      className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors flex-shrink-0 ${
                        isSelected
                          ? 'bg-fuchsia-600 border-fuchsia-500 text-white'
                          : isAlreadyInStation
                          ? 'bg-slate-800 border-slate-700 text-slate-500'
                          : 'border-slate-600'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>

                    {/* Preview Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePreview(track);
                      }}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${
                        isPlayingThis
                          ? 'bg-fuchsia-500 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-fuchsia-600 hover:text-white'
                      }`}
                    >
                      {isPlayingThis ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
                    </button>

                    {/* Title & Artist */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate">
                          {track.trackTitle}
                        </span>
                        {isAlreadyInStation && (
                          <span className="text-[9px] bg-slate-800 text-slate-400 px-1 py-0.2 rounded">
                            {isArabic ? 'مضاف بالفعل' : 'In station'}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {track.trackArtist} • {formatDuration(track.durationSeconds || 180)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            {isArabic ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={handleConfirmSelection}
            disabled={selectedTrackIds.size === 0}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-fuchsia-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className="w-3.5 h-3.5" />
            <span>
              {isArabic
                ? `إضافة المقاطع المحددة (${selectedTrackIds.size})`
                : `Add Selected (${selectedTrackIds.size})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
