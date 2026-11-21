import type { Config } from 'tailwindcss'

// Paleta turquesa tomada del diseño de referencia (#1BA2BB / #5FCBBF / #C5EDEE) sobre la tipografía y
// estructura de FitHub. `ink` son los neutros, `danger` el rojo de errores.
const config: Config = {
  content: ['./src/app/**/*.{js,ts,jsx,tsx,mdx}', './src/components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      colors: {
        brand: {
          50: '#effbfc', 100: '#c5edee', 200: '#9fe0e6', 300: '#6fcfda', 400: '#3cb8c9',
          500: '#1ba2bb', 600: '#10869c', 700: '#0f6b7e', 800: '#0f5666', 900: '#0c3f4c',
        },
        mint: { 400: '#5fcbbf', 500: '#3fb5a8' },
        danger: {
          50: '#fef2f2', 100: '#fde3e4', 200: '#fbc9cb', 300: '#f59ea1', 400: '#ec5f65',
          500: '#e0262d', 600: '#d10f15', 700: '#a80b10', 800: '#7f0a0e', 900: '#4d0609',
        },
        ink: {
          50: '#f6f8fb', 100: '#e9edf2', 200: '#d3d9e1', 300: '#a9b1bd', 400: '#767f8d',
          500: '#525b69', 600: '#3a424e', 700: '#262d37', 800: '#171c24', 900: '#0b0e13',
        },
      },
      boxShadow: {
        soft: '0 18px 40px rgba(15, 40, 60, 0.07)',
      },
    },
  },
  plugins: [],
}

export default config
