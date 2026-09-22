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
        paper: '#ffffff',
        ink: '#111111',
        graphite: '#3a3a3a',
        stone: '#8a8a8a',
        mist: '#f5f5f5',
        line: '#e5e5e5',
        accent: '#111111',
        // New brand accents (spec: used for large graphic blocks / CTAs / hotspots,
        // never flooded across the whole screen).
        blue: '#155EEF',
        orange: '#FF5A1F',
        lime: '#C8FF00',
      },
      fontFamily: {
        // Body copy: legible at length in both scripts, still soft/rounded terminals.
        sans: ['"Gothic A1"', '"Nunito"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        // Product names, nav, buttons, numbers: bold rounded grotesk (KO+EN).
        heading: ['"Nunito"', '"Gothic A1"', '-apple-system', 'sans-serif'],
        // Reserved for the handful of major display titles (LOOK CLOSER, FEATURED
        // PRODUCTS, MATERIALS, PROCESS, STORY) — a genuinely rounded bubble face.
        display: ['"Jua"', '"Nunito"', '"Gothic A1"', 'sans-serif'],
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
