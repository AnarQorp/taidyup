/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#031427',
          card: '#102034',
          high: '#1b2b3f',
          highest: '#26364a'
        },
        primary: {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8',
          light: '#60a5fa'
        },
        success: {
          DEFAULT: '#10b981',
          subtle: 'rgba(16, 185, 129, 0.15)'
        },
        warning: {
          DEFAULT: '#f59e0b',
          subtle: 'rgba(245, 158, 11, 0.15)'
        },
        danger: {
          DEFAULT: '#ef4444',
          subtle: 'rgba(239, 68, 68, 0.15)'
        }
      }
    },
  },
  plugins: [],
}
