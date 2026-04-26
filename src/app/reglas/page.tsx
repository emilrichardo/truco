import Link from "next/link";

export default function ReglasPage() {
  return (
    <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
      <Link href="/" className="label-slim hover:text-truco-gold">
        ← Volver
      </Link>
      <h1 className="font-display text-4xl text-truco-gold mt-2 mb-6">
        Reglas del Truco Argentino
      </h1>

      <div className="parchment rounded-xl p-6 space-y-6 text-truco-dark">
        <section>
          <h2 className="font-display text-2xl text-truco-red mb-2">El mazo</h2>
          <p>
            Se juega con la baraja española de <strong>40 cartas</strong> (sin 8, 9 ni
            comodines). Los palos son <em>espada</em>, <em>basto</em>, <em>oro</em> y{" "}
            <em>copa</em>. Cada jugador recibe <strong>3 cartas</strong>.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-truco-red mb-2">Jerarquía de cartas</h2>
          <p>De mayor a menor:</p>
          <ol className="list-decimal pl-5 space-y-0.5">
            <li>1 de espada (macho)</li>
            <li>1 de basto</li>
            <li>7 de espada</li>
            <li>7 de oro</li>
            <li>Todos los 3</li>
            <li>Todos los 2</li>
            <li>1 de copa y 1 de oro (falsos)</li>
            <li>Todos los 12 (Reyes)</li>
            <li>Todos los 11 (Caballos)</li>
            <li>Todos los 10 (Sotas)</li>
            <li>7 de copa y 7 de basto</li>
            <li>Todos los 6, 5 y 4</li>
          </ol>
        </section>

        <section>
          <h2 className="font-display text-2xl text-truco-red mb-2">Objetivo</h2>
          <p>
            Ganar la cantidad de puntos elegida: <strong>15 (corto)</strong> o{" "}
            <strong>30 (largo)</strong>. Los puntos se cuentan visualmente con{" "}
            <strong>fósforos</strong> — cuatro parados y uno cruzado equivalen a 5 puntos.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-truco-red mb-2">El envido</h2>
          <p>
            Se canta sólo en la primera baza. Suma 20 si tenés dos cartas del mismo palo
            más los valores de esas dos. Si las tres son de palos distintos vale tu carta
            más alta. Las figuras (10, 11, 12) valen 0; el resto, su número.
          </p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>
              <strong>Envido</strong>: gana 2 si lo quieren, 1 si no. Se puede cantar dos
              veces seguidas.
            </li>
            <li>
              <strong>Real envido</strong>: sube a 3 si lo quieren.
            </li>
            <li>
              <strong>Falta envido</strong>: si lo quieren, gana los puntos que le faltan al
              que va arriba para terminar la partida.
            </li>
          </ul>
          <p className="italic text-sm">
            Empate de envido: gana el equipo del jugador <strong>mano</strong> (el que
            recibe primero las cartas y juega primero).
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-truco-red mb-2">El truco</h2>
          <p>
            El que cree tener mejor mano puede cantar truco. Vale 2 si lo quieren, 1 si
            no. El equipo contrario puede aceptar, rechazar o subir.
          </p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>
              <strong>Truco</strong>: vale 2 querido / 1 no querido.
            </li>
            <li>
              <strong>Quiero retruco</strong>: vale 3 / 2.
            </li>
            <li>
              <strong>Vale cuatro</strong>: vale 4 / 3.
            </li>
          </ul>
          <p>
            Sólo puede subir el canto el equipo que recibió el último canto. Si rechazás,
            el otro equipo se lleva los puntos del canto inmediato anterior.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-truco-red mb-2">Desarrollo de la mano</h2>
          <ol className="list-decimal pl-5 space-y-0.5">
            <li>El "mano" arranca tirando una carta.</li>
            <li>Cada jugador tira una. Gana la baza la carta más alta.</li>
            <li>
              Se juegan hasta tres bazas. Gana la mano el equipo que gana 2 bazas.
            </li>
            <li>
              <strong>Pardas</strong>: si una baza empata, define la siguiente. Si las tres
              son pardas, gana el equipo del mano.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="font-display text-2xl text-truco-red mb-2">Mazo (irse)</h2>
          <p>
            En cualquier momento podés "irte al mazo". Cedés la mano: el otro equipo se
            lleva los puntos del truco vigente y, si hay envido pendiente, el punto.
          </p>
        </section>

        <section className="text-sm italic text-truco-dark/70 border-t border-truco-dark/20 pt-3">
          Esta versión no incluye flor. Hay variantes regionales: cuando algo no está
          claro, la mesa decide. La regla de oro: el que canta truco no se equivoca.
        </section>
      </div>
    </main>
  );
}
