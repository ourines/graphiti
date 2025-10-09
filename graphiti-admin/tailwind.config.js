/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0f172a',
        surface: '#111827',
        accent: {
          DEFAULT: '#38bdf8',
          foreground: '#0f172a',
        },
        muted: {
          DEFAULT: '#1f2937',
          foreground: '#9ca3af',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 40px -15px rgba(56, 189, 248, 0.45)',
      },
    },
  },
  plugins: [],
}
