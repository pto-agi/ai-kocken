/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';

export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Poppins', 'sans-serif'],
        condensed: ['Barlow Condensed', 'sans-serif'],
        grotesk: ['Space Grotesk', 'sans-serif'],
      },
      colors: {
        brand: {
          sand: 'var(--brand-sand)',
          sage: 'var(--brand-sage)',
          green: 'var(--brand-green)',
          greenDeep: 'var(--brand-green-deep)',
          charcoal: 'var(--brand-charcoal)',
          line: 'var(--brand-line)',
          apricot: 'var(--brand-apricot)',
          muted: 'var(--brand-muted)',
          mutedLight: 'var(--brand-muted-light)',
          // Backward-compatible aliases
          dark: 'var(--brand-sand)',
          surface: 'var(--brand-sage)',
          lime: 'var(--brand-green)',
          text: 'var(--brand-charcoal)',
          base: 'var(--brand-muted)',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'fade-in-up': 'fadeInUp 0.5s ease-out',
        'bounce-slow': 'bounce 3s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [
    typography,
  ],
}
