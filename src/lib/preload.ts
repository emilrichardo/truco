"use client";
// Preload de imágenes en background para que cuando se renderizan ya están
// en cache del browser.
import { useEffect } from "react";

const PALOS = ["espada", "basto", "oro", "copa"] as const;
const NUMEROS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;

let cartasYaPrecargadas = false;

/** Pre-cachea las 40 cartas españolas. Idempotente: solo corre la primera vez.
 *  Antes espaciábamos los fetches a 30ms (= ~1.2s para empezar el último);
 *  con HTTP/2 multiplex el browser maneja bien fetches paralelos así que
 *  ahora disparamos todo de una y priorizamos las "bravas" (las que más
 *  se ven en baza 1). Cuando arranca la mano, las cartas ya están en
 *  cache HTTP. */
export function precargarCartas() {
  if (typeof window === "undefined") return;
  if (cartasYaPrecargadas) return;
  cartasYaPrecargadas = true;
  const PRIORIDAD: { palo: string; numero: number }[] = [
    { palo: "espada", numero: 1 },
    { palo: "basto", numero: 1 },
    { palo: "espada", numero: 7 },
    { palo: "oro", numero: 7 }
  ];
  const RESTO: { palo: string; numero: number }[] = [];
  for (const n of NUMEROS) {
    for (const p of PALOS) {
      if (!PRIORIDAD.some((c) => c.palo === p && c.numero === n)) {
        RESTO.push({ palo: p, numero: n });
      }
    }
  }
  for (const { palo, numero } of [...PRIORIDAD, ...RESTO]) {
    const img = new Image();
    img.decoding = "async";
    img.src = `/cartas/${palo}/${numero}.webp`;
  }
}

/** Pre-cachea avatares de los jugadores presentes. Apunta al webp para
 *  matchear lo que sirve urlPersonaje (mucho más liviano que el PNG). */
export function precargarAvatares(slugs: string[]) {
  if (typeof window === "undefined") return;
  for (const s of slugs) {
    const img = new Image();
    img.src = `/jugadores/${s}.webp`;
  }
}

export function usePreloadCartas() {
  useEffect(() => {
    precargarCartas();
  }, []);
}

export function usePreloadAvatares(slugs: string[]) {
  useEffect(() => {
    if (slugs.length) precargarAvatares(slugs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugs.join("|")]);
}
