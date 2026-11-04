import { talentTailwindPreset } from '@talent-ai/ui/tailwind-preset';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  presets: [talentTailwindPreset],
};
