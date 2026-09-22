/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    screens: {
      sm: '480px',
      md: '768px',
      lg: '1200px',
      xl: '1920px',
      '2xl': '2560px',
    },
    extend: {
      colors: {
        paper: '#f7f6f3',
        ink: '#111110',
        graphite: '#3a3a37',
        stone: '#8a8880',
        mist: '#e7e5df',
        line: '#d8d6cf',
        accent: '#111110',
      },
      fontFamily: {
        sans: [
          '"Pretendard Variable"',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Noto Sans KR"',
          'sans-serif',
        ],
        display: [
          '"Pretendard Variable"',
          'Pretendard',
          '"Noto Sans KR"',
          'sans-serif',
        ],
      },
      letterSpacing: {
        widest2: '0.28em',
      },
      maxWidth: {
        canvas: '2560px',
      },
    },
  },
  plugins: [],
};
