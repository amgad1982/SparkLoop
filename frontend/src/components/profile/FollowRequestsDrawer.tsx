import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api, getMediaUrl } from '../../services/apiClient';
import { useThemeStore } from '../../stores/useThemeStore';
import { UserFollowDto } from '../../types/api';
import { Tooltip } from '../ui/Tooltip';
import { X, UserPlus, Check, Trash2, Loader2, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FollowRequestsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestHandled?: () => void;
}

export const FollowRequestsDrawer: React.FC<FollowRequestsDrawerProps> = ({
  isOpen,
  onClose,
  onRequestHandled,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  const [requests, setRequests] = useState<UserFollowDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await api.getPendingFollowRequests();
      setRequests(data);
    } catch (err) {
      console.error('Failed to load pending follow requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRequests();
    }
  }, [isOpen]);

  const handleAccept = async (requestId: string) => {
    setActionLoadingId(requestId);
    try {
      await api.acceptFollowRequest(requestId);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      onRequestHandled?.();
    } catch (err) {
      console.error('Accept follow error:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDecline = async (requestId: string) => {
    setActionLoadingId(requestId);
    try {
      await api.declineFollowRequest(requestId);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      onRequestHandled?.();
    } catch (err) {
      console.error('Decline follow error:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-white dark:bg-[#131b28] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {isArabic ? 'طلبات المتابعة المعلقة' : 'Pending Follow Requests'}
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {requests.length} {isArabic ? 'طلب قيد الانتظار' : 'pending requests'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-xs">{isArabic ? 'جاري جلب الطلبات...' : 'Loading requests...'}</span>
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-16 text-slate-400 space-y-2">
                <UserPlus className="w-9 h-9 mx-auto opacity-30" />
                <p className="text-xs font-semibold">
                  {isArabic ? 'لا توجد طلبات متابعة جديدة حالياً.' : 'No pending follow requests at the moment.'}
                </p>
              </div>
            ) : (
              requests.map((req) => {
                const isActionLoading = actionLoadingId === req.id;
                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0b0f17] border border-slate-200/80 dark:border-slate-800/90 shadow-sm gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={
                          getMediaUrl(req.followerAvatarUrl) ||
                          `https://api.dicebear.com/7.x/bottts/svg?seed=${req.followerUsername}`
                        }
                        alt={req.followerUsername}
                        className="w-11 h-11 rounded-2xl bg-slate-200 dark:bg-slate-800 object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {req.followerDisplayName}
                        </h4>
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate block font-medium">
                          @{req.followerUsername}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Accept Button */}
                      <Tooltip content={isArabic ? 'قبول المتابعة' : 'Accept follow'} position="top">
                        <button
                          type="button"
                          disabled={isActionLoading}
                          onClick={() => handleAccept(req.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors active:scale-95 disabled:opacity-50"
                        >
                          {isActionLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>{isArabic ? 'قبول' : 'Accept'}</span>
                        </button>
                      </Tooltip>

                      {/* Decline Button */}
                      <Tooltip content={isArabic ? 'رفض الطلب' : 'Decline request'} position="top">
                        <button
                          type="button"
                          disabled={isActionLoading}
                          onClick={() => handleDecline(req.id)}
                          className="p-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-rose-500/20 hover:text-rose-500 text-slate-600 dark:text-slate-400 rounded-xl transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
