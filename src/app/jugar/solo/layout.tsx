import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jugar solo contra la máquina",
  description:
    "Truco vs máquina: 1v1 o 2v2 con bots con personalidad. Sin registro, sin esperas, gratis. Practicá envido, retruco y picardía cuando quieras.",
  alternates: { canonical: "/jugar/solo" },
  openGraph: {
    title: "Truco vs máquina — Truco Entre Primos",
    description:
      "Practicá truco contra bots con personalidad. 1v1 o 2v2, sin registro y gratis.",
    url: "/jugar/solo"
  }
};

export default function SoloLayout({ children }: { children: React.ReactNode }) {
  return children;
}
