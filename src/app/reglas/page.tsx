import Link from "next/link";
import { HeaderMarca, DivisorCriollo } from "@/components/HeaderMarca";

export default function ReglasPage() {
  return (
    <main className="min-h-[100dvh] px-4 py-5 max-w-2xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-text-dim text-xs hover:text-dorado transition mb-3"
      >
        <span>←</span> Volver
      </Link>

      <HeaderMarca variante="compacto" />

      <DivisorCriollo className="my-5" />

      <h1 className="titulo-marca text-2xl md:text-3xl text-center mb-2">
        Reglas del <span className="acento">Truco</span>
      </h1>
      <p className="text-center text-text-dim text-xs subtitulo-claim mb-5">
        Versión criolla — sin flor
      </p>

      <article className="papel p-5 md:p-6 space-y-5 text-sm leading-relaxed">
        <Seccion titulo="El mazo">
          Baraja española de 40 cartas (sin 8, 9 ni comodines). Palos: espada,
          basto, oro y copa. Cada jugador recibe 3 cartas.
        </Seccion>

        <Seccion titulo="Jerarquía">
          <ol className="list-decimal pl-5 space-y-0.5">
            <li>1 de espada</li>
            <li>1 de basto</li>
            <li>7 de espada</li>
            <li>7 de oro</li>
            <li>Todos los 3</li>
            <li>Todos los 2</li>
            <li>1 de copa y 1 de oro (falsos)</li>
            <li>Todos los 12, 11, 10</li>
            <li>7 de copa, 7 de basto</li>
            <li>Todos los 6, 5 y 4</li>
          </ol>
        </Seccion>

        <Seccion titulo="Objetivo">
          Llegar a 15 (corto) o 30 (largo). Los puntos se cuentan en fósforos:
          cuatro parados y uno cruzado = 5 puntos.
        </Seccion>

        <Seccion titulo="Envido">
          <p>
            Sólo en la primera baza. Si tenés dos del mismo palo: 20 + suma de
            esas dos. Si las tres son distintas: tu carta más alta. Las figuras
            (10, 11, 12) valen 0.
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-0.5">
            <li>Envido: 2 querido / 1 no querido. Se puede cantar dos veces.</li>
            <li>Real envido: 3 querido / 1.</li>
            <li>Falta envido: si lo aceptan, gana lo que le falta al puntero.</li>
          </ul>
          <p className="text-xs italic mt-2 opacity-70">
            Empate: gana el equipo del jugador "mano".
          </p>
        </Seccion>

        <Seccion titulo="Truco">
          <ul className="list-disc pl-5 space-y-0.5">
            <li>Truco: 2 querido / 1 no querido.</li>
            <li>Quiero retruco: 3 / 2.</li>
            <li>Vale cuatro: 4 / 3.</li>
          </ul>
          <p className="mt-2">
            Sólo puede subir el equipo que recibió el último canto. Si rechazás,
            el otro se lleva los puntos del canto anterior.
          </p>
        </Seccion>

        <Seccion titulo="Bazas">
          <ol className="list-decimal pl-5 space-y-0.5">
            <li>El mano arranca tirando.</li>
            <li>Cada jugador tira una. Gana la baza la carta más alta.</li>
            <li>Se juegan hasta tres bazas. Gana la mano quien gane dos.</li>
            <li>
              Si una baza queda parda, define la siguiente. Si las tres son
              pardas, gana el equipo del mano.
            </li>
          </ol>
        </Seccion>

        <Seccion titulo="Mazo">
          Te podés ir al mazo en cualquier momento. Cedés la mano: el otro
          equipo se lleva los puntos del truco vigente y, si había envido
          pendiente, también ese punto.
        </Seccion>

        <div className="border-t border-[#b89460] pt-3 text-center subtitulo-claim text-[10px] opacity-70">
          El que canta truco no se equivoca
        </div>
      </article>

      <DivisorCriollo azul className="my-6" />
    </main>
  );
}

function Seccion({
  titulo,
  children
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-lg text-[var(--azul-criollo)] mb-1.5">
        {titulo}
      </h2>
      <div className="text-[#3d2715]">{children}</div>
    </section>
  );
}
