import { NextResponse } from "next/server";
import { crearSnapshotEntrenamiento, aplicarDecisionEntrenamiento } from "@/lib/truco/entrenamiento";
import type { Accion, EstadoJuego } from "@/lib/truco/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      estado?: EstadoJuego;
      actorId?: string;
      accion?: Accion;
    };
    if (!body.estado) {
      return NextResponse.json(
        { ok: false, error: "Falta `estado`." },
        { status: 400 }
      );
    }
    const snapshot = body.accion
      ? aplicarDecisionEntrenamiento(body.estado, body.accion, body.actorId)
      : crearSnapshotEntrenamiento(body.estado, body.actorId);
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "No se pudo avanzar el entrenamiento."
      },
      { status: 400 }
    );
  }
}
