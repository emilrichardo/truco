// Mantener las texturas numeradas en /public/texturas:
//   textura-mesa.png, textura-mesa02.png, textura-mesa03.png, ...
// Si se agregan más archivos, subir este número y el selector las incluye.
const CANTIDAD_TEXTURAS_MESA = 3;

function hashTexto(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function texturaMesaUrl(indice: number): string {
  if (indice <= 1) return "/texturas/textura-mesa.png";
  return `/texturas/textura-mesa${String(indice).padStart(2, "0")}.png`;
}

export function texturaMesaAleatoria(seed: string): string {
  const indice = 1 + (hashTexto(seed || "mesa") % CANTIDAD_TEXTURAS_MESA);
  return texturaMesaUrl(indice);
}

export function todasLasTexturasMesa(): string[] {
  return Array.from({ length: CANTIDAD_TEXTURAS_MESA }, (_, i) =>
    texturaMesaUrl(i + 1)
  );
}
