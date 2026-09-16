-- Étape 6 — comptes utilisateurs : inscription publique, profil personnel,
-- et propriété d'une fiche photographe (le propriétaire modifie sa page).
--
-- Rappels de sécurité :
--   * private.is_staff() exige toujours l'AAL2 (double authentification) ET
--     une ligne dans admin_users : un compte public ne peut donc rien faire
--     des politiques « staff manage ».
--   * Le propriétaire d'une fiche n'obtient AUCUN droit UPDATE direct sur la
--     table : tout passe par des fonctions qui n'écrivent que les colonnes
--     autorisées. Il ne peut donc ni se publier lui-même, ni changer son
--     propriétaire.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 2 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "users manage own profile" on public.profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "staff read profiles" on public.profiles for select to authenticated using (private.is_staff());
revoke all on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();

alter table public.photographers add column owner_user_id uuid references auth.users (id) on delete set null;
create index photographers_owner_idx on public.photographers (owner_user_id);

-- Permet à l'interface d'afficher le bouton « Administration » aux seuls
-- administrateurs, avant même le passage de la double authentification.
create or replace function public.am_i_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users a where a.user_id = auth.uid());
$$;

revoke all on function public.am_i_admin() from public;
grant execute on function public.am_i_admin() to authenticated;

create or replace function public.ensure_my_profile(p_display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  cleaned := nullif(trim(coalesce(p_display_name, '')), '');
  if cleaned is not null and char_length(cleaned) not between 2 and 80 then
    raise exception 'invalid_display_name';
  end if;

  insert into public.profiles (user_id, display_name)
  values (auth.uid(), cleaned)
  on conflict (user_id) do update
    set display_name = coalesce(excluded.display_name, public.profiles.display_name);

  return auth.uid();
end;
$$;

revoke all on function public.ensure_my_profile(text) from public;
grant execute on function public.ensure_my_profile(text) to authenticated;

-- Rattachement d'une fiche existante au compte qui porte la même adresse de
-- contact. Chaque rattachement est inscrit au journal de modération.
create or replace function public.claim_photographer_profiles()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_email text;
  claimed_count integer := 0;
  claimed record;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select lower(u.email) into current_email from auth.users u where u.id = auth.uid();
  if current_email is null then return 0; end if;

  for claimed in
    update public.photographers
    set owner_user_id = auth.uid()
    where owner_user_id is null
      and lower(contact_email) = current_email
    returning id, name
  loop
    claimed_count := claimed_count + 1;
    insert into public.moderation_actions (actor_user_id, entity_type, entity_id, action, details)
    values (
      auth.uid(),
      'photographer',
      claimed.id::text,
      'profile_claimed',
      jsonb_build_object('name', claimed.name, 'email', current_email)
    );
  end loop;

  return claimed_count;
end;
$$;

revoke all on function public.claim_photographer_profiles() from public;
grant execute on function public.claim_photographer_profiles() to authenticated;

create or replace function private.validate_socials(p_socials jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  item integer;
begin
  if jsonb_typeof(coalesce(p_socials, 'null'::jsonb)) is distinct from 'array' then
    raise exception 'invalid_socials';
  end if;
  if jsonb_array_length(p_socials) < 1 or jsonb_array_length(p_socials) > 5 then
    raise exception 'invalid_socials';
  end if;
  for item in 0 .. jsonb_array_length(p_socials) - 1 loop
    if not (p_socials -> item ? 'platform' and p_socials -> item ? 'value') then
      raise exception 'invalid_socials';
    end if;
    if coalesce(trim(p_socials -> item ->> 'platform'), '') = ''
      or coalesce(trim(p_socials -> item ->> 'value'), '') = ''
      or char_length(p_socials -> item ->> 'value') > 200 then
      raise exception 'invalid_socials';
    end if;
  end loop;
end;
$$;

create or replace function public.get_my_photographer_profile()
returns table (
  id uuid,
  slug text,
  name text,
  tagline text,
  bio text,
  location_label text,
  socials jsonb,
  publication_state text,
  photos jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.slug, p.name, p.tagline, p.bio, p.location_label, p.socials,
    p.publication_state::text,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ph.id,
        'public_url', ph.public_url,
        'display_order', ph.display_order,
        'moderation_state', ph.moderation_state::text
      ) order by ph.display_order)
      from public.photographer_photos ph
      where ph.photographer_id = p.id
    ), '[]'::jsonb)
  from public.photographers p
  where p.owner_user_id = auth.uid()
  order by p.created_at
  limit 1;
