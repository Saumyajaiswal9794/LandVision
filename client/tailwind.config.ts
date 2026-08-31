import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f4f7f6',
          100: '#e2eae7',
          200: '#c5d5d0',
          300: '#9cb7b0',
          400: '#6f938c',
          500: '#537770', // Primary theme color (forest green vibe)
          600: '#415f5a',
          700: '#364f4b',
          800: '#2f423f',
          900: '#2a3a37',
        },
      },
    },
  },
  plugins: [],
};

export default config;
