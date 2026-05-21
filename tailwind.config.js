/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        surface: '#171717',
        primary: '#3b82f6',
        text: '#f5f5f5',
        'text-muted': '#a3a3a3'
      }
    },
  },
  plugins: [],
}
