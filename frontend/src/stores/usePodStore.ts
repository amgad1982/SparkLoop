import { create } from 'zustand';

export interface FloatingReaction {
  id: string;
  emoji: string;
  xOffset: number; // percentage across screen (10% to 90%)
  createdAt: number;
}

interface PodState {
  reactions: FloatingReaction[];
  activeUsersCount: number;
  addReaction: (emoji: string) => void;
  removeOldReactions: () => void;
  setActiveUsersCount: (count: number) => void;
}

export const usePodStore = create<PodState>((set) => ({
  reactions: [],
  activeUsersCount: 1,
  addReaction: (emoji) => {
    const newReaction: FloatingReaction = {
      id: Math.random().toString(36).substring(2, 9),
      emoji,
      xOffset: Math.floor(Math.random() * 80) + 10,
      createdAt: Date.now(),
    };

    set((state) => ({
      reactions: [...state.reactions.slice(-30), newReaction],
    }));
  },
  removeOldReactions: () => {
    const now = Date.now();
    set((state) => ({
      reactions: state.reactions.filter((r) => now - r.createdAt < 3000),
    }));
  },
  setActiveUsersCount: (count) => set({ activeUsersCount: count }),
}));
