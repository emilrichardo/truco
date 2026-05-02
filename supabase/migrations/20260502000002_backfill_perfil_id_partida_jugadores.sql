-- Backfill de perfil_id NULL en partida_jugadores. Causa raíz: cuando
-- un mismo nombre+personaje tiene perfiles duplicados (porque cada
-- device_id nuevo crea un perfil aparte), el lookup en sala-accion con
-- .maybeSingle() devolvía NULL al encontrar >1 fila. Esto excluía a
-- esos jugadores del ranking.
--
-- Estrategia: mapear cada (nombre, personaje) al perfil MÁS ANTIGUO con
-- ese par, y rellenar los partida_jugadores con perfil_id NULL que
-- coincidan en nombre+personaje. No tocamos los que ya tienen un
-- perfil_id asignado (aunque ese perfil_id sea uno de los duplicados —
-- el ranking sigue contándolos correctamente porque el GROUP BY usa
-- perfil_id).
update public.partida_jugadores pj
set perfil_id = canon.id
from (
  select distinct on (nombre, personaje)
    nombre, personaje, id, created_at
  from public.perfiles
  order by nombre, personaje, created_at asc
) canon
where pj.perfil_id is null
  and pj.es_bot = false
  and canon.nombre = pj.nombre
  and canon.personaje = pj.personaje;
