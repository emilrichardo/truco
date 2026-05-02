"use client";
// Capa de cliente para salas online sobre Supabase. Reemplaza el Socket.io
// del custom server. Usa Edge Functions para mutaciones y Realtime para
// recibir el estado actualizado.
import { useEffect, useRef, useState } from "react";
import { tryGetSupabase } from "@/lib/supabase/cliente";
import type { Accion, EstadoJuego } from "@/lib/truco/types";

const ERROR_CONFIG =
  "Supabase no está configurado en este deploy. Pedile al admin que cargue NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel.";

const STORAGE_DEVICE = "truco_primos_device_id";
const STORAGE_SESION = "truco_primos_sesion";
/** ID de la última sala en la que el usuario está jugando. La home la
 *  lee para ofrecer un "Volver a la partida en curso". Se limpia al
 *  cerrar/abandonar sala o cuando la partida termina. */
const STORAGE_SALA_ACTIVA = "truco_primos_sala_activa";

export interface SalaResp {
  ok: boolean;
  error?: string;
  sala_id?: string;
  jugador_id?: string;
  perfil_id?: string;
  asiento?: number;
  sala?: { id: string; estado: EstadoJuego; iniciada: boolean; terminada: boolean };
}

interface SesionLocal {
  salaId: string;
  jugadorId: string;
  perfilId?: string;
}

function deviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(STORAGE_DEVICE);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_DEVICE, id);
  }
  return id;
}

export function guardarSesion(s: SesionLocal) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_SESION + ":" + s.salaId, JSON.stringify(s));
}

export function leerSesion(salaId: string): SesionLocal | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_SESION + ":" + salaId);
  return raw ? JSON.parse(raw) : null;
}

export function marcarSalaActiva(salaId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_SALA_ACTIVA, salaId);
}

export function leerSalaActiva(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_SALA_ACTIVA);
}

export function limpiarSalaActiva(salaId?: string) {
  if (typeof window === "undefined") return;
  // Si pasan un salaId, sólo limpiamos cuando coincide — para no pisar
  // una sala más reciente desde una pestaña vieja.
  if (salaId) {
    const actual = localStorage.getItem(STORAGE_SALA_ACTIVA);
    if (actual !== salaId) return;
  }
  localStorage.removeItem(STORAGE_SALA_ACTIVA);
}

