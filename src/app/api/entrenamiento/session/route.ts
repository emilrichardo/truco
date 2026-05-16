import { NextResponse } from "next/server";
import {
  crearEstadoEntrenamiento,
  crearSnapshotEntrenamiento
} from "@/lib/truco/entrenamiento";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      tamanio?: 2 | 4;
      puntosObjetivo?: 18 | 30;
    };
    const estado = crearEstadoEntrenamiento(body);
    const snapshot = crearSnapshotEntrenamiento(estado);
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "No se pudo crear la sesión."
      },
      { status: 400 }
    );
  }
}
