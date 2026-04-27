// Lista las pistas MP3 que haya en /public/audio/musica/. El frontend las
// reproduce en orden, una atrás de la otra. Para agregar música nueva,
// dejar el archivo .mp3 en esa carpeta — no requiere tocar código.
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

// Revalida cada 5 minutos para detectar pistas nuevas sin redeploy.
export const revalidate = 300;

export async function GET() {
  const dir = path.join(process.cwd(), "public", "audio", "musica");
  let pistas: string[] = [];
  try {
    pistas = fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".mp3"))
      .sort();
  } catch {
    // Sin carpeta o sin archivos → lista vacía, el player no muestra UI.
  }
  return NextResponse.json({ pistas });
}
