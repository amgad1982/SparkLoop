import { create } from 'zustand';

export type Locale = 'ar' | 'en';
export type Direction = 'rtl' | 'ltr';

interface ThemeState {
  locale: Locale;
  direction: Direction;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  locale: 'en',
  direction: 'ltr',
  setLocale: (locale) => {
    const direction = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = direction;
    document.documentElement.lang = locale;
    set({ locale, direction });
  },
  toggleLocale: () => {
    const newLocale: Locale = get().locale === 'en' ? 'ar' : 'en';
    get().setLocale(newLocale);
  },
}));
