/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app.html', './src/app/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: 'rgb(var(--brand) / <alpha-value>)', fg: 'rgb(var(--brand-fg) / <alpha-value>)' },
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        surface2: 'rgb(var(--surface2) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        clear: { DEFAULT: 'rgb(var(--clear) / <alpha-value>)', bg: 'rgb(var(--clear-bg) / <alpha-value>)' },
        caution: { DEFAULT: 'rgb(var(--caution) / <alpha-value>)', bg: 'rgb(var(--caution-bg) / <alpha-value>)' },
        stop: { DEFAULT: 'rgb(var(--stop) / <alpha-value>)', bg: 'rgb(var(--stop-bg) / <alpha-value>)', solid: 'rgb(var(--stop-solid) / <alpha-value>)' },
      },
      fontFamily: {
        sans: ['"Noto Sans Bengali"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
};
