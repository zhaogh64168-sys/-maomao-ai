import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        maomao: {
          bg: "#f7f7f8",
          ink: "#111827",
          panel: "#ffffff",
          line: "#e5e7eb"
        }
      }
    }
  },
  plugins: []
};

export default config;
