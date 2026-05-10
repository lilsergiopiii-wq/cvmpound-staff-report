/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cvBlack: '#0a0a0a',
        cvPanel: '#151515',
        cvPanelSoft: '#1f1f1f',
        cvGold: '#f5c518'
      }
    }
  },
  plugins: []
};
