// Almacén local de audios personalizados por canto. Vive en IndexedDB —
// los blobs de audio (5-10 KB cada uno) son demasiado grandes para
// localStorage y queremos persistencia entre sesiones.
//
// Clave: `${slugPersonaje}:${canto}` — atado al primo (no al jugadorId
// que cambia entre partidas) para que mis cantos queden fijos aunque
// abandone y vuelva a entrar.
//
// Cantos soportados: envido, real_envido, falta_envido, truco, retruco,
// vale4, quiero, no_quiero. NO incluye "ir al mazo" (pedido del usuario).

export type CantoConAudio =
  | "envido"
  | "real_envido"
  | "falta_envido"
  | "truco"
  | "retruco"
  | "vale4"
  | "quiero"
  | "no_quiero";

export const CANTOS_CON_AUDIO: { canto: CantoConAudio; label: string }[] = [
  { canto: "envido", label: "Envido" },
  { canto: "real_envido", label: "Real envido" },
  { canto: "falta_envido", label: "Falta envido" },
  { canto: "truco", label: "Truco" },
  { canto: "retruco", label: "Retruco" },
  { canto: "vale4", label: "Vale 4" },
  { canto: "quiero", label: "Quiero" },
  { canto: "no_quiero", label: "No quiero" }
];

const DB_NAME = "truco-audios";
const STORE = "cantos";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no disponible"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function clave(slug: string, canto: CantoConAudio) {
  return `${slug}:${canto}`;
}

export async function guardarAudio(
  slug: string,
  canto: CantoConAudio,
  blob: Blob
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, clave(slug, canto));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function leerAudio(
  slug: string,
  canto: CantoConAudio
): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(clave(slug, canto));
    req.onsuccess = () => resolve((req.result as Blob | undefined) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function borrarAudio(
  slug: string,
  canto: CantoConAudio
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(clave(slug, canto));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Lista qué cantos tienen audio guardado para un primo. */
export async function listarCantosConAudio(
  slug: string
): Promise<Set<CantoConAudio>> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAllKeys();
    req.onsuccess = () => {
      const out = new Set<CantoConAudio>();
      const prefijo = `${slug}:`;
      for (const k of req.result as string[]) {
        if (typeof k === "string" && k.startsWith(prefijo)) {
          out.add(k.slice(prefijo.length) as CantoConAudio);
        }
      }
      resolve(out);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Convierte un Blob a data URL (base64). Útil para mandar por chat. */
export function blobADataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Mapea un AccionTipo de canto al canto guardable. Devuelve null si la
 *  acción no tiene audio personalizable (ej. mazo, jugar_carta). */
export function cantoDeAccion(tipo: string): CantoConAudio | null {
  switch (tipo) {
    case "cantar_envido":
      return "envido";
    case "cantar_real_envido":
      return "real_envido";
    case "cantar_falta_envido":
      return "falta_envido";
    case "cantar_truco":
      return "truco";
    case "cantar_retruco":
      return "retruco";
    case "cantar_vale4":
      return "vale4";
    case "responder_quiero":
      return "quiero";
    case "responder_no_quiero":
      return "no_quiero";
    default:
      return null;
  }
}
