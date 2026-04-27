/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Habilitamos optimización de imágenes: Vercel sirve WebP/AVIF en tamaños
  // adecuados al viewport. Crítico porque las cartas pesan ~2 MB cada una
  // en PNG original.
  images: {
    formats: ["image/webp"],
    deviceSizes: [320, 480, 640, 750, 828, 1080, 1200],
    imageSizes: [80, 96, 128, 160, 200, 256, 320]
  }
};
module.exports = nextConfig;
