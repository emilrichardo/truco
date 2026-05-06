-- Bucket público para avatares/personajes de jugadores.
-- Estructura de paths: jugadores/<slug>.webp
--
-- La app lee desde Supabase Storage en producción. Las escrituras se hacen
-- desde scripts locales con SUPABASE_SERVICE_ROLE_KEY, por eso sólo abrimos
-- lectura pública para anon/authenticated.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'jugadores',
  'jugadores',
  true,
  1024 * 256, -- 256 KB por avatar optimizado
  array['image/webp', 'image/avif', 'image/png', 'image/jpeg']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "jugadores_read_public" on storage.objects;
create policy "jugadores_read_public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'jugadores');
