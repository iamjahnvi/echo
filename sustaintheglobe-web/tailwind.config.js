/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: '#244337',
        deepforest: '#1b3028',
        darkest: '#16261f',
        ivory: '#f5f3ea',
        cream: '#efece1',
        mist: '#d5dfd1',
        sage: '#a8b5a0',
        sand: '#e4e2d8',
        ink: '#1b201b',
        moss: '#4c574f',
        claylight: '#f4e8db',
        claymid: '#e9d5bd',
        claysand: '#dcbd97',
        claydark: '#cb9a63',
        claydeep: '#b67b4b',
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', "'Times New Roman'", 'serif'],
        sans: ['Inter', '-apple-system', "'Segoe UI'", 'Roboto', "'Helvetica Neue'", 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
