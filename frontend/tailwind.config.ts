import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9ebff",
          200: "#b9dbff",
          300: "#8ec5ff",
          400: "#5aa7ff",
          500: "#2a86ff",
          600: "#1c69db",
          700: "#1753ad",
          800: "#154786",
          900: "#143b6b",
          950: "#0e2747"
        }
      }
    }
  },
  plugins: []
};

export default config;