create table if not exists public.entrenamiento_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sala_id text not null,
  mano_numero integer,
  actor_jugador_id text not null,
  actor_nombre text,
  aprobada boolean not null default false,
  origen text not null default 'web',
  notas text,
  sugerencia jsonb,
  accion_final jsonb not null,
  estado_snapshot jsonb not null
);

create index if not exists entrenamiento_feedback_created_at_idx
  on public.entrenamiento_feedback (created_at desc);

create index if not exists entrenamiento_feedback_actor_idx
  on public.entrenamiento_feedback (actor_jugador_id, created_at desc);
