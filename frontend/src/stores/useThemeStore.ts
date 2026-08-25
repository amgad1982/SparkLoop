import { create } from 'zustand';
import { api } from '../services/apiClient';

export type ThemeMode = 'dark' | 'light';
export type Locale = 'ar' | 'en';
export type Direction = 'rtl' | 'ltr';

interface ThemeState {
  theme: ThemeMode;
  locale: Locale;
  direction: Direction;
  setTheme: (theme: ThemeMode, syncToBackend?: boolean) => void;
  toggleTheme: () => void;
  setLocale: (locale: Locale, syncToBackend?: boolean) => void;
  toggleLocale: () => void;
  syncFromUser: (preferredTheme?: string, preferredLanguage?: string) => void;
}

const getStoredTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem('sparkloop_theme') as ThemeMode;
  return stored === 'light' || stored === 'dark' ? stored : 'dark';
};

const getStoredLocale = (): Locale => {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem('sparkloop_locale') as Locale;
  return stored === 'ar' || stored === 'en' ? stored : 'en';
};

const applyDomTheme = (theme: ThemeMode) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
  root.setAttribute('data-theme', theme);
};

const applyDomLocale = (locale: Locale) => {
  if (typeof document === 'undefined') return;
  const direction = locale === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dir = direction;
  document.documentElement.lang = locale;
};

// Initial DOM bootstrap
const initialTheme = getStoredTheme();
const initialLocale = getStoredLocale();
applyDomTheme(initialTheme);
applyDomLocale(initialLocale);

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme,
  locale: initialLocale,
  direction: initialLocale === 'ar' ? 'rtl' : 'ltr',

  setTheme: (theme: ThemeMode, syncToBackend = true) => {
    localStorage.setItem('sparkloop_theme', theme);
    applyDomTheme(theme);
    set({ theme });

    if (syncToBackend) {
      api.updateProfile({ preferredTheme: theme }).catch(() => {
        // Guest or offline
      });
    }
  },

  toggleTheme: () => {
    const nextTheme: ThemeMode = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(nextTheme, true);
  },

  setLocale: (locale: Locale, syncToBackend = true) => {
    localStorage.setItem('sparkloop_locale', locale);
    applyDomLocale(locale);
    const direction = locale === 'ar' ? 'rtl' : 'ltr';
    set({ locale, direction });

    if (syncToBackend) {
      api.updateProfile({ preferredLanguage: locale }).catch(() => {
        // Guest or offline
      });
    }
  },

  toggleLocale: () => {
    const nextLocale: Locale = get().locale === 'en' ? 'ar' : 'en';
    get().setLocale(nextLocale, true);
  },

  syncFromUser: (preferredTheme?: string, preferredLanguage?: string) => {
    if (preferredTheme === 'light' || preferredTheme === 'dark') {
      get().setTheme(preferredTheme as ThemeMode, false);
    }
    if (preferredLanguage === 'ar' || preferredLanguage === 'en') {
      get().setLocale(preferredLanguage as Locale, false);
    }
  },
}));
