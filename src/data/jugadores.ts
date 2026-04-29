// Catálogo de personajes "primos". Para reemplazar uno: pisá la imagen
// /public/jugadores/<slug>.png y, si querés, ajustá el nombre acá.

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

export function urlPersonaje(slug: string): string {
  // Servimos webp por default — pesa ~150KB vs ~1.7MB del PNG original.
  // Los .png siguen en disco como fallback / para edición; si querés
  // forzarlos pasá la url con .png a mano.
  return `/jugadores/${slug}.webp`;
}
