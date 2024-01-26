// const plugin = require('tailwindcss/plugin');

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      keyframes: {
        'fade--in': {
          '0%': {
            opacity: 0,
          },
          '100%': {
            opacity: 1,
          },
        },
        'fade--stay': {
          '0%': {
            opacity: 1,
          },
          '100%': {
            opacity: 1,
          },
        },
        'fade--out': {
          '0%': {
            opacity: 1,
          },
          '100%': {
            opacity: 0,
          },
        },
        'fade--change': {
          '0%': {
            opacity: 0,
          },
          '100%': {
            opacity: 0,
          },
        },
      },
      animation: {
        'fade--in': 'fade--in 1000ms',
        'fade--stay': 'fade--stay 1000ms',
        'fade--out': 'fade--out 1000ms',
        'fade--change': 'fade--change 1ms',
      },
    },
  },
  plugins: [],
};