$$;

revoke all on function public.get_my_photographer_profile() from public;
grant execute on function public.get_my_photographer_profile() to authenticated;

create or replace function public.update_my_photographer_profile(
  p_name text,
  p_tagline text,
  p_bio text,
  p_location_label text,
  p_socials jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.photographers%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select * into target from public.photographers where owner_user_id = auth.uid() order by created_at limit 1;
  if target.id is null then raise exception 'not_owner'; end if;

  if char_length(trim(coalesce(p_name, ''))) not between 2 and 80 then raise exception 'invalid_name'; end if;
  if char_length(trim(coalesce(p_tagline, ''))) not between 10 and 160 then raise exception 'invalid_tagline'; end if;
  if char_length(trim(coalesce(p_bio, ''))) not between 20 and 2000 then raise exception 'invalid_bio'; end if;
  if p_location_label is not null and char_length(trim(p_location_label)) > 120 then raise exception 'invalid_location'; end if;
  perform private.validate_socials(p_socials);

  -- Seules ces colonnes sont modifiables : ni publication_state, ni
  -- owner_user_id, ni contact_email ne peuvent être touchés par le propriétaire.
  update public.photographers
  set name = trim(p_name),
      tagline = trim(p_tagline),
      bio = trim(p_bio),
      location_label = nullif(trim(coalesce(p_location_label, '')), ''),
      socials = p_socials
  where id = target.id;

  return target.id;
end;
$$;

revoke all on function public.update_my_photographer_profile(text, text, text, text, jsonb) from public;
grant execute on function public.update_my_photographer_profile(text, text, text, text, jsonb) to authenticated;

create or replace function public.add_my_photographer_photo(
  p_object_path text,
  p_public_url text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.photographers%rowtype;
  next_order smallint;
  new_photo_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select * into target from public.photographers where owner_user_id = auth.uid() order by created_at limit 1;
  if target.id is null then raise exception 'not_owner'; end if;

  if p_object_path !~ ('^photographers/' || target.id::text || '/') then
    raise exception 'invalid_object_path';
  end if;
  if position(p_object_path in coalesce(p_public_url, '')) = 0 then
    raise exception 'invalid_public_url';
  end if;

  -- Première position libre : les suppressions laissent des trous.
  select min(g)::smallint into next_order
  from generate_series(0, 5) g
  where g not in (select display_order from public.photographer_photos where photographer_id = target.id);

  if next_order is null then raise exception 'too_many_photos'; end if;

  insert into public.photographer_photos (photographer_id, object_path, public_url, display_order, moderation_state)
  values (
    target.id,
    p_object_path,
    p_public_url,
    next_order,
    (case when target.publication_state = 'published' then 'approved' else 'pending' end)::public.photo_moderation_state
  )
  returning id into new_photo_id;

  return new_photo_id;
end;
$$;

revoke all on function public.add_my_photographer_photo(text, text) from public;
grant execute on function public.add_my_photographer_photo(text, text) to authenticated;

create or replace function public.remove_my_photographer_photo(p_photo_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.photographers%rowtype;
  removed_path text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select * into target from public.photographers where owner_user_id = auth.uid() order by created_at limit 1;
  if target.id is null then raise exception 'not_owner'; end if;

  delete from public.photographer_photos
  where id = p_photo_id and photographer_id = target.id
  returning object_path into removed_path;

  if removed_path is null then raise exception 'photo_not_found'; end if;

  return removed_path;
end;
$$;

revoke all on function public.remove_my_photographer_photo(uuid) from public;
grant execute on function public.remove_my_photographer_photo(uuid) to authenticated;

-- Le propriétaire d'une fiche peut envoyer et retirer ses propres photos,
-- en plus du cas « inscription en cours de validation ».
create or replace function private.may_upload_photographer_photo(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folders text[];
  target_photographer public.photographers%rowtype;
begin
  folders := storage.foldername(p_object_name);
  if array_length(folders, 1) <> 2 or folders[1] <> 'photographers' then
    return false;
  end if;

  select * into target_photographer from public.photographers where id::text = folders[2];
  if target_photographer.id is null then
    return false;
  end if;

  if target_photographer.publication_state <> 'pending'
    and (target_photographer.owner_user_id is null or target_photographer.owner_user_id <> auth.uid()) then
    return false;
  end if;

  return (
    select count(*) from storage.objects o
    where o.bucket_id = 'photographer-photos'
      and o.name like ('photographers/' || target_photographer.id::text || '/%')
  ) < 12;
end;
$$;

create or replace function private.may_remove_photographer_photo(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folders text[];
begin
  folders := storage.foldername(p_object_name);
  if array_length(folders, 1) <> 2 or folders[1] <> 'photographers' then
    return false;
  end if;

  return exists (
    select 1 from public.photographers p
    where p.id::text = folders[2] and p.owner_user_id = auth.uid()
  );
end;
$$;

create policy "photographer owners remove own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photographer-photos' and private.may_remove_photographer_photo(name));

-- L'inscription enregistre désormais le compte connecté comme propriétaire.
create or replace function public.create_public_photographer(
  p_name text,
  p_tagline text,
  p_bio text,
  p_location_label text,
  p_socials jsonb,
  p_email text,
  p_website text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text;
  base_slug text;
  candidate_slug text;
  suffix integer := 1;
  new_id uuid;
begin
  if nullif(trim(coalesce(p_website, '')), '') is not null then
    return extensions.gen_random_uuid();
  end if;

  if char_length(trim(coalesce(p_name, ''))) not between 2 and 80 then raise exception 'invalid_name'; end if;
  if char_length(trim(coalesce(p_tagline, ''))) not between 10 and 160 then raise exception 'invalid_tagline'; end if;
  if char_length(trim(coalesce(p_bio, ''))) not between 20 and 2000 then raise exception 'invalid_bio'; end if;
  if p_location_label is not null and char_length(trim(p_location_label)) > 120 then raise exception 'invalid_location'; end if;
  perform private.validate_socials(p_socials);

  normalized_email := lower(trim(coalesce(p_email, '')));
  if normalized_email = '' or char_length(normalized_email) > 320
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_email';
  end if;

  if (
    select count(*) from public.photographers ph
    where lower(ph.contact_email) = normalized_email
      and ph.created_at > now() - interval '1 day'
  ) >= 2 then
    raise exception 'rate_limit';
  end if;

  base_slug := trim(both '-' from regexp_replace(lower(extensions.unaccent(trim(p_name))), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'photographe'; end if;
  candidate_slug := base_slug;
  while exists (select 1 from public.photographers where slug = candidate_slug) loop
    suffix := suffix + 1;
    candidate_slug := base_slug || '-' || suffix;
  end loop;

  insert into public.photographers (slug, name, tagline, bio, location_label, socials, contact_email, owner_user_id)
  values (
    candidate_slug,
    trim(p_name),
    trim(p_tagline),
    trim(p_bio),
    nullif(trim(coalesce(p_location_label, '')), ''),
    p_socials,
    normalized_email,
    auth.uid()
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.create_public_photographer(text, text, text, text, jsonb, text, text) from public;
grant execute on function public.create_public_photographer(text, text, text, text, jsonb, text, text) to anon, authenticated;
