import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: '#EDE6D9',
        panel: '#F7F1E8',
        line: '#D9D0C3',
        ink: '#1F1A16',
        muted: '#6B6157',
        sage: {
          DEFAULT: '#3F6F5B',
          dark: '#33594A',
          soft: '#E3EDE6',
        },
        clay: {
          DEFAULT: '#B54A32',
          soft: '#F3E0D9',
        },
        amberish: '#C08A2E',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      boxShadow: {
        panel: '0 1px 2px rgba(31, 26, 22, 0.05)',
        lift: '0 6px 20px -12px rgba(31, 26, 22, 0.35)',
      },
      transitionTimingFunction: {
        calm: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
