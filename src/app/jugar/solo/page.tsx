"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSocket, guardarSesion } from "@/lib/socket";
import { SelectorPersonaje } from "@/components/SelectorPersonaje";

export default function SoloPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [personaje, setPersonaje] = useState("hugui");
  const [tamanio, setTamanio] = useState<2 | 4>(2);
  const [puntos, setPuntos] = useState<15 | 30>(15);
  const [creando, setCreando] = useState(false);

  const empezar = () => {
    if (creando) return;
    setCreando(true);
    const sock = getSocket();
    sock.emit(
      "crear_sala",
      {
        nombre: nombre || "Primo",
        personaje,
        modo: "solo",
        tamanio,
        puntosObjetivo: puntos
      },
      ({ salaId, jugadorId }: { salaId: string; jugadorId: string }) => {
        guardarSesion({ salaId, jugadorId });
        router.push(`/jugar/sala/${salaId}`);
      }
    );
  };

  return (
    <main className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
      <Link href="/" className="label-slim hover:text-truco-gold">
        ← Volver
      </Link>
      <h1 className="font-display text-4xl text-truco-gold mt-2 mb-6">
        Truco contra la máquina
      </h1>
      <div className="parchment rounded-xl p-5">
        <label className="block label-slim text-truco-red mb-1">Tu nombre</label>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Hugui"
          className="w-full bg-cream border border-truco-dark/30 rounded px-3 py-2 text-truco-dark mb-4"
          maxLength={24}
        />

        <div className="label-slim text-truco-red mb-1">Tu primo</div>
        <SelectorPersonaje seleccionado={personaje} onSeleccionar={setPersonaje} />

        <div className="grid grid-cols-2 gap-4 mt-5">
          <div>
            <div className="label-slim text-truco-red mb-1">Modo</div>
            <div className="flex gap-2">
              <button
                onClick={() => setTamanio(2)}
                className={`btn ${tamanio === 2 ? "btn-primary" : ""}`}
              >
                1 vs 1
              </button>
              <button
                onClick={() => setTamanio(4)}
                className={`btn ${tamanio === 4 ? "btn-primary" : ""}`}
              >
                2 vs 2
              </button>
            </div>
          </div>
          <div>
            <div className="label-slim text-truco-red mb-1">A cuántos</div>
            <div className="flex gap-2">
              <button
                onClick={() => setPuntos(15)}
                className={`btn ${puntos === 15 ? "btn-primary" : ""}`}
              >
                15 (corto)
              </button>
              <button
                onClick={() => setPuntos(30)}
                className={`btn ${puntos === 30 ? "btn-primary" : ""}`}
              >
                30 (largo)
              </button>
            </div>
          </div>
        </div>

        <button onClick={empezar} disabled={creando} className="btn btn-primary w-full mt-6">
          {creando ? "Repartiendo…" : "Empezar partida"}
        </button>
      </div>
    </main>
  );
}
