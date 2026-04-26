import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#f3e3b6",
        parchment: "#ecd9a3",
        truco: {
          green: "#0e3b2e",
          felt: "#11503b",
          gold: "#c9a24a",
          red: "#8b1c1c",
          dark: "#1a1410"
        }
      },
      fontFamily: {
        display: ["'Cinzel'", "serif"],
        body: ["'Inter'", "system-ui", "sans-serif"]
      },
      backgroundImage: {
        felt:
          "radial-gradient(ellipse at center, #1a6b4f 0%, #11503b 45%, #093225 100%)"
      }
    }
  },
  plugins: []
};
export default config;
