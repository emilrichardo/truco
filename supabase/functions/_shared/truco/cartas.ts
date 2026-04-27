// Mazo de truco (40 cartas), jerarquía y cálculos de envido.
import type { Carta, Numero, Palo } from "./types.ts";

export const PALOS: Palo[] = ["espada", "basto", "oro", "copa"];
export const NUMEROS: Numero[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

export function nombrePalo(p: Palo): string {
  return { espada: "Espada", basto: "Basto", oro: "Oro", copa: "Copa" }[p];
}

export function nombreNumero(n: Numero): string {
  if (n === 10) return "Sota";
  if (n === 11) return "Caballo";
  if (n === 12) return "Rey";
  return String(n);
}

export function nombreCarta(c: Carta): string {
  return `${nombreNumero(c.numero)} de ${nombrePalo(c.palo)}`;
}

export function crearMazo(): Carta[] {
  const mazo: Carta[] = [];
  for (const p of PALOS) {
    for (const n of NUMEROS) {
      mazo.push({ palo: p, numero: n, id: `${p}-${n}` });
    }
  }
  return mazo;
}

export function mezclar<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Jerarquía del truco (mayor a menor). Devuelve un valor numérico — más alto = mejor carta.
 * 1 espada > 1 basto > 7 espada > 7 oro > todos los 3 > todos los 2 > 1 copa = 1 oro
 *  > todos los 12 > todos los 11 > todos los 10 > 7 copa = 7 basto > 6 > 5 > 4
 */
export function jerarquia(c: Carta): number {
  const { palo, numero } = c;
  if (numero === 1 && palo === "espada") return 14;
  if (numero === 1 && palo === "basto") return 13;
  if (numero === 7 && palo === "espada") return 12;
  if (numero === 7 && palo === "oro") return 11;
  if (numero === 3) return 10;
  if (numero === 2) return 9;
  if (numero === 1) return 8; // 1 copa o 1 oro (falsos)
  if (numero === 12) return 7;
  if (numero === 11) return 6;
  if (numero === 10) return 5;
  if (numero === 7) return 4; // 7 copa, 7 basto
  if (numero === 6) return 3;
  if (numero === 5) return 2;
  if (numero === 4) return 1;
  return 0;
}

export function comparar(a: Carta, b: Carta): number {
  return jerarquia(a) - jerarquia(b);
}

/** Valor de una carta para envido: figuras (10,11,12) valen 0; resto su número. */
export function valorEnvidoCarta(c: Carta): number {
  if (c.numero >= 10) return 0;
  return c.numero;
}

/**
 * Calcula el envido de una mano de 3 cartas según las reglas argentinas:
 * - Si hay dos o más del mismo palo: 20 + suma de las dos más altas de ese palo.
 * - Si las tres son de distinto palo: la carta de mayor valor de envido.
 */
export function calcularEnvido(mano: Carta[]): number {
  if (mano.length === 0) return 0;
  const porPalo = new Map<Palo, Carta[]>();
  for (const c of mano) {
    const arr = porPalo.get(c.palo) || [];
    arr.push(c);
    porPalo.set(c.palo, arr);
  }
  let mejor = 0;
  for (const cartas of porPalo.values()) {
    if (cartas.length >= 2) {
      const valores = cartas
        .map(valorEnvidoCarta)
        .sort((a, b) => b - a)
        .slice(0, 2);
      const total = 20 + valores[0] + valores[1];
      if (total > mejor) mejor = total;
    }
  }
  if (mejor === 0) {
    // No hay dos del mismo palo: vale la carta más alta.
    mejor = Math.max(...mano.map(valorEnvidoCarta));
  }
  return mejor;
}
