// NOTE: Tailwind v4 reads theme tokens from globals.css @theme block only.
// This file is kept for reference but does NOT affect generated CSS.
// Source of truth: src/app/globals.css
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        lawdger: {
          base: '#F5F2EC',      // Premium Sand/Parchment (Background)
          espresso: '#3D2E26',  // Deep dark panel
          border: '#4A3C33',    // Dark panel inner border
          gold: '#D4AF37',      // Accent glow & buttons
          cream: '#FCFAF8',     // High contrast text
          muted: '#A3968A',     // Secondary interface text
        }
      },
    },
  },
  plugins: [],
};

export default config;