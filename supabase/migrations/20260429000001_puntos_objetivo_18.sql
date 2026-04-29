-- Permitir el modo "a 18" (9 malas + 9 buenas) además de "a 30" (15+15).
-- Mantenemos 15 en el set permitido para que las salas existentes con ese
-- valor sigan siendo válidas; las nuevas salas solo crean 18 ó 30.
alter table public.salas
  drop constraint if exists salas_puntos_objetivo_check;

alter table public.salas
  add constraint salas_puntos_objetivo_check
  check (puntos_objetivo in (15, 18, 30));
