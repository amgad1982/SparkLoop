/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Nordic Slate & Indigo Palette (Eye-friendly & Mobile Optimized)
        nordic: {
          canvas: '#0b0f17',
          surface: '#131b28',
          card: '#162030',
          elevated: '#1c283c',
          border: '#233047',
          muted: '#8193af',
        },
        spark: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1', // Main Nordic Indigo
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        accent: {
          sky: '#38bdf8',
          amber: '#f59e0b',
          emerald: '#10b981',
          rose: '#f43f5e',
          violet: '#8b5cf6',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Cairo', 'sans-serif'],
        arabic: ['Cairo', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-up': 'floatUp 2.5s ease-out forwards',
        'sparkle': 'sparkle 1.5s ease-in-out infinite',
      },
      keyframes: {
        floatUp: {
          '0%': { transform: 'translateY(0) scale(0.8)', opacity: '1' },
          '100%': { transform: 'translateY(-240px) scale(1.4)', opacity: '0' },
        },
        sparkle: {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)', opacity: '0.8' },
          '50%': { transform: 'scale(1.15) rotate(10deg)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
