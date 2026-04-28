import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://trucoentreprimos.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Las salas online tienen IDs efímeros que no aportan a la búsqueda
        // y la partida solo es una pantalla detrás de un click. Las APIs y
        // assets de música no deberían aparecer en el index.
        disallow: ["/jugar/sala/", "/jugar/solo/partida", "/api/"]
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
