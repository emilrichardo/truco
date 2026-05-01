import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MusicaAmbiental } from "@/components/MusicaAmbiental";

// URL canónica del sitio. Se puede sobrescribir con NEXT_PUBLIC_SITE_URL
// (ej. en preview deployments). Sino se asume el dominio de producción.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://trucoentreprimos.com";

const TITULO = "Truco Entre Primos — Acá no hay suerte, hay picardía";
const DESCRIPCION =
  "Truco argentino online entre primos. Gratis, sin registro. Picardía, fernet y cartas españolas. Jugá 1v1 o 2v2 contra la máquina o invitá a tu mesa.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITULO,
    template: "%s · Truco Entre Primos"
  },
  description: DESCRIPCION,
  applicationName: "Truco Entre Primos",
  authors: [{ name: "Truco Entre Primos" }],
  generator: "Next.js",
  keywords: [
    "truco",
    "truco argentino",
    "truco online",
    "truco gratis",
    "truco entre primos",
    "cartas españolas",
    "envido",
    "real envido",
    "falta envido",
    "retruco",
    "vale cuatro",
    "1v1",
    "2v2",
    "juego de cartas argentino"
  ],
  category: "games",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "Truco Entre Primos",
    title: TITULO,
    description: DESCRIPCION,
    url: SITE_URL,
    images: [
      {
        url: "/brand/og-logo.png",
        width: 800,
        height: 652,
        alt: "Truco Entre Primos — logo",
        type: "image/png"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRIPCION,
    images: ["/brand/og-logo.png"]
  },
  // WhatsApp/Telegram/Discord usan OG estándar. Linkeamos al PNG generado
  // a partir del logo porque algunos clientes viejos no leen WebP en la
  // preview. Los icons del browser apuntan al WebP optimizado.
  icons: {
    icon: "/brand/icon-192.png",
    shortcut: "/brand/icon-192.png",
    // apple-touch-icon debe ser cuadrado (mínimo 180x180). Antes
    // usábamos og-logo.png 800x652 — iOS lo aceptaba pero quedaba
    // recortado raro. icon-512 cuadrado se ve bien escalado.
    apple: "/brand/icon-512.png"
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false
  },
  // PWA: manifest + integración con iOS para "Agregar a pantalla de inicio".
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Truco Primos"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  userScalable: false,
  themeColor: "#1E1B18"
};

// JSON-LD para que Google entienda que es una WebApplication / videojuego.
// Es un objeto estático (sin user input), por eso JSON.stringify y volcarlo
// inline es seguro y es el patrón canónico recomendado por schema.org.
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: "Truco Entre Primos",
      description: DESCRIPCION,
      url: SITE_URL,
      applicationCategory: "GameApplication",
      genre: "Card Game",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript and a modern browser.",
      inLanguage: "es-AR",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "ARS",
        availability: "https://schema.org/InStock"
      }
    },
    {
      "@type": "WebSite",
      name: "Truco Entre Primos",
      url: SITE_URL,
      inLanguage: "es-AR"
    }
  ]
};
const structuredDataJson = JSON.stringify(structuredData);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Alfa+Slab+One&family=Rye&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: structuredDataJson }}
        />
      </head>
      {/* suppressHydrationWarning evita el warning de React cuando una
          extensión del navegador (Bitwarden, ColorZilla, Console Ninja,
          Grammarly, etc.) inyecta atributos en el <body> antes de la
          hidratación. No tapa errores de hidratación reales del código
          de la app — sólo los del body de nivel root. */}
      <body className="antialiased font-sans" suppressHydrationWarning>
        {children}
        <MusicaAmbiental />
      </body>
    </html>
  );
}
