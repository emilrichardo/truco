-- Truco Entre Primos — esquema inicial.
-- Cubre: perfiles de jugador, salas en curso, historial de partidas terminadas,
-- jugadores por partida (para ranking), log de jugadas y voces personalizadas.

-- ============================================================
-- Helpers
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Trigger genérico para mantener updated_at.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- perfiles: identidad del jugador (sin auth obligatoria por ahora)
-- ============================================================

create table if not exists public.perfiles (
  id              uuid primary key default gen_random_uuid(),
  device_id       text unique,                    -- id local generado por el cliente (cookie/localStorage)
  user_id         uuid unique,                    -- futuro: auth.users.id si activamos auth
  nombre          text not null,
  personaje       text not null default 'hugui',  -- slug del primo
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_perfiles_device on public.perfiles(device_id);
drop trigger if exists trg_perfiles_updated on public.perfiles;
create trigger trg_perfiles_updated before update on public.perfiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- salas: partidas online en curso (state autoritativo en JSONB)
-- ============================================================

create table if not exists public.salas (
  id                text primary key,             -- alias truquero, ej "fernet-y-mazo"
  modo              text not null check (modo in ('1v1', '2v2')),
  puntos_objetivo   int  not null check (puntos_objetivo in (15, 30)),
  estado            jsonb not null,               -- EstadoJuego completo
  iniciada          bool not null default false,
  terminada         bool not null default false,
  ganador_equipo    int,                          -- 0 | 1 | null
  created_by        uuid references public.perfiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  terminada_at      timestamptz
);
create index if not exists idx_salas_updated on public.salas(updated_at desc);
create index if not exists idx_salas_terminada on public.salas(terminada);
drop trigger if exists trg_salas_updated on public.salas;
create trigger trg_salas_updated before update on public.salas
  for each row execute function public.set_updated_at();

-- ============================================================
-- partidas: snapshot histórico de partidas terminadas
-- ============================================================

create table if not exists public.partidas (
  id                uuid primary key default gen_random_uuid(),
  sala_id           text references public.salas(id) on delete set null,
  modo              text not null check (modo in ('1v1', '2v2')),
  puntos_objetivo   int  not null,
  ganador_equipo    int  not null,
  duracion_seg      int,
  estado_final      jsonb not null,
  created_at        timestamptz not null default now()
);
create index if not exists idx_partidas_created on public.partidas(created_at desc);

-- ============================================================
-- partida_jugadores: pivot jugador↔partida con resultado (base del ranking)
-- ============================================================

create table if not exists public.partida_jugadores (
  id              uuid primary key default gen_random_uuid(),
  partida_id      uuid not null references public.partidas(id) on delete cascade,
  perfil_id       uuid references public.perfiles(id) on delete set null,
  nombre          text not null,                 -- snapshot por si el perfil se borra
  personaje       text not null,
  equipo          int  not null check (equipo in (0, 1)),
  asiento         int  not null,
  es_bot          bool not null default false,
  gano            bool not null,
  puntos_finales  int  not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists idx_pj_partida on public.partida_jugadores(partida_id);
create index if not exists idx_pj_perfil  on public.partida_jugadores(perfil_id);

-- ============================================================
-- jugadas: log granular de cada acción (para replay y debugging)
-- ============================================================

create table if not exists public.jugadas (
  id           uuid primary key default gen_random_uuid(),
  partida_id   uuid not null references public.partidas(id) on delete cascade,
  jugador_id   text not null,                    -- id interno del jugador en la sala
  accion       jsonb not null,
  ts           timestamptz not null default now()
);
create index if not exists idx_jugadas_partida_ts on public.jugadas(partida_id, ts);

-- ============================================================
-- voces: gritos personalizados ("envido", "truco", "vale 4", etc.)
--        El audio vive en Storage; acá guardamos el path y metadata.
-- ============================================================

create table if not exists public.voces (
  id            uuid primary key default gen_random_uuid(),
  perfil_id     uuid not null references public.perfiles(id) on delete cascade,
  canto         text not null check (canto in (
                   'envido','envido_envido','real_envido','falta_envido',
                   'truco','retruco','vale_cuatro',
                   'quiero','no_quiero','ir_al_mazo'
                 )),
  storage_path  text not null,                   -- bucket "voces", ej "<perfil>/<uuid>.webm"
  duracion_ms   int,
  mime          text not null default 'audio/webm',
  created_at    timestamptz not null default now()
);
create unique index if not exists uq_voces_perfil_canto
  on public.voces(perfil_id, canto);            -- una voz por canto y perfil

-- ============================================================
-- RLS — estrategia fase 1
-- · Lecturas: anon puede leer (la UI necesita ver historial, ranking, voces).
-- · Escrituras: anon puede manejar SU perfil y SUS voces; el resto pasa por
--   Edge Functions (service_role, bypass RLS).
-- · Cuando agreguemos auth, restringimos contra auth.uid().
-- ============================================================

alter table public.perfiles            enable row level security;
alter table public.salas               enable row level security;
alter table public.partidas            enable row level security;
alter table public.partida_jugadores   enable row level security;
alter table public.jugadas             enable row level security;
alter table public.voces               enable row level security;

-- perfiles: anon puede ver y crear/actualizar perfiles (validamos por device_id en el app).
drop policy if exists perfiles_select_all on public.perfiles;
create policy perfiles_select_all  on public.perfiles for select to anon, authenticated using (true);
drop policy if exists perfiles_insert_anon on public.perfiles;
create policy perfiles_insert_anon on public.perfiles for insert to anon, authenticated with check (true);
drop policy if exists perfiles_update_anon on public.perfiles;
create policy perfiles_update_anon on public.perfiles for update to anon, authenticated using (true) with check (true);

-- salas: lectura pública (Realtime las suscribe). Escrituras sólo Edge Function (service_role).
drop policy if exists salas_select_all on public.salas;
create policy salas_select_all on public.salas for select to anon, authenticated using (true);

-- partidas: lectura pública para historial.
drop policy if exists partidas_select_all on public.partidas;
create policy partidas_select_all on public.partidas for select to anon, authenticated using (true);

-- partida_jugadores: lectura pública para ranking.
drop policy if exists pj_select_all on public.partida_jugadores;
create policy pj_select_all on public.partida_jugadores for select to anon, authenticated using (true);

-- jugadas: lectura pública para replay.
drop policy if exists jugadas_select_all on public.jugadas;
create policy jugadas_select_all on public.jugadas for select to anon, authenticated using (true);

-- voces: lectura pública (cualquiera puede oír). Insert/Update/Delete del perfil dueño.
drop policy if exists voces_select_all on public.voces;
create policy voces_select_all   on public.voces for select to anon, authenticated using (true);
drop policy if exists voces_insert_anon on public.voces;
create policy voces_insert_anon  on public.voces for insert to anon, authenticated with check (true);
drop policy if exists voces_update_anon on public.voces;
create policy voces_update_anon  on public.voces for update to anon, authenticated using (true) with check (true);
drop policy if exists voces_delete_anon on public.voces;
create policy voces_delete_anon  on public.voces for delete to anon, authenticated using (true);

-- ============================================================
-- Realtime: habilitar replicación para broadcast de cambios en salas.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'salas'
  ) then
    alter publication supabase_realtime add table public.salas;
  end if;
end $$;
