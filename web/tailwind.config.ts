import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: '#FFFFFF',
        panel: '#FFFFFF',
        line: '#E8E4F2',
        ink: '#12081F',
        muted: '#6B6280',
        sage: {
          DEFAULT: '#65A30D',
          dark: '#4D7C0F',
          soft: '#ECFCCB',
        },
        clay: {
          DEFAULT: '#E11D48',
          soft: '#FFE4E6',
        },
        amberish: '#F59E0B',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        brand: ['var(--font-brand)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      boxShadow: {
        panel: '0 1px 2px rgba(18, 8, 31, 0.04), 0 10px 28px -18px rgba(101, 163, 13, 0.28)',
        lift: '0 18px 40px -20px rgba(101, 163, 13, 0.45)',
        press: 'inset 0 1px 0 rgba(255,255,255,0.28)',
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
