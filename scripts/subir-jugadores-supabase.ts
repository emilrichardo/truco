// Optimiza los avatares de public/jugadores y los sube a Supabase Storage.
//
// Requisitos:
//   - NEXT_PUBLIC_SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//   - cwebp instalado en el sistema
//
// Uso:
//   npm run avatars:upload
//
// Sólo optimizar sin subir:
//   SKIP_UPLOAD=1 npm run avatars:upload

import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PERSONAJES } from "../src/data/jugadores";

try {
  process.loadEnvFile?.(path.join(process.cwd(), ".env.local"));
} catch {
  // .env.local puede no existir en CI.
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_JUGADORES_BUCKET || "jugadores";
const WIDTH = Number(process.env.AVATAR_WIDTH || 360);
const QUALITY = Number(process.env.AVATAR_QUALITY || 74);
const SKIP_UPLOAD = process.env.SKIP_UPLOAD === "1";

const ROOT = process.cwd();
const INPUT_DIR = path.join(ROOT, "public", "jugadores");
const OUT_DIR = path.join(ROOT, ".generated", "jugadores");
let supabase: SupabaseClient | null = null;
let bucketListo = false;

function run(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} salió con código ${code}`));
    });
  });
}

async function existe(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function buscarFuente(slug: string): Promise<string> {
  const png = path.join(INPUT_DIR, `${slug}.png`);
  if (await existe(png)) return png;
  const webp = path.join(INPUT_DIR, `${slug}.webp`);
  if (await existe(webp)) return webp;
  throw new Error(`No encontré fuente para ${slug} en public/jugadores`);
}

async function optimizar(slug: string): Promise<{ file: string; bytes: number }> {
  const input = await buscarFuente(slug);
  const out = path.join(OUT_DIR, `${slug}.webp`);
  await run("cwebp", [
    "-quiet",
    "-q",
    String(QUALITY),
    "-resize",
    String(WIDTH),
    "0",
    input,
    "-o",
    out
  ]);
  const info = await stat(out);
  return { file: out, bytes: info.size };
}

function supabaseAdmin(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  if (supabase) return supabase;
  supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false }
  });
  return supabase;
}

async function asegurarBucket(sb: SupabaseClient) {
  if (bucketListo) return;
  const opciones = {
    public: true,
    fileSizeLimit: 1024 * 256,
    allowedMimeTypes: ["image/webp", "image/avif", "image/png", "image/jpeg"]
  };
  const { error: getError } = await sb.storage.getBucket(BUCKET);
  if (getError) {
    const { error: createError } = await sb.storage.createBucket(
      BUCKET,
      opciones
    );
    if (createError) throw createError;
  } else {
    const { error: updateError } = await sb.storage.updateBucket(
      BUCKET,
      opciones
    );
    if (updateError) throw updateError;
  }
  bucketListo = true;
}

async function subir(file: string, objectName: string) {
  const sb = supabaseAdmin();
  await asegurarBucket(sb);
  const bytes = await readFile(file);
  const { error } = await sb.storage.from(BUCKET).upload(
    objectName,
    bytes,
    {
      cacheControl: "31536000",
      contentType: "image/webp",
      upsert: true
    }
  );
  if (error) throw error;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const disponibles = new Set(
    (await readdir(INPUT_DIR))
      .filter((f) => /\.(png|webp)$/i.test(f))
      .map((f) => f.replace(/\.(png|webp)$/i, ""))
  );

  let total = 0;
  for (const p of PERSONAJES) {
    if (!disponibles.has(p.slug)) {
      throw new Error(`Falta imagen fuente para ${p.slug}`);
    }
    const { file, bytes } = await optimizar(p.slug);
    total += bytes;
    const kb = Math.round(bytes / 1024);
    if (!SKIP_UPLOAD) await subir(file, `${p.slug}.webp`);
    console.log(
      `${SKIP_UPLOAD ? "optimizado" : "subido"} ${p.slug}.webp (${kb} KB)`
    );
  }
  console.log(`Total optimizado: ${Math.round(total / 1024)} KB`);
  if (SKIP_UPLOAD) {
    console.log("SKIP_UPLOAD=1: no se subió nada a Supabase.");
  }
}

main().catch((err) => {
  console.error("No se pudieron procesar los avatares:", err);
  process.exit(1);
});
