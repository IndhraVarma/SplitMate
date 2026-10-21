/**
 * SplitMate design tokens.
 *
 * A light, friendly sage-and-olive palette: pale green canvases, deep olive for
 * anything actionable or monetary, and near-black text. Only two saturated
 * colours ever appear on a screen at once - the olive, and a red/green pair
 * reserved exclusively for money moving out or coming in.
 *
 * Every screen is written against these semantic names (surface / ink / accent)
 * rather than raw hex, so the whole theme can be retuned from this one file.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        /** Olive ramp. 600 is "the" brand colour: buttons, cards, active nav. */
        brand: {
          50: '#F6FAE8',
          100: '#EAF2CE',
          200: '#DCE9B4',
          300: '#C6D894',
          400: '#A7C06E',
          500: '#87A354',
          600: '#6B8A47',
          700: '#587339',
          800: '#45592E',
          900: '#334121',
        },
        surface: {
          /** App canvas - a barely-there sage tint so white cards read as raised. */
          base: '#FBFDF4',
          /** Cards, sheets, the sidebar. */
          raised: '#FFFFFF',
          /** Inputs, hover states, subtle wells. */
          overlay: '#F2F7E4',
          /** Hairlines and card outlines. */
          border: '#E2EBCB',
          /** The pale canvas behind the sign-in screens. */
          auth: '#EAF2CE',
        },
        accent: {
          DEFAULT: '#6B8A47',
          strong: '#587339',
          soft: '#EAF2CE',
          muted: '#DCE9B4',
        },
        /** Money in / money out. Never used for anything that is not money. */
        positive: '#2E7D32',
        negative: '#D1403F',
        caution: '#C9821B',
        ink: {
          DEFAULT: '#1D2317',
          muted: '#5E6B50',
          faint: '#8C9880',
          /** Text sitting on an olive surface. */
          onAccent: '#F7FBEC',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(45, 58, 30, 0.04), 0 8px 24px -16px rgba(45, 58, 30, 0.18)',
        lift: '0 12px 32px -12px rgba(45, 58, 30, 0.28)',
        tile: '0 10px 24px -14px rgba(60, 80, 40, 0.55)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'slide-up': 'slide-up 200ms ease-out',
        'slide-in-left': 'slide-in-left 220ms cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
