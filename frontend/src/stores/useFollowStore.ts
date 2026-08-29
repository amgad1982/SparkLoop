import { create } from 'zustand';
import { api } from '../services/apiClient';
import { FollowStatusType } from '../components/ui/FollowButton';

interface FollowState {
  followStatuses: Record<string, FollowStatusType>;
  pendingRequests: Set<string>;
  loadingUsers: Set<string>;
  setFollowStatus: (key: string, status: FollowStatusType) => void;
  setFollowStatusesBatch: (entries: Record<string, FollowStatusType>) => void;
  fetchFollowStatus: (username: string) => Promise<FollowStatusType>;
  loadMyFollowing: (currentUsername: string) => Promise<void>;
  followUser: (targetUserId: string, targetUsername: string, currentStatus?: FollowStatusType) => Promise<FollowStatusType>;
  unfollowUser: (targetUserId: string, targetUsername: string) => Promise<FollowStatusType>;
  clear: () => void;
}

export const useFollowStore = create<FollowState>((set, get) => ({
  followStatuses: {},
  pendingRequests: new Set<string>(),
  loadingUsers: new Set<string>(),

  setFollowStatus: (key: string, status: FollowStatusType) => {
    const normalizedKey = key.toLowerCase();
    set((state) => ({
      followStatuses: {
        ...state.followStatuses,
        [normalizedKey]: status,
        [key]: status,
      },
    }));
  },

  setFollowStatusesBatch: (entries: Record<string, FollowStatusType>) => {
    set((state) => {
      const updated = { ...state.followStatuses };
      for (const [k, v] of Object.entries(entries)) {
        updated[k.toLowerCase()] = v;
        updated[k] = v;
      }
      return { followStatuses: updated };
    });
  },

  fetchFollowStatus: async (username: string) => {
    const normalized = username.toLowerCase();
    const existing = get().followStatuses[normalized];
    if (existing !== undefined) {
      return existing;
    }

    if (get().loadingUsers.has(normalized)) {
      return 'none';
    }

    set((state) => {
      const nextLoading = new Set(state.loadingUsers);
      nextLoading.add(normalized);
      return { loadingUsers: nextLoading };
    });

    try {
      const res = await api.getFollowStatus(username);
      const status = res.status as FollowStatusType;
      get().setFollowStatus(normalized, status);
      return status;
    } catch {
      return 'none';
    } finally {
      set((state) => {
        const nextLoading = new Set(state.loadingUsers);
        nextLoading.delete(normalized);
        return { loadingUsers: nextLoading };
      });
    }
  },

  loadMyFollowing: async (currentUsername: string) => {
    if (!currentUsername || currentUsername === 'guest') return;
    try {
      const followingList = await api.getFollowing(currentUsername);
      const batch: Record<string, FollowStatusType> = {};
      for (const f of followingList) {
        const status: FollowStatusType = f.status === 'accepted' ? 'following' : 'pending_outgoing';
        batch[f.followingId] = status;
        batch[f.followingUsername.toLowerCase()] = status;
      }
      get().setFollowStatusesBatch(batch);
    } catch (err) {
      console.warn('Could not load following list:', err);
    }
  },

  followUser: async (targetUserId: string, targetUsername: string, currentStatus = 'none') => {
    const normalizedUsername = targetUsername.toLowerCase();
    const optimisticStatus: FollowStatusType = currentStatus === 'follow_back' ? 'mutual' : 'following';

    // 1. Optimistic Update across all instances
    get().setFollowStatus(normalizedUsername, optimisticStatus);
    get().setFollowStatus(targetUserId, optimisticStatus);

    try {
      const res = await api.followUser(targetUserId);
      const finalStatus: FollowStatusType =
        res.status === 'pending'
          ? 'pending_outgoing'
          : currentStatus === 'follow_back'
          ? 'mutual'
          : 'following';

      get().setFollowStatus(normalizedUsername, finalStatus);
      get().setFollowStatus(targetUserId, finalStatus);
      return finalStatus;
    } catch (err) {
      console.error('Failed to follow user:', err);
      // Revert on error
      get().setFollowStatus(normalizedUsername, currentStatus);
      get().setFollowStatus(targetUserId, currentStatus);
      throw err;
    }
  },

  unfollowUser: async (targetUserId: string, targetUsername: string) => {
    const normalizedUsername = targetUsername.toLowerCase();
    const prevStatus = get().followStatuses[normalizedUsername] || 'following';

    // 1. Optimistic Update to 'none'
    get().setFollowStatus(normalizedUsername, 'none');
    get().setFollowStatus(targetUserId, 'none');

    try {
      await api.unfollowUser(targetUserId);
      return 'none';
    } catch (err) {
      console.error('Failed to unfollow user:', err);
      // Revert on error
      get().setFollowStatus(normalizedUsername, prevStatus);
      get().setFollowStatus(targetUserId, prevStatus);
      throw err;
    }
  },

  clear: () => set({ followStatuses: {}, loadingUsers: new Set(), pendingRequests: new Set() }),
}));
