import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserDto } from '../types/api';

export interface Persona {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  role: string;
  isCustom?: boolean;
}

export const PRESET_PERSONAS: Persona[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    username: 'alice',
    displayName: 'Alice Wonder 🎨',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=alice',
    role: 'Digital Artist & Storyteller',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    username: 'bob',
    displayName: 'Bob The Bard 🎸',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=bob',
    role: 'Musician & Audio Chain Wizard',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    username: 'noor',
    displayName: 'نور العرّاف 🌟',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=noor',
    role: 'راوية قصص تفاعلية',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    username: 'tariq',
    displayName: 'طارق صانع الميمز ⚡',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=tariq',
    role: 'صانع ميمز وتحديات',
  },
];

export const GUEST_PERSONA: Persona = {
  id: '00000000-0000-0000-0000-000000000000',
  username: 'guest',
  displayName: 'Guest Explorer 👤',
  avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=guest',
  role: 'Guest Visitor',
  isCustom: false,
};

interface AuthState {
  currentPersona: Persona;
  customPersonas: Persona[];
  currentUser: UserDto | null;
  centrifugoToken: string | null;
  setPersona: (persona: Persona) => void;
  addCustomPersona: (persona: Persona) => void;
  setUser: (user: UserDto | null) => void;
  setCentrifugoToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentPersona: PRESET_PERSONAS[0],
      customPersonas: [],
      currentUser: null,
      centrifugoToken: null,
      setPersona: (persona) => {
        set({ currentPersona: persona });
        if (persona.username !== 'guest') {
          import('../services/apiClient').then(({ api }) => {
            api.getUserProfile(persona.username).then((profile) => {
              if (profile) {
                import('./useThemeStore').then(({ useThemeStore }) => {
                  useThemeStore.getState().syncFromUser(profile.preferredTheme, profile.preferredLanguage);
                });
              }
            }).catch(() => {});
          });
        }
      },
      addCustomPersona: (persona) =>
        set((state) => ({
          customPersonas: [
            persona,
            ...state.customPersonas.filter((p) => p.id !== persona.id && p.username !== persona.username),
          ],
          currentPersona: persona,
        })),
      setUser: (user) => {
        set({ currentUser: user });
        if (user) {
          import('./useThemeStore').then(({ useThemeStore }) => {
            useThemeStore.getState().syncFromUser(user.preferredTheme, user.preferredLanguage);
          });
        }
      },
      setCentrifugoToken: (token) => set({ centrifugoToken: token }),
      logout: () =>
        set({
          currentPersona: GUEST_PERSONA,
          currentUser: null,
          centrifugoToken: null,
        }),
    }),
    {
      name: 'sparkloop-auth-storage',
      partialize: (state) => ({
        currentPersona: state.currentPersona,
        customPersonas: state.customPersonas,
      }),
    }
  )
);
