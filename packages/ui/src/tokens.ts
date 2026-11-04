export const BRAND_COLORS = {
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
} as const;

export const BRAND_GRADIENTS = {
  primary: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 45%, #06B6D4 100%)',
  soft: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(6,182,212,0.18))',
} as const;

export type BrandColorName = keyof typeof BRAND_COLORS;