async function invocar<T = SalaResp>(
  fn: string,
  body: Record<string, unknown>
): Promise<T> {
  const sb = tryGetSupabase();
  if (!sb) return { ok: false, error: ERROR_CONFIG } as unknown as T;
  try {
    const { data, error } = await sb.functions.invoke(fn, { body });
    if (error) {
      // supabase-js v2 envuelve los 4xx/5xx en un FunctionsHttpError con
      // mensaje genérico "Edge Function returned a non-2xx status code".
      // El cuerpo real de la respuesta (con el `error` específico que
      // devuelve nuestra function) vive en error.context (un Response).
      // Lo leemos para mostrarle al usuario un mensaje accionable.
      let msg = error.message || "Error desconocido";
      try {
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.clone === "function") {
          const cuerpo = await ctx.clone().json();
          if (cuerpo && typeof cuerpo === "object" && cuerpo.error) {
            msg = `${fn}: ${String(cuerpo.error)}`;
          }
        }
      } catch {
        /* ignore parse errors — usamos el msg genérico */
      }
      console.error(`[supabase] ${fn} error:`, msg, error);
      return { ok: false, error: msg } as unknown as T;
    }
    return data as T;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[supabase] ${fn} excepción:`, msg, e);
    return { ok: false, error: `${fn}: ${msg}` } as unknown as T;
  }
}

export async function crearSalaOnline(payload: {
  nombre: string;
  personaje: string;
  tamanio: 2 | 4;
  puntosObjetivo: 18 | 30;
  conFlor: boolean;
  publica?: boolean;
}): Promise<SalaResp> {
  return invocar("sala-crear", {
    device_id: deviceId(),
    nombre: payload.nombre,
    personaje: payload.personaje,
    tamanio: payload.tamanio,
    puntos_objetivo: payload.puntosObjetivo,
    con_flor: payload.conFlor,
    publica: !!payload.publica
  });
}

export interface SalaPublicaResumen {
  id: string;
  modo: "1v1" | "2v2";
  con_flor: boolean;
  creador: string | null;
  jugadores: number;
  cupos: number;
  created_at: string;
}

export async function listarSalasPublicasOnline(): Promise<{
  salas: SalaPublicaResumen[];
  error: string | null;
}> {
  // Consulta directa a la tabla — la RLS (`salas_select_all`) permite a
  // anon leer salas, así que no hace falta una edge function. Ventaja:
  // funciona apenas se aplica la migración `salas_publicas`, sin deploy
  // adicional. Si la columna `publica` no existe todavía, postgres
  // devuelve un error claro en `error.message`.
  const sb = tryGetSupabase();
  if (!sb) return { salas: [], error: ERROR_CONFIG };

  const { data, error } = await sb
    .from("salas")
    .select("id, modo, estado, created_at, created_by")
    .eq("publica", true)
    .eq("iniciada", false)
    .eq("terminada", false)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.warn("[listarSalasPublicas] error:", error);
    return { salas: [], error: error.message };
  }

  const filas = (data ?? []) as Array<{
    id: string;
    modo: "1v1" | "2v2";
    estado: EstadoJuego;
    created_at: string;
    created_by: string | null;
  }>;

  const perfilIds = Array.from(
    new Set(filas.map((f) => f.created_by).filter((v): v is string => !!v))
  );
  const nombresPorPerfil = new Map<string, string>();
  if (perfilIds.length > 0) {
    const { data: perfiles } = await sb
      .from("perfiles")
      .select("id, nombre")
      .in("id", perfilIds);
    for (const p of perfiles ?? []) {
      nombresPorPerfil.set(p.id as string, p.nombre as string);
    }
  }

  const salas: SalaPublicaResumen[] = filas.map((f) => {
    const cupos = f.modo === "2v2" ? 4 : 2;
    const jugHumanos = (f.estado.jugadores ?? []).filter(
      (j) => !j.esBot
    ).length;
    return {
      id: f.id,
      modo: f.modo,
      con_flor: !!f.estado.conFlor,
      creador: f.created_by
        ? nombresPorPerfil.get(f.created_by) ?? null
        : null,
      jugadores: jugHumanos,
      cupos,
      created_at: f.created_at
    };
  });

  return { salas, error: null };
}

export async function unirseSalaOnline(payload: {
  salaId: string;
  nombre: string;
  personaje: string;
  asientoPreferido?: number;
}): Promise<SalaResp> {
  return invocar("sala-unirse", {
    device_id: deviceId(),
    sala_id: payload.salaId,
    nombre: payload.nombre,
    personaje: payload.personaje,
    asiento_preferido: payload.asientoPreferido
  });
}

export async function iniciarPartidaOnline(
  salaId: string,
  jugadorId?: string,
  mezclarEquipos = false
): Promise<SalaResp> {
  return invocar("sala-iniciar", {
    sala_id: salaId,
    jugador_id: jugadorId,
    mezclar_equipos: mezclarEquipos
  });
}

export async function agregarBotOnline(
  salaId: string,
  jugadorId?: string,
  asiento?: number,
  personaje?: string
): Promise<SalaResp> {
  return invocar("sala-agregar-bot", {
    sala_id: salaId,
    jugador_id: jugadorId,
    asiento,
    personaje
  });
}

export async function cerrarSalaOnline(
  salaId: string,
  jugadorId?: string
): Promise<SalaResp> {
  return invocar("sala-cerrar", { sala_id: salaId, jugador_id: jugadorId });
}

export async function abandonarSalaOnline(
  salaId: string,
  jugadorId: string
): Promise<SalaResp> {
  return invocar("sala-abandonar", {
    sala_id: salaId,
    jugador_id: jugadorId
  });
}

/** Convierte a otro jugador (humano) en bot por inactividad. Lo dispara
 *  cualquier humano cuando otro humano agotó su ventana de turno. */
export async function marcarBotOnline(
  salaId: string,
  jugadorId: string,
  targetJugadorId: string
): Promise<SalaResp> {
  return invocar("sala-marcar-bot", {
    sala_id: salaId,
    jugador_id: jugadorId,
    target_jugador_id: targetJugadorId
  });
}

/** Devuelve el control al jugador (flip esBot=false, conectado=true)
 *  cuando vuelve a la sala después de una desconexión o de haber sido
 *  marcado bot por inactividad. */
export async function reconectarSalaOnline(
  salaId: string,
  jugadorId: string
): Promise<SalaResp> {
  return invocar("sala-reconectar", {
    sala_id: salaId,
    jugador_id: jugadorId
  });
}

export async function enviarAccionOnline(
  salaId: string,
  jugadorId: string,
  accion: Accion
): Promise<SalaResp> {
  return invocar("sala-accion", {
    sala_id: salaId,
    jugador_id: jugadorId,
    accion
  });
}

export async function revanchaOnline(
  salaId: string,
  jugadorId: string
): Promise<SalaResp> {
  return invocar("sala-revancha", {
    sala_id: salaId,
    jugador_id: jugadorId
  });
}

export async function enviarChatOnline(
  salaId: string,
  jugadorId: string,
  msg: {
    texto?: string;
    reaccion?: string;
    sticker?: string;
    destinatarioId?: string;
    audioCantoDataUrl?: string;
    audioCantoTipo?: string;
  }
): Promise<SalaResp> {
  return invocar("sala-chat", {
    sala_id: salaId,
    jugador_id: jugadorId,
    texto: msg.texto,
    reaccion: msg.reaccion,
    sticker: msg.sticker,
    destinatario_id: msg.destinatarioId,
    audio_canto_data_url: msg.audioCantoDataUrl,
    audio_canto_tipo: msg.audioCantoTipo
  });
}

/**
 * Hook: se suscribe a los cambios de una sala vía Supabase Realtime y mantiene
 * el estado actualizado. También hace una lectura inicial por si llegamos a
 * la página después de que la sala fue creada.
 */
export function useSalaOnline(salaId: string | null) {
  const [estado, setEstado] = useState<EstadoJuego | null>(null);
  const [salaMeta, setSalaMeta] = useState<{ iniciada: boolean; terminada: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cargadoInicial = useRef(false);

  useEffect(() => {
    if (!salaId) return;
    const sb = tryGetSupabase();
    if (!sb) {
      setError(ERROR_CONFIG);
      return;
    }
    let activo = true;

    // Lectura inicial.
    (async () => {
      const { data, error: errSel } = await sb
        .from("salas")
        .select("estado, iniciada, terminada")
        .eq("id", salaId)
        .maybeSingle();
      if (!activo) return;
      if (errSel) {
        setError(errSel.message);
        return;
      }
      if (!data) {
        setError("Sala no encontrada");
        return;
      }
      cargadoInicial.current = true;
      setEstado(data.estado as EstadoJuego);
      setSalaMeta({ iniciada: data.iniciada, terminada: data.terminada });
    })();

    // Suscripción Realtime — UPDATEs en la fila de esta sala.
    const canal = sb
      .channel(`sala:${salaId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "salas", filter: `id=eq.${salaId}` },
        (payload) => {
          const nuevo = payload.new as { estado: EstadoJuego; iniciada: boolean; terminada: boolean };
          setEstado(nuevo.estado);
          setSalaMeta({ iniciada: nuevo.iniciada, terminada: nuevo.terminada });
        }
      )
      .subscribe();

    return () => {
      activo = false;
      sb.removeChannel(canal);
    };
  }, [salaId]);

  return { estado, salaMeta, error, setEstado };
}
