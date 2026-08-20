import React, { useEffect } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';

export const RTLProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { locale, direction } = useThemeStore();

  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = locale;
  }, [locale, direction]);

  return (
    <div dir={direction} className={direction === 'rtl' ? 'font-arabic' : 'font-sans'}>
      {children}
    </div>
  );
};
