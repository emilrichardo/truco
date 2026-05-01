"use client";
// Módulo de coordinación entre PanelAcciones y Mesa: cuando el usuario
// suelta una carta, PanelAcciones marca el cartaId como "lanzando".
// Mesa lee este Set y oculta la carta canónica/optimista de su lugar
// mientras dura la animación. Apenas el dragged-card desmonta,
// PanelAcciones desmarca, Mesa la pinta — sin gap visible.
//
// Vivimos a nivel módulo (no Context) para evitar pasar props por
// toda la jerarquía. Suscripción tipo "sub/notify" para que Mesa
// re-renderee cuando cambie el set.
import { useEffect, useState } from "react";

const lanzando = new Set<string>();
const subs = new Set<() => void>();

function notify() {
  subs.forEach((fn) => fn());
}

export function marcarLanzando(cartaId: string) {
  lanzando.add(cartaId);
  notify();
}

export function desmarcarLanzando(cartaId: string) {
  lanzando.delete(cartaId);
  notify();
}

export function estaLanzando(cartaId: string): boolean {
  return lanzando.has(cartaId);
}

/** Hook para que un componente se re-renderee cuando cambia el set
 *  de cartas lanzando. Devuelve un Set inmutable copy. */
export function useCartasLanzando(): Set<string> {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  }, []);
  return new Set(lanzando);
}
