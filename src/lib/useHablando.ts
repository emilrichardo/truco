"use client";
// Hook compartido: detecta el último canto/respuesta del chat (o el último
// sticker enviado por un humano) y devuelve quién habló, qué dijo y de qué
// tipo. JugadorPanel/MiAvatarBR lo usan para mostrar la burbuja al lado del
// avatar y para hacer pulsar la foto del que está hablando.
import { useEffect, useRef, useState } from "react";
import type {
  CategoriaEvento,
  EstadoJuego,
  MensajeChat
} from "@/lib/truco/types";

const DURACION_MS = 3500;
const DURACION_STICKER_MS = 4500;
const DESTACAR = new Set<CategoriaEvento>(["canto", "respuesta"]);

function calcularDuracion(texto: string): number {
  return Math.max(2500, Math.min(6000, texto.length * 70 + 1500));
}

export type HablandoData = {
  id: string;
  key: string;
  texto: string;
  evento: CategoriaEvento | null;
  sticker?: string;
  reaccion?: string;
};

function esBurbuja(m: MensajeChat): boolean {
  if (m.evento && DESTACAR.has(m.evento)) return true;
  if (!m.evento && m.sticker && !m.destinatarioId) return true;
  // Reacciones públicas (emoji enviado vía BarraEmociones) — toast
  // efímero sobre el avatar del que reaccionó.
  if (!m.evento && m.reaccion && !m.destinatarioId) return true;
  return false;
}

export function useHablando(estado: EstadoJuego | null): {
  hablandoId: string | null;
  hablandoKey: string | null;
  hablandoTexto: string | null;
  hablandoEvento: CategoriaEvento | null;
  hablandoSticker: string | null;
  hablandoReaccion: string | null;
} {
  const [data, setData] = useState<HablandoData | null>(null);
  const ultimoIdRef = useRef<string | null>(null);
  const tRef = useRef<number | null>(null);

  // OJO: en modo Solo el chat se muta in-place (misma referencia de array)
  // y `{...estado}` solo cambia el wrapper. Por eso usamos `version` (que el
  // motor incrementa en cada acción) + length como deps. El gate por id
  // dentro del effect evita re-disparar cuando no hay un evento nuevo.
  const versionDep = estado?.version ?? 0;
  const lenDep = estado?.chat.length ?? 0;
  const manoNum = estado?.manoActual?.numero ?? 0;
  const manoNumRef = useRef<number>(manoNum);

  // Cuando arranca una mano nueva (se reparten cartas), borramos la
  // burbuja del canto/respuesta anterior para no superponerla con el
  // reparto. Si llegan eventos nuevos en la misma mano, el effect de
  // abajo los muestra normalmente.
  useEffect(() => {
    if (manoNum !== manoNumRef.current) {
      manoNumRef.current = manoNum;
      if (tRef.current) {
        clearTimeout(tRef.current);
        tRef.current = null;
      }
      setData(null);
    }
  }, [manoNum]);

  useEffect(() => {
    if (!estado) return;
    const ultimo = [...estado.chat].reverse().find(esBurbuja);
    if (!ultimo) return;
    if (ultimoIdRef.current === ultimo.id) return;
    ultimoIdRef.current = ultimo.id;

    const esSticker = !!ultimo.sticker && !ultimo.evento;
    const esReaccion = !!ultimo.reaccion && !ultimo.evento;
    setData({
      id: ultimo.jugadorId,
      key: ultimo.id,
      texto: ultimo.texto || "",
      evento: ultimo.evento ?? null,
      sticker: esSticker ? ultimo.sticker : undefined,
      reaccion: esReaccion ? ultimo.reaccion : undefined
    });
    if (tRef.current) {
      clearTimeout(tRef.current);
      tRef.current = null;
    }
    // Si la burbuja es de un canto (envido/truco) y todavía no se
    // resolvió, NO le ponemos timer: tiene que quedar hasta que el rival
    // conteste. Así el "Truco" del compañero no desaparece a los 4s y
    // dejás de saber qué te están preguntando. Cuando llega la respuesta,
    // ese mensaje se vuelve el "ultimo" y reemplaza la burbuja.
    const cantoPendiente =
      ultimo.evento === "canto" &&
      !!estado.manoActual &&
      (!!estado.manoActual.envidoCantoActivo ||
        !!estado.manoActual.trucoCantoActivo);
    if (cantoPendiente) return;
    const ms = esSticker
      ? DURACION_STICKER_MS
      : calcularDuracion(ultimo.texto) + DURACION_MS / 4;
    tRef.current = window.setTimeout(() => {
      setData(null);
      tRef.current = null;
    }, ms);
  }, [estado, versionDep, lenDep]);

  useEffect(() => {
    return () => {
      if (tRef.current) clearTimeout(tRef.current);
    };
  }, []);

  return {
    hablandoId: data?.id || null,
    hablandoKey: data?.key || null,
    hablandoTexto: data?.texto || null,
    hablandoEvento: data?.evento || null,
    hablandoSticker: data?.sticker || null,
    hablandoReaccion: data?.reaccion || null
  };
}
