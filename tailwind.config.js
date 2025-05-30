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
    },
  },
  plugins: [],
};
