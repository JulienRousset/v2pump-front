/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}", // Inclure tous les fichiers Angular (HTML et TS)
    "./node_modules/flowbite/**/*.js" // Inclure les composants de Flowbite
  ],
  theme: {
    extend: {
      zIndex: {
        100: '100',
      },
      colors: {
        // === Backgrounds ===
        bg: {
          primary: '#10171D',
          secondary: '#192229',
          card: '#394b57',
        },

        // === Texts ===
        text: {
          primary: '#e9f9ff',
          secondary: '#b7e3f9',
          muted: '#537fa2',
          dark: '#10171D',
        },

        // === Accent / UI ===
        accent: {
          DEFAULT: '#537fa2',
          light: '#b7e3f9',
          contrast: '#e9f9ff',
        },

        // === Borders / Dividers ===
        border: '#2b3a45',
        divider: '#1c2a33',

        // === States (optionnel)
        success: '#4fd1c5',
        warning: '#f6ad55',
        error: '#f56565',
        'bg-primary': '#10171D',
        'bg-secondary': '#192229',
        'bg-card': '#394b57',
        'text-primary': '#e9f9ff',
        'text-secondary': '#b7e3f9',
        'text-muted': '#537fa2',
        'accent': '#537fa2',
        'accent-light': '#b7e3f9',
        'accent-contrast': '#e9f9ff',
        'border': '#2b3a45',
        'divider': '#1c2a33',
        'success': '#4fd1c5',
        'warning': '#f6ad55',
        'error': '#f56565',
      },
    },
  },
  plugins: [],
};
