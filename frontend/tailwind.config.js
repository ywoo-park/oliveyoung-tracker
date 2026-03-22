/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        /**
         * 무드 팔레트 — Oasis(#A7C5F9) 메인
         * Celery #E1FCAD · Diamond Ice #F7FDFF · Black Feather #081412
         */
        mood: {
          oasis: '#A7C5F9',
          oasisHover: '#8eb3f0',
          celery: '#E1FCAD',
          ice: '#F7FDFF',
          feather: '#081412',
          featherHover: '#0c1f1c',
        },
      },
    },
  },
  plugins: [],
};
