import type { Metadata } from "next";
import Link from "next/link";
import { HeaderMarca, DivisorCriollo } from "@/components/HeaderMarca";

export const metadata: Metadata = {
  title: "Reglas del truco argentino",
  description:
    "Cómo se juega al truco argentino: envido, real envido, falta envido, truco, retruco, vale cuatro y reglas de la mesa. Pensado para los primos que recién arrancan.",
  alternates: { canonical: "/reglas" },
  openGraph: {
    title: "Reglas del truco argentino",
    description:
      "Envido, retruco, vale cuatro y todo lo que tenés que saber para no quedar pagando en la mesa.",
    url: "/reglas"
  }
};

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

        <Seccion titulo="El envido está primero">
          <p>
            Si te cantan <strong>truco</strong> antes de que se haya jugado
            ninguna carta de la primera baza, podés cortarlo cantando el
            envido. Se resuelve <strong>primero el envido</strong> y después
            se contesta el truco.
          </p>
          <p className="mt-2">
            Una vez respondido el truco (querido o no querido), ya no se
            puede cantar envido.
          </p>
        </Seccion>

        <div className="border-t border-[#b89460] pt-3 text-center subtitulo-claim text-[10px] opacity-70">
          El que canta truco no se equivoca
        </div>
      </article>

      <DivisorCriollo className="my-6" />

      {/* Reglamento detallado, tomado del manual oficial. Lo dejamos
       *  desplegable para no abrumar a quien sólo viene a chequear lo básico. */}
      <article className="papel p-5 md:p-6 text-sm leading-relaxed">
        <details className="group">
          <summary className="cursor-pointer titulo-marca text-lg md:text-xl text-center mb-2 select-none">
            Reglamento completo{" "}
            <span className="text-xs text-text-dim group-open:hidden">
              (tocá para abrir)
            </span>
          </summary>

          <div className="space-y-5 mt-4">
            <Seccion titulo="Introducción">
              <p>
                Para jugar al truco se usan las 40 cartas de la baraja
                española (sin 8, sin 9 y sin comodines). Para ganar una
                partida hay que llegar a 30 puntos antes que el rival. A
                los primeros 15 se les llama <em>las malas</em> y a los
                últimos 15 <em>las buenas</em>. También se puede jugar a
                15 puntos (sólo las malas).
              </p>
            </Seccion>

            <Seccion titulo="Jugadores">
              <p>
                Mano a mano (2), por equipos de 2 vs 2 (4) o 3 vs 3 (6).
                Las tres modalidades están disponibles online.
              </p>
            </Seccion>

            <Seccion titulo="Inicio">
              <p>
                Cada jugador saca una carta del mazo: el de mayor valor
                empieza repartiendo. El que repartió ofrece el corte al
                jugador a su izquierda y reparte 3 cartas a cada uno,
                empezando por el de la derecha. Se juegan 3 rondas con
                las 3 cartas. Gana la mano quien gane 2 de las 3 rondas.
              </p>
              <p className="mt-2">
                La que ganó la primera ronda empieza la segunda. La que
                ganó la segunda empieza la tercera. Terminada la mano,
                el jugador a la derecha del repartidor original baraja y
                vuelve a repartir. La partida termina cuando un equipo
                llega a 30 puntos.
              </p>
            </Seccion>

            <Seccion titulo="Envido — cómo se canta">
              <p>
                Sumás los puntos de las cartas del mismo palo. El máximo
                es 33 y el mínimo 0. Cada carta vale su número (figuras
                10, 11 y 12 valen 0). Si tenés dos del mismo palo, sumás
                esas dos + 20. Si tenés las tres del mismo palo (sin
                flor), sumás las dos más altas + 20.
              </p>
              <p className="mt-2">
                El envido se canta sólo en la primera ronda y antes de
                jugarse el truco. La ronda termina cuando el repartidor
                tira su primera carta. Si nadie lo cantó, no se anota
                punto por envido.
              </p>
            </Seccion>

            <Seccion titulo="Envido — respuestas y subidas">
              <p>
                Si te cantan envido tenés que <strong>querer</strong>,{" "}
                <strong>no querer</strong> o <strong>subir la apuesta</strong>.
                Para querer hay que decir "Quiero" (no vale "dale" ni
                "lo veo"). Para no querer, "No quiero" o cantar
                directamente truco.
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-0.5">
                <li>Envido: 2 querido / 1 no querido.</li>
                <li>Real envido: 3 querido / 1 no querido.</li>
                <li>
                  Falta envido: lo que le falta al puntero para llegar a
                  30. Si gana el puntero, se lleva la partida.
                </li>
              </ul>
              <p className="mt-2">
                Una vez querido, primero canta el "tanto" el jugador
                <em> mano</em>. Si el otro no puede superarlo, dice "Son
                buenas". El de más tantos gana. Empate gana el mano.
              </p>
              <p className="mt-2 italic opacity-80">
                Los cantos válidos del envido son del 0 al 7 y del 20 al
                33.
              </p>
            </Seccion>

            <Seccion titulo="El envido está primero">
              <p>
                Si se canta truco antes de que ningún jugador (excepto el
                pie / repartidor) haya tirado su primera carta, cualquier
                jugador del equipo contrario puede cortar con envido. Se
                juega primero el envido y después se contesta el truco.
                Una vez respondido el truco, ya no se puede cantar
                envido.
              </p>
            </Seccion>

            <Seccion titulo="La flor (opcional)">
              <p>
                Antes de empezar la partida se decide si se juega con o
                sin flor. Tener flor es tener las tres cartas del mismo
                palo. Se canta antes de la primera carta y vale 3 puntos
                directos (no hace falta que la quieran).
              </p>
              <p className="mt-2">
                Si los dos equipos tienen flor, pueden subir cantando{" "}
                <em>Contra Flor</em> o <em>Contra Flor al Resto</em>. La
                tiene que cantar el que la lleva, no un compañero.
              </p>
            </Seccion>

            <Seccion titulo="Truco — cómo se canta">
              <p>
                El truco se puede cantar en cualquier momento de la mano
                y por cualquier jugador, sin orden establecido. Si nadie
                canta, el equipo que gane la mano se anota 1 punto.
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-0.5">
                <li>Truco: 2 querido / 1 no querido.</li>
                <li>Quiero retruco: 3 / 2.</li>
                <li>Vale cuatro: 4 / 3.</li>
              </ul>
              <p className="mt-2">
                A diferencia del envido, hay que seguir el orden:{" "}
                <strong>truco → retruco → vale cuatro</strong>. El que
                quiso el último canto es el único que puede subir
                ("tiene el quiero").
              </p>
            </Seccion>

            <Seccion titulo="Bazas y pardas">
              <p>
                La carta de mayor valor gana la baza. Si una baza queda
                parda (dos cartas del mismo valor), define la siguiente.
                Si las tres son pardas, gana el equipo del{" "}
                <em>mano</em>.
              </p>
              <p className="mt-2">
                Las cartas tiradas quedan boca arriba en la mesa y no se
                recogen hasta el final de la mano. Una carta se considera
                jugada cuando se apoyó por completo: si la mantenés
                agarrada todavía podés cambiarla o cantar.
              </p>
            </Seccion>

            <Seccion titulo="Reparto">
              <p>
                El que reparte baraja, ofrece el corte al de su izquierda
                (corte en dos montones de mínimo 3 cartas, sin "picar"),
                arma de nuevo y reparte una a una hacia su derecha.
              </p>
              <p className="mt-2">
                Si una carta se da vuelta durante el reparto y es del
                equipo del repartidor, se queda con esa. Si es del
                contrario, el receptor puede aceptarla o pedir que se
                vuelva a repartir.
              </p>
              <p className="mt-2">
                Si el repartidor entrega más o menos cartas a alguien,
                hay que repartir de nuevo. Si nadie avisa y se descubre
                después, se descuentan 2 puntos al equipo del jugador
                que tenía cartas de más o de menos.
              </p>
            </Seccion>

            <Seccion titulo="Señas reglamentarias">
              <p>
                Está permitido pasar señas a los compañeros (sin taparse
                la cara). También está permitido fingir señas para
                engañar al rival, con el riesgo de engañar también a los
                propios. Las señas inventadas fuera del reglamento son
                motivo de descalificación.
              </p>
              <p className="mt-2">
                Para envido, "fruncir la nariz" indica 30 o más tantos.
                Cerrar los ojos significa "muerto" o "ciego" (sin
                puntos). De forma verbal: <em>las perdedoras</em> son 29
                tantos y <em>las viejas</em> son 27.
              </p>
            </Seccion>

            <Seccion titulo="Irse al mazo">
              <p>
                Es dejar las cartas en el mazo, sin que las vea nadie,
                abandonando la mano. Se puede hacer en cualquier momento
                y en cualquier ronda. Lo que diga el jugador después de
                irse no tiene validez, pero su equipo puede seguir.
              </p>
              <p className="mt-2">
                Si todo el equipo se va al mazo, pierde los puntos en
                juego. Si se va antes del envido, pierde 1 por envido y
                1 por truco.
              </p>
            </Seccion>

            <Seccion titulo="Puntos">
              <p>
                Se anotan en papel formando cuadrados con una diagonal
                (cada palito = 1 punto, 5 puntos por cuadrado). Al
                completar 15 (3 cuadrados) se traza una línea horizontal
                que separa <em>las malas</em> de <em>las buenas</em>.
                Anota siempre el mismo jugador.
              </p>
            </Seccion>

            <Seccion titulo="Glosario">
              <ul className="list-none space-y-1 text-[13px]">
                <li>
                  <strong>Ancho falso:</strong> el 1 de oro y el 1 de
                  copa.
                </li>
                <li>
                  <strong>Buenas:</strong> los últimos 15 puntos. Se
                  entra en las buenas al alcanzar 16.
                </li>
                <li>
                  <strong>Figura / Negra:</strong> 10, 11 y 12 de
                  cualquier palo.
                </li>
                <li>
                  <strong>Hembra:</strong> el 1 de basto.
                </li>
                <li>
                  <strong>Ir al pie:</strong> tirar bajo esperando que el
                  pie del equipo "ponga".
                </li>
                <li>
                  <strong>Macho:</strong> el 1 de espada.
                </li>
                <li>
                  <strong>Malas:</strong> los primeros 15 puntos.
                </li>
                <li>
                  <strong>Mano:</strong> el primer jugador a la derecha
                  del repartidor.
                </li>
                <li>
                  <strong>Matar:</strong> tirar una carta más alta que
                  otra.
                </li>
                <li>
                  <strong>Parda:</strong> baza empatada por dos cartas
                  del mismo valor.
                </li>
                <li>
                  <strong>Pasar:</strong> no cantar el tanto del envido.
                </li>
                <li>
                  <strong>Pie:</strong> el último jugador del equipo en
                  la ronda.
                </li>
                <li>
                  <strong>Pie total:</strong> el repartidor.
                </li>
                <li>
                  <strong>Poner:</strong> tirar la carta más alta del
                  equipo en esa ronda.
                </li>
                <li>
                  <strong>Siete bravo:</strong> el 7 de espada.
                </li>
                <li>
                  <strong>Siete falso:</strong> el 7 de basto y el 7 de
                  copa.
                </li>
                <li>
                  <strong>Tantos:</strong> los puntos del envido.
                </li>
                <li>
                  <strong>Viejas:</strong> 27 tantos.
                </li>
              </ul>
            </Seccion>
          </div>
        </details>
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
