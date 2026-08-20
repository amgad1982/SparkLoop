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
        spark: {
          50: '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
          950: '#4a044e',
        },
        neon: {
          cyan: '#06b6d4',
          amber: '#f59e0b',
          rose: '#f43f5e',
          lime: '#84cc16',
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
