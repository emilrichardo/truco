"use client";
// Guarda el personaje elegido por el usuario localmente. Como es un juego
// cerrado entre primos, no necesitamos auth: el personaje "es" la identidad.
import { useEffect, useState } from "react";
import { PERSONAJES } from "@/data/jugadores";

const STORAGE_KEY = "truco_primos_mi_personaje";

export function leerPersonajeLocal(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function guardarPersonajeLocal(slug: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, slug);
}

/**
 * Hook que devuelve [slug, setSlug, listo].
 * `listo` empieza en false y pasa a true cuando ya se leyó del localStorage,
 * para evitar parpadeos de SSR vs cliente.
 */
export function usePersonajeLocal(): [string | null, (s: string) => void, boolean] {
  const [slug, setSlug] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const guardado = leerPersonajeLocal();
    if (guardado && PERSONAJES.some((p) => p.slug === guardado)) {
      setSlug(guardado);
    }
    setListo(true);
  }, []);

  const set = (s: string) => {
    guardarPersonajeLocal(s);
    setSlug(s);
  };

  return [slug, set, listo];
}
