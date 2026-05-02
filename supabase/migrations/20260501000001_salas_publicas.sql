-- Salas públicas: las que el creador marcó como abiertas en el listado
-- del home. Cualquier jugador que entra al home puede ver y unirse sin
-- necesitar el link directo.
alter table public.salas
  add column if not exists publica bool not null default false;

-- Index parcial para listar rápido las salas públicas que están abiertas
-- (creadas pero todavía sin iniciar y sin terminar). El home las consume
-- frecuentemente.
create index if not exists idx_salas_publicas_abiertas
  on public.salas(updated_at desc)
  where publica = true and iniciada = false and terminada = false;
