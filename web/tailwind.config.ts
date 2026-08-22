import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: '#FFFFFF',
        panel: '#FFFFFF',
        line: '#E5E7EB',
        ink: '#0F172A',
        muted: '#64748B',
        sage: {
          DEFAULT: '#0D9488',
          dark: '#0F766E',
          soft: '#CCFBF1',
        },
        clay: {
          DEFAULT: '#F43F5E',
          soft: '#FFE4E6',
        },
        amberish: '#F59E0B',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      boxShadow: {
        panel: '0 1px 2px rgba(15, 23, 42, 0.05), 0 8px 24px -16px rgba(15, 23, 42, 0.18)',
        lift: '0 16px 40px -20px rgba(13, 148, 136, 0.35)',
        press: 'inset 0 1px 0 rgba(255,255,255,0.25)',
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
