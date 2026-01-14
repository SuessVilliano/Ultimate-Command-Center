/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cyber': {
          'dark': '#0a0a0f',
          'darker': '#050508',
          'purple': '#8b5cf6',
          'blue': '#06b6d4',
          'pink': '#ec4899',
          'green': '#10b981',
          'yellow': '#f59e0b',
          'red': '#ef4444',
        }
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
      }
    },
  },
  plugins: [],
}
