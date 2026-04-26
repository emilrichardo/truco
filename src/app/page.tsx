import Link from "next/link";
import { PERSONAJES, urlPersonaje } from "@/data/jugadores";

export default function HomePage() {
  return (
    <main className="min-h-screen px-4 py-10 max-w-6xl mx-auto">
      <header className="text-center mb-10">
        <p className="label-slim mb-2">Truco argentino</p>
        <h1 className="font-display text-5xl md:text-6xl text-truco-gold drop-shadow">
          Truco entre Primos
        </h1>
        <p className="text-cream/80 mt-3 max-w-2xl mx-auto">
          Sin registro, sin vueltas. Elegí tu personaje, jugá contra la máquina o
          mandale el link a tres primos y empiecen ya. Punto envido, punto al truco
          y a contar fósforos.
        </p>
      </header>

      <section className="grid md:grid-cols-3 gap-4 mb-10">
        <Link
          href="/jugar/solo"
          className="card-frame text-truco-dark p-6 text-center hover:scale-[1.02] transition"
        >
          <div className="font-display text-2xl mb-2">Jugar contra la máquina</div>
          <p className="text-sm">1 vs 1 o 2 vs 2 con bots. Para calentar la mano.</p>
        </Link>
        <Link
          href="/jugar/crear"
          className="card-frame text-truco-dark p-6 text-center hover:scale-[1.02] transition"
        >
          <div className="font-display text-2xl mb-2">Crear sala online</div>
          <p className="text-sm">Generá un link y compartilo. Hasta 4 jugadores.</p>
        </Link>
        <Link
          href="/reglas"
          className="card-frame text-truco-dark p-6 text-center hover:scale-[1.02] transition"
        >
          <div className="font-display text-2xl mb-2">Reglas del truco</div>
          <p className="text-sm">Envido, real envido, falta envido, truco, retruco, vale 4.</p>
        </Link>
      </section>

      <section>
        <h2 className="label-slim mb-3">Los primos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {PERSONAJES.map((p) => (
            <div key={p.slug} className="card-frame p-2">
              <div className="aspect-[3/4] overflow-hidden rounded">
                <img
                  src={urlPersonaje(p.slug)}
                  alt={p.nombre}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-center font-display text-truco-dark text-lg mt-1">
                {p.nombre}
              </div>
            </div>
          ))}
        </div>
        <p className="text-cream/60 text-xs mt-4 text-center">
          Para cambiar a un primo: reemplazá la imagen en{" "}
          <code className="text-truco-gold">/public/jugadores/&lt;slug&gt;.png</code>.
        </p>
      </section>

      <footer className="text-center text-cream/40 text-xs mt-12">
        Hecho con asado y mate. Sin auth, sin tracking, sin vueltas.
      </footer>
    </main>
  );
}
