"use client";
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (typeof window === "undefined") throw new Error("Socket solo en el cliente.");
  if (!socket) {
    socket = io({
      autoConnect: true,
      transports: ["websocket", "polling"]
    });
  }
  return socket;
}

const STORAGE_KEY = "truco_primos_sesion";
export interface SesionLocal {
  salaId: string;
  jugadorId: string;
}
export function guardarSesion(s: SesionLocal) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY + ":" + s.salaId, JSON.stringify(s));
  }
}
export function leerSesion(salaId: string): SesionLocal | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY + ":" + salaId);
  return raw ? JSON.parse(raw) : null;
}
