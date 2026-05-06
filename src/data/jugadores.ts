// Catálogo de personajes "primos". Las imágenes viven en Supabase Storage:
// bucket "jugadores", path "<slug>.webp". Para desarrollo sin Supabase queda
// un fallback liviano en /public/jugadores/<slug>.webp.

export interface PersonajeMeta {
  slug: string;
  nombre: string;
  numero: number; // número de carta en la ilustración (decorativo)
}

export const PERSONAJES: PersonajeMeta[] = [
  { slug: "hugui", nombre: "Hugui", numero: 1 },
  { slug: "cholo", nombre: "Cholo", numero: 2 },
  { slug: "marcos", nombre: "Marcos", numero: 4 },
  { slug: "lucas", nombre: "Lucas", numero: 4 },
  { slug: "mati", nombre: "Matías", numero: 6 },
  { slug: "mariano", nombre: "Mariano", numero: 7 },
  { slug: "richi", nombre: "Richi", numero: 10 },
  { slug: "jorge", nombre: "Jorge", numero: 10 },
  { slug: "rodrigo", nombre: "Rodrigo", numero: 11 },
  { slug: "dani", nombre: "Dani", numero: 12 },
  { slug: "gonzalo", nombre: "Gonzalo", numero: 3 }
];

export function getPersonaje(slug: string): PersonajeMeta | undefined {
  return PERSONAJES.find((p) => p.slug === slug);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const JUGADORES_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_JUGADORES_BUCKET || "jugadores";
const JUGADORES_VERSION = process.env.NEXT_PUBLIC_JUGADORES_VERSION || "";

export function urlPersonaje(slug: string): string {
  const archivo = `${encodeURIComponent(slug)}.webp`;
  const version = JUGADORES_VERSION
    ? `?v=${encodeURIComponent(JUGADORES_VERSION)}`
    : "";
  if (SUPABASE_URL) {
    return `${SUPABASE_URL}/storage/v1/object/public/${JUGADORES_BUCKET}/${archivo}${version}`;
  }
  return `/jugadores/${archivo}${version}`;
}
