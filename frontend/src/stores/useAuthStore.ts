import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserDto, AuthResultDto } from '../types/api';

export interface Persona {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  role: string;
  isCustom?: boolean;
}

export const GUEST_USER: Persona = {
  id: '00000000-0000-0000-0000-000000000000',
  username: 'guest',
  displayName: 'Guest Explorer 👤',
  avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=guest',
  role: 'Guest Visitor',
  isCustom: false,
};

interface AuthState {
  currentUser: UserDto | null;
  currentPersona: Persona;
  accessToken: string | null;
  refreshToken: string | null;
  refreshTokenExpiresAtUtc: string | null;
  centrifugoToken: string | null;
  isAuthModalOpen: boolean;
  authModalTab: 'login' | 'register' | 'verify';
  authVerificationEmail: string | null;
  openAuthModal: (tab?: 'login' | 'register' | 'verify', email?: string) => void;
  closeAuthModal: () => void;
  setUser: (user: UserDto | null) => void;
  setAuthResult: (result: AuthResultDto) => void;
  setTokens: (
    accessToken: string | null,
    refreshToken: string | null,
    centrifugoToken: string | null,
    refreshTokenExpiresAtUtc?: string | null
  ) => void;
  setCentrifugoToken: (token: string | null) => void;
  logout: () => void;
}

function userToPersona(user: UserDto | null): Persona {
  if (!user) return GUEST_USER;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    avatarUrl: user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`,
    role: user.bio || 'SparkLoop Creator',
    isCustom: true,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: null,
      currentPersona: GUEST_USER,
      accessToken: null,
      refreshToken: null,
      refreshTokenExpiresAtUtc: null,
      centrifugoToken: null,
      isAuthModalOpen: false,
      authModalTab: 'login',
      authVerificationEmail: null,
      openAuthModal: (tab = 'login', email) =>
        set({ isAuthModalOpen: true, authModalTab: tab, authVerificationEmail: email || null }),
      closeAuthModal: () => set({ isAuthModalOpen: false }),
      setUser: (user) => {
        set({ currentUser: user, currentPersona: userToPersona(user) });
        if (user) {
          import('./useThemeStore').then(({ useThemeStore }) => {
            useThemeStore.getState().syncFromUser(user.preferredTheme, user.preferredLanguage);
          });
        }
      },
      setAuthResult: (result) => {
        set({
          currentUser: result.user,
          currentPersona: userToPersona(result.user),
          accessToken: result.token,
          refreshToken: result.refreshToken,
          refreshTokenExpiresAtUtc: result.refreshTokenExpiresAtUtc,
          centrifugoToken: result.centrifugoToken,
          isAuthModalOpen: false,
        });
        if (result.user) {
          import('./useThemeStore').then(({ useThemeStore }) => {
            useThemeStore.getState().syncFromUser(result.user.preferredTheme, result.user.preferredLanguage);
          });
        }
      },
      setTokens: (accessToken, refreshToken, centrifugoToken, refreshTokenExpiresAtUtc) =>
        set({
          accessToken,
          refreshToken,
          centrifugoToken,
          refreshTokenExpiresAtUtc: refreshTokenExpiresAtUtc ?? null,
        }),
      setCentrifugoToken: (token) => set({ centrifugoToken: token }),
      logout: () => {
        const token = useAuthStore.getState().refreshToken;
        if (token) {
          import('../services/apiClient').then(({ api }) => {
            api.revokeToken(token).catch(() => {});
          });
        }
        set({
          currentUser: null,
          currentPersona: GUEST_USER,
          accessToken: null,
          refreshToken: null,
          refreshTokenExpiresAtUtc: null,
          centrifugoToken: null,
        });
      },
    }),
    {
      name: 'sparkloop-auth-storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
        currentPersona: state.currentPersona,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        refreshTokenExpiresAtUtc: state.refreshTokenExpiresAtUtc,
        centrifugoToken: state.centrifugoToken,
      }),
    }
  )
);
