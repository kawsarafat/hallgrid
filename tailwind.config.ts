import type { Config } from 'tailwindcss';

// Design tokens. Neutrals, chart series and status colours follow one palette
// (checked for colour-blind separation and contrast); see src/components/ui.tsx.
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: '#f4f4f1',
        surface: '#ffffff',
        sunken: '#f9f9f7',
        ink: { DEFAULT: '#0b0b0b', 2: '#52514e', 3: '#77756f' },
        line: { DEFAULT: '#e1e0d9', soft: '#ecebe6', strong: '#c3c2b7' },
        side: { DEFAULT: '#1a1a19', 2: '#242422', ink: '#f0efec', muted: '#a8a79f' },
        brand: {
          50: '#eef5fd',
          100: '#cde2fb',
          200: '#9ec5f4',
          400: '#3987e5',
          500: '#2a78d6',
          600: '#256abf',
          700: '#1c5cab',
          800: '#184f95',
        },
        series: { 1: '#2a78d6', 2: '#eb6834' },
        good: { DEFAULT: '#0ca30c', ink: '#006300', bg: '#ebf6eb', line: '#b9e0b9' },
        warn: { DEFAULT: '#fab219', ink: '#6b4700', bg: '#fef5e1', line: '#f5d891' },
        crit: { DEFAULT: '#d03b3b', ink: '#a32727', bg: '#fbeaea', line: '#f0bcbc' },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', '"Noto Sans Bengali"', '"Nirmala UI"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,11,11,0.04), 0 0 0 1px rgba(11,11,11,0.06)',
        pop: '0 8px 24px rgba(11,11,11,0.12), 0 0 0 1px rgba(11,11,11,0.06)',
      },
    },
  },
  plugins: [],
} satisfies Config;
