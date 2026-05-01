import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Truco Entre Primos",
    short_name: "Truco Primos",
    description:
      "Truco argentino online — jugá entre primos, gratis y sin registro.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#1c1c1d",
    theme_color: "#d9a441",
    lang: "es-AR",
    icons: [
      {
        src: "/brand/og-logo.png",
        sizes: "800x652",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/brand/logo.webp",
        sizes: "any",
        type: "image/webp",
        purpose: "any"
      }
    ],
    categories: ["games", "entertainment"]
  };
}
