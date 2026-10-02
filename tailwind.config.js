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
        // Brand palette, sampled pixel-by-pixel from the LAGI logo and the
        // supplied colour-chip artwork — not estimated by eye.
        // blue is the lead: it is 45% of the logo's non-white pixels.
        blue: '#3278BA',
        blueDeep: '#2A669E',   // blue x0.85, for hover/pressed
        ochre: '#C1A252',
        terracotta: '#B76C58',
        sage: '#6BA576',
        mauve: '#AC7B8A',
        slate: '#4E79A2',      // the star mark in the chip artwork
        clay: '#844E3F',       // terracotta darkened for text on white (AA)
        // Band surfaces, mixed from the palette above rather than imported:
        // sand = ochre at 12% over #f2f2f2, haze = blue at 12% over white,
        // ochrePale = ochre at 25% over white. See DESIGN.md.
        sand: '#ECE8DF',
        haze: '#E6EFF7',
        ochrePale: '#F0E8D4',
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
        band: '1280px',
      },
      borderRadius: {
        // One radius carries cards, buttons and inputs (DESIGN.md → rounded.card).
        card: '24px',
        input: '12px',
      },
      spacing: {
        band: '96px',
      },
    },
  },
  plugins: [],
};
