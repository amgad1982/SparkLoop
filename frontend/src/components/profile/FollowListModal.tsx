import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api, getMediaUrl } from '../../services/apiClient';
import { useThemeStore } from '../../stores/useThemeStore';
import { UserFollowDto } from '../../types/api';
import { FollowButton } from '../ui/FollowButton';
import { X, Users, UserCheck, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FollowListModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  type: 'followers' | 'following';
  onSelectUser?: (username: string) => void;
}

export const FollowListModal: React.FC<FollowListModalProps> = ({
  isOpen,
  onClose,
  username,
  type,
  onSelectUser,
}) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  const [users, setUsers] = useState<UserFollowDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const loadUsers = async () => {
      setLoading(true);
      try {
        const data =
          type === 'followers'
            ? await api.getFollowers(username)
            : await api.getFollowing(username);
        setUsers(data);
      } catch (err) {
        console.error('Failed to load user list:', err);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [isOpen, username, type]);

  if (!isOpen) return null;

  const title =
    type === 'followers'
      ? isArabic
        ? `متابعو @${username}`
        : `@${username}'s Followers`
      : isArabic
      ? `الحسابات التي يتابعها @${username}`
      : `Following by @${username}`;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-2xl bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400">
                {type === 'followers' ? (
                  <Users className="w-5 h-5" />
                ) : (
                  <UserCheck className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">{title}</h3>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {users.length} {isArabic ? 'مستخدم' : 'users'}
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

          {/* User List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-fuchsia-500" />
                <span className="text-xs">{isArabic ? 'جاري التحميل...' : 'Loading...'}</span>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 space-y-2">
                <Users className="w-8 h-8 mx-auto opacity-40" />
                <p className="text-xs font-semibold">
                  {type === 'followers'
                    ? isArabic
                      ? 'لا يوجد متابعون حتى الآن.'
                      : 'No followers yet.'
                    : isArabic
                    ? 'لا يتابع أي مستخدم بعد.'
                    : 'Not following anyone yet.'}
                </p>
              </div>
            ) : (
              users.map((follow) => {
                const targetId = type === 'followers' ? follow.followerId : follow.followingId;
                const targetUname = type === 'followers' ? follow.followerUsername : follow.followingUsername;
                const targetDisp = type === 'followers' ? follow.followerDisplayName : follow.followingDisplayName;
                const targetAvatar = type === 'followers' ? follow.followerAvatarUrl : follow.followingAvatarUrl;

                return (
                  <div
                    key={follow.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-100 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
                  >
                    <div
                      onClick={() => {
                        onSelectUser?.(targetUname);
                        onClose();
                      }}
                      className="flex items-center gap-3 cursor-pointer min-w-0"
                    >
                      <img
                        src={getMediaUrl(targetAvatar) || `https://api.dicebear.com/7.x/bottts/svg?seed=${targetUname}`}
                        alt={targetUname}
                        className="w-10 h-10 rounded-2xl bg-zinc-200 dark:bg-zinc-800 object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                          {targetDisp}
                        </h4>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate block">
                          @{targetUname}
                        </span>
                      </div>
                    </div>

                    <FollowButton
                      targetUserId={targetId}
                      targetUsername={targetUname}
                      size="xs"
                    />
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

