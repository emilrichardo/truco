import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Accion, EstadoJuego } from "@/lib/truco/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      estado?: EstadoJuego;
      actorId?: string;
      sugerencia?: Accion | null;
      accionFinal?: Accion | null;
      aprobada?: boolean;
      origen?: string;
      criterios?: string[];
      notas?: string;
    };

    if (!body.estado || !body.actorId || !body.accionFinal) {
      return NextResponse.json(
        { ok: false, error: "Faltan `estado`, `actorId` o `accionFinal`." },
        { status: 400 }
      );
    }

    const actor =
      body.estado.jugadores.find((j) => j.id === body.actorId) || null;
    const mano = body.estado.manoActual;
    const notasCompuestas = [
      body.criterios?.length
        ? `Criterios: ${body.criterios.join(", ")}`
        : null,
      body.notas?.trim() || null
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase.from("entrenamiento_feedback").insert({
        sala_id: body.estado.salaId,
        mano_numero: mano?.numero ?? null,
        actor_jugador_id: body.actorId,
        actor_nombre: actor?.nombre ?? body.actorId,
        aprobada: body.aprobada ?? false,
        origen: body.origen ?? "web",
        notas: notasCompuestas || null,
        sugerencia: body.sugerencia ?? null,
        accion_final: body.accionFinal,
        estado_snapshot: body.estado
      });

      if (error) throw error;

      return NextResponse.json({ ok: true, guardado: true });
    } catch {
      return NextResponse.json({
        ok: true,
        guardado: false,
        aviso:
          "Feedback recibido sin persistencia. Falta configurar Supabase service role o la tabla de entrenamiento."
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "No se pudo registrar el feedback."
      },
      { status: 400 }
    );
  }
}
