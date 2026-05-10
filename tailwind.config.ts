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
          espresso: '#2A2320',  // Deep dark panel
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