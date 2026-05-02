-- Ranking ahora distingue entre partidas "entre humanos" (todos los
-- jugadores son humanos) y partidas "con bots" (al menos uno fue bot).
-- Antes el view agregaba ambas categorías sin distinguir, así que un
-- usuario que jugaba contra bots aparecía con muchas más partidas
-- que el resto.
create or replace view public.ranking as
with es_solo_humanos as (
  select
    partida_id,
    sum(case when es_bot then 1 else 0 end) = 0 as solo_humanos
  from public.partida_jugadores
  group by partida_id
)
select
  pj.perfil_id,
  p.nombre,
  p.personaje,
  -- Totales (todas las partidas).
  count(*)::int                                                   as partidas_jugadas,
  count(*) filter (where pj.gano)::int                            as ganadas,
  count(*) filter (where not pj.gano)::int                        as perdidas,
  case when count(*) > 0
       then round(100.0 * count(*) filter (where pj.gano) / count(*), 1)
       else 0 end                                                 as winrate,
  -- Sólo entre humanos (ningún bot en la partida).
  count(*) filter (where esh.solo_humanos)::int                   as partidas_humanos,
  count(*) filter (where esh.solo_humanos and pj.gano)::int       as ganadas_humanos,
  count(*) filter (where esh.solo_humanos and not pj.gano)::int   as perdidas_humanos,
  case when count(*) filter (where esh.solo_humanos) > 0
       then round(
              100.0 * count(*) filter (where esh.solo_humanos and pj.gano)
              / count(*) filter (where esh.solo_humanos),
              1
            )
       else 0 end                                                 as winrate_humanos,
  -- Sólo partidas con bots (al menos un bot participó).
  count(*) filter (where not esh.solo_humanos)::int               as partidas_bots,
  count(*) filter (where not esh.solo_humanos and pj.gano)::int   as ganadas_bots,
  count(*) filter (where not esh.solo_humanos and not pj.gano)::int as perdidas_bots,
  case when count(*) filter (where not esh.solo_humanos) > 0
       then round(
              100.0 * count(*) filter (where not esh.solo_humanos and pj.gano)
              / count(*) filter (where not esh.solo_humanos),
              1
            )
       else 0 end                                                 as winrate_bots
from public.partida_jugadores pj
left join public.perfiles p on p.id = pj.perfil_id
left join es_solo_humanos esh on esh.partida_id = pj.partida_id
where pj.perfil_id is not null and not pj.es_bot
group by pj.perfil_id, p.nombre, p.personaje
order by ganadas_humanos desc, winrate_humanos desc;

alter view public.ranking set (security_invoker = on);
