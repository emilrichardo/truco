import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { Equipo, EstadoJuego } from "./truco/types.ts";

export const MAX_DURACION_SALA_MS = 60 * 60 * 1000;

export interface SalaRow {
  id: string;
  modo: "1v1" | "2v2";
  puntos_objetivo: 18 | 30;
  created_at: string;
  estado: EstadoJuego;
  iniciada?: boolean;
  terminada?: boolean;
}

export function salaExpirada(sala: { created_at: string }): boolean {
  return Date.now() - new Date(sala.created_at).getTime() >= MAX_DURACION_SALA_MS;
}

export function equipoGanadorPorPuntos(
  estado: EstadoJuego,
  jugadorQueSaleId?: string
): Equipo {
  if (estado.puntos[0] > estado.puntos[1]) return 0;
  if (estado.puntos[1] > estado.puntos[0]) return 1;

  const jugador = jugadorQueSaleId
    ? estado.jugadores.find((j) => j.id === jugadorQueSaleId)
    : undefined;
  if (jugador) return jugador.equipo === 0 ? 1 : 0;
  return 0;
}

export function marcarEstadoTerminado(
  estado: EstadoJuego,
  ganador: Equipo,
  texto: string
) {
  estado.ganadorPartida = ganador;
  if (estado.manoActual) estado.manoActual.fase = "terminada";
  estado.chat.push({
    id: crypto.randomUUID().slice(0, 8),
    jugadorId: "",
    texto,
    ts: Date.now(),
    evento: "sistema"
  });
  if (estado.chat.length > 200) estado.chat.shift();
  estado.version = (estado.version || 0) + 1;
}

export async function registrarPartidaTerminada(
  sb: SupabaseClient,
  sala: SalaRow,
  estado: EstadoJuego
) {
  if (estado.ganadorPartida === null) return;

  const { data: partida, error: errPart } = await sb
    .from("partidas")
    .insert({
      sala_id: sala.id,
      modo: sala.modo,
      puntos_objetivo: sala.puntos_objetivo,
      ganador_equipo: estado.ganadorPartida,
      duracion_seg: Math.round(
        (Date.now() - new Date(sala.created_at).getTime()) / 1000
      ),
      estado_final: estado
    })
    .select()
    .single();

  if (errPart || !partida) return;

  const filas = await Promise.all(
    estado.jugadores.map(async (j) => {
      const { data: perfiles } = await sb
        .from("perfiles")
        .select("id")
        .eq("nombre", j.nombre)
        .eq("personaje", j.personaje)
        .order("created_at", { ascending: true })
        .limit(1);
      const perfilId = perfiles && perfiles[0] ? perfiles[0].id : null;
      return {
        partida_id: partida.id,
        perfil_id: perfilId,
        nombre: j.nombre,
        personaje: j.personaje,
        equipo: j.equipo,
        asiento: j.asiento,
        es_bot: j.esBot,
        gano: estado.ganadorPartida === j.equipo,
        puntos_finales:
          j.equipo === 0 ? estado.puntos[0] : estado.puntos[1]
      };
    })
  );
  await sb.from("partida_jugadores").insert(filas);
}

export async function finalizarSalaConGanador(
  sb: SupabaseClient,
  sala: SalaRow,
  texto: string,
  jugadorQueSaleId?: string
) {
  const estado = sala.estado as EstadoJuego;
  const ganador = equipoGanadorPorPuntos(estado, jugadorQueSaleId);
  marcarEstadoTerminado(estado, ganador, texto);
  await registrarPartidaTerminada(sb, sala, estado);

  const { error } = await sb
    .from("salas")
    .update({
      estado,
      terminada: true,
      ganador_equipo: ganador,
      terminada_at: new Date().toISOString()
    })
    .eq("id", sala.id);

  if (error) throw error;
  return { estado, ganador };
}
