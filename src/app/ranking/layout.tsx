import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ranking de primos",
  description:
    "El podio de los primos: tabla con partidas online ganadas, ratio de envido y pelotazos memorables. Sólo cuentan las partidas online entre primos.",
  alternates: { canonical: "/ranking" },
  openGraph: {
    title: "Ranking de primos — Truco Entre Primos",
    description:
      "Quién manda en la mesa: ranking con partidas ganadas y otros números entre primos.",
    url: "/ranking"
  }
};

export default function RankingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
