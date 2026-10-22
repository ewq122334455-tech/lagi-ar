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
        // Token names kept stable so every existing screen (admin workspace, AR pages,
        // 3D viewer overlays) re-skins automatically from these values alone.
        // Store-style neutrals: a white canvas so product imagery reads cleanly, with a warm
        // cream (`mist`) behind images and in panels to keep LAGI's softness.
        paper: '#ffffff',
        ink: '#151515',
        graphite: '#4a4a4a',
        stone: '#929292',
        mist: '#f4f1ea',
        line: '#e8e6e1',
        cream: '#ede3cc',
        accent: '#161514',
        // Brand accents, taken from the LAGI logo colourways. Used for large graphic
        // blocks / CTAs / hotspots, never flooded across the whole screen.
        // `blue` is the lead colour; the others are points.
        blue: '#2E55A3',
        orange: '#C2662C',
        lime: '#DEB457',
      },
      fontFamily: {
        // Brand type: Latin in Posterama (display: Posterama 2001), Hangul in 윤고딕 (Yoon Gothic). Both are licensed
        // fonts, so each falls back to its closest free match — Jost (geometric Latin) and Pretendard
        // (Hangul) — until the font files are added. Latin fonts come first: they have no Hangul, so
        // Korean characters fall through to the Korean fonts automatically.
        sans: ['posterama', '"Posterama"', 'Jost', '"YoonGothic"', '"Yoon Gothic"', '"윤고딕"', '"Pretendard Variable"', 'Pretendard', '-apple-system', 'sans-serif'],
        heading: ['posterama', '"Posterama"', 'Jost', '"YoonGothic"', '"Yoon Gothic"', '"윤고딕"', '"Pretendard Variable"', 'Pretendard', '-apple-system', 'sans-serif'],
        // Posterama 2001 is an all-caps display cut (A drawn as Λ): headlines only, never body text.
        display: ['"Posterama 2001"', 'posterama-2001', 'posterama', 'Jost', '"YoonGothic"', '"Yoon Gothic"', '"윤고딕"', '"Pretendard Variable"', 'Pretendard', '-apple-system', 'sans-serif'],
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
