// Precarga las 40 cartas españolas via <link rel="preload"> para que no
// haya delay cuando se renderean en la mano. Modern browsers procesan
// los preload tags estén en head o body — los emitimos como children
// del page durante la partida.
//
// Si no precargamos, la primera vez que el browser ve una carta
// arranca el fetch de la webp en ese momento y se nota un "pop" en el
// reparto. Con preload, todas están en cache HTTP cuando se renderean.

const PALOS = ["espada", "basto", "oro", "copa"] as const;
const NUMEROS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;

export function PrecargaCartas() {
  return (
    <>
      {PALOS.flatMap((palo) =>
        NUMEROS.map((num) => (
          <link
            key={`${palo}-${num}`}
            rel="preload"
            as="image"
            href={`/cartas/${palo}/${num}.webp`}
            type="image/webp"
          />
        ))
      )}
    </>
  );
}
