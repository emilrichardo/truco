import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://trucoentreprimos.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const ahora = new Date();
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: ahora,
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: `${SITE_URL}/jugar/solo`,
      lastModified: ahora,
      changeFrequency: "monthly",
      priority: 0.8
    },
    {
      url: `${SITE_URL}/jugar/crear`,
      lastModified: ahora,
      changeFrequency: "monthly",
      priority: 0.7
    },
    {
      url: `${SITE_URL}/reglas`,
      lastModified: ahora,
      changeFrequency: "yearly",
      priority: 0.6
    },
    {
      url: `${SITE_URL}/ranking`,
      lastModified: ahora,
      changeFrequency: "daily",
      priority: 0.5
    }
  ];
}
