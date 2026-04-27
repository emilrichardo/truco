"use client";
// Preload de imágenes en background para que cuando se renderizan ya están
// en cache del browser. Las imágenes se sirven en WebP (~50-150KB cada una).
import { useEffect } from "react";

const PALOS = ["espada", "basto", "oro", "copa"] as const;
const NUMEROS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;

let cartasYaPrecargadas = false;

/** Pre-cachea las 40 cartas españolas. Idempotente: solo corre la primera vez. */
export function precargarCartas() {
  if (typeof window === "undefined") return;
  if (cartasYaPrecargadas) return;
  cartasYaPrecargadas = true;
  // Disparamos en orden lo más pequeño primero (cabezas / figuras)
  // para que las que más se ven (los 1, 7, etc.) lleguen rápido.
  const orden: { palo: string; numero: number }[] = [];
  for (const n of NUMEROS) {
    for (const p of PALOS) orden.push({ palo: p, numero: n });
  }
  // Espaciamos un poco para no saturar la red ni bloquear navegación.
  orden.forEach(({ palo, numero }, i) => {
    setTimeout(() => {
      const img = new Image();
      img.src = `/cartas/${palo}/${numero}.webp`;
    }, i * 30);
  });
}

/** Pre-cachea avatares de los jugadores presentes. */
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
