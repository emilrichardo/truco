-- Bucket de Storage para las voces personalizadas de los jugadores.
-- Estructura de paths: voces/<perfil_id>/<canto>.webm

-- Crear bucket público (lectura libre para que cualquiera oiga; escritura RLS).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voces',
  'voces',
  true,
  1048576 * 2,  -- 2 MB por archivo
  array['audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Policies sobre storage.objects para el bucket "voces".
-- Lectura abierta a anon.
drop policy if exists "voces_read_public" on storage.objects;
create policy "voces_read_public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'voces');

-- Insert: anon puede subir archivos al bucket "voces".
-- Validamos en la app (el path debe contener el perfil_id del subidor).
drop policy if exists "voces_insert_anon" on storage.objects;
create policy "voces_insert_anon"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'voces');

-- Update / Delete: cualquier anon (idem, la app valida).
drop policy if exists "voces_update_anon" on storage.objects;
create policy "voces_update_anon"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'voces');
drop policy if exists "voces_delete_anon" on storage.objects;
create policy "voces_delete_anon"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'voces');
