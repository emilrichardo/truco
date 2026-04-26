-- Vistas derivadas: ranking calculado, partidas recientes con jugadores.

-- Ranking por perfil: agregados de partidas terminadas (excluye bots).
create or replace view public.ranking as
select
  pj.perfil_id,
  p.nombre,
  p.personaje,
  count(*)::int                                                  as partidas_jugadas,
  count(*) filter (where pj.gano)::int                           as ganadas,
  count(*) filter (where not pj.gano)::int                       as perdidas,
  case when count(*) > 0
       then round(100.0 * count(*) filter (where pj.gano) / count(*), 1)
       else 0 end                                                as winrate
from public.partida_jugadores pj
left join public.perfiles p on p.id = pj.perfil_id
where pj.perfil_id is not null and not pj.es_bot
group by pj.perfil_id, p.nombre, p.personaje
order by ganadas desc, winrate desc;

-- Historial de partidas recientes con la lista de jugadores embebida.
create or replace view public.partidas_recientes as
select
  pa.id,
  pa.modo,
  pa.puntos_objetivo,
  pa.ganador_equipo,
  pa.duracion_seg,
  pa.created_at,
  (
    select jsonb_agg(jsonb_build_object(
             'perfil_id', pj.perfil_id,
             'nombre',    pj.nombre,
             'personaje', pj.personaje,
             'equipo',    pj.equipo,
             'asiento',   pj.asiento,
             'es_bot',    pj.es_bot,
             'gano',      pj.gano,
             'puntos',    pj.puntos_finales
           ) order by pj.asiento)
    from public.partida_jugadores pj
    where pj.partida_id = pa.id
  ) as jugadores
from public.partidas pa
order by pa.created_at desc;

-- Las views heredan las RLS de las tablas subyacentes con security_invoker.
alter view public.ranking            set (security_invoker = on);
alter view public.partidas_recientes set (security_invoker = on);
