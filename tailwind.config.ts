import type { Config } from "tailwindcss";

/** Helper para colores con soporte de opacidad. */
const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tokens semánticos
        bg: rgb("--carbon-rgb"),
        surface: rgb("--surface-rgb"),
        "surface-2": rgb("--surface-2-rgb"),
        border: rgb("--border-rgb"),
        text: rgb("--crema-rgb"),
        "text-dim": rgb("--text-dim-rgb"),
        red: rgb("--red-rgb"),
        // Marca Truco Entre Primos
        carbon: rgb("--carbon-rgb"),
        crema: rgb("--crema-rgb"),
        dorado: rgb("--dorado-rgb"),
        gold: rgb("--dorado-rgb"),
        azul: rgb("--azul-rgb"),
        "azul-criollo": rgb("--azul-rgb"),
        madera: rgb("--madera-rgb"),
        // Mesa felt (legacy)
        felt: "#1d5b40"
      },
      fontFamily: {
        sans: ["Montserrat", "Lato", "system-ui", "sans-serif"],
        display: ['"Alfa Slab One"', "Bevan", "Georgia", "serif"],
        claim: ['"Rye"', '"Alfa Slab One"', "Georgia", "serif"]
      },
      boxShadow: {
        prensa: "0 2px 0 0 rgba(0,0,0,0.4)",
        marca: "0 4px 12px rgba(0,0,0,0.5)"
      }
    }
  },
  plugins: []
};
export default config;
