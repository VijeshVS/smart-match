/**
 * talent.ai Tailwind v3 preset.
 *
 * Usage (in an app's tailwind.config.js):
 *   import { talentTailwindPreset } from '@talent-ai/ui/tailwind-preset';
 *   export default { content: [...], presets: [talentTailwindPreset] };
 */

export const talentColors = {
  primary: '#7C3AED',
  primaryHover: '#8B5CF6',
  secondary: '#06B6D4',
  accent: '#A855F7',
  dark: '#0F0F23',
  darker: '#080814',
  surface: '#1A1A3E',
  text: '#E2E8F0',
  muted: '#94A3B8',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#FB7185',
};

export const talentTailwindPreset = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        talent: {
          ...talentColors,
        },
        surface: {
          dark: '#0f0f23',
          card: 'rgba(255, 255, 255, 0.05)',
          'card-hover': 'rgba(255, 255, 255, 0.08)',
        },
        accent: {
          violet: '#7c3aed',
          cyan: '#06b6d4',
          purple: '#a855f7',
        },
      },
      backgroundImage: {
        'talent-gradient': 'linear-gradient(135deg, #7C3AED 0%, #A855F7 45%, #06B6D4 100%)',
        'talent-gradient-soft':
          'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(6,182,212,0.18))',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'gradient-shift': 'gradientShift 8s ease infinite',
        float: 'float 6s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-in-left': 'slideInLeft 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.4s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
      },
      keyframes: {
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(124, 58, 237, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(124, 58, 237, 0.6)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

export default talentTailwindPreset;
