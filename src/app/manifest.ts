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
      // Iconos cuadrados — Android Chrome los necesita en estos
      // tamaños exactos para mostrar el ícono al instalar / agregar
      // a pantalla de inicio. Con sólo og-logo (800x652) algunos
      // navegadores rechazaban silenciosamente la instalación.
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      // maskable: misma imagen padded — Android la recorta a la
      // forma del launcher (círculo, redondeado, etc.).
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ],
    categories: ["games", "entertainment"]
  };
}
