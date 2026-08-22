import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: '#E8DFD2',
        panel: '#F4EEE4',
        line: '#D4C9BA',
        ink: '#1C1713',
        muted: '#6A5F54',
        sage: {
          DEFAULT: '#3A6854',
          dark: '#2E5344',
          soft: '#DCE8E0',
        },
        clay: {
          DEFAULT: '#B54A32',
          soft: '#F1DDD6',
        },
        amberish: '#B9842A',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      boxShadow: {
        panel: '0 1px 0 rgba(28, 23, 19, 0.04), 0 8px 24px -18px rgba(28, 23, 19, 0.35)',
        lift: '0 12px 32px -16px rgba(28, 23, 19, 0.38)',
        press: 'inset 0 1px 0 rgba(255,255,255,0.18)',
      },
      transitionTimingFunction: {
        calm: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.85)', opacity: '0.55' },
          '100%': { transform: 'scale(1.55)', opacity: '0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.4s ease-in-out infinite',
        pulseRing: 'pulseRing 1.6s ease-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
