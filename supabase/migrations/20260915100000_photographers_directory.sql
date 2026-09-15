-- Étape 5 — annuaire des photographes : fiche publique (présentation, photos,
-- réseaux sociaux) avec inscription publique validée par la modération, et
-- avis (note + commentaire) eux aussi modérés avant publication.

create type public.photographer_state as enum ('pending', 'published', 'rejected', 'hidden');

create table public.photographers (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 80),
  tagline text not null check (char_length(tagline) between 10 and 160),
  bio text not null check (char_length(bio) between 20 and 2000),
  location_label text check (location_label is null or char_length(location_label) <= 120),
  socials jsonb not null default '[]'::jsonb,
  contact_email text not null check (char_length(contact_email) between 3 and 320),
  publication_state public.photographer_state not null default 'pending',
  internal_note text check (internal_note is null or char_length(internal_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz
);

create index photographers_queue_idx on public.photographers (publication_state, created_at);

create table public.photographer_photos (
  id uuid primary key default extensions.gen_random_uuid(),
  photographer_id uuid not null references public.photographers (id) on delete cascade,
  object_path text not null,
  public_url text not null,
  display_order smallint not null default 0 check (display_order between 0 and 5),
  moderation_state public.photo_moderation_state not null default 'pending',
  created_at timestamptz not null default now(),
  unique (photographer_id, display_order)
);

create table public.photographer_reviews (
  id uuid primary key default extensions.gen_random_uuid(),
  photographer_id uuid not null references public.photographers (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) between 10 and 800),
  reviewer_name text check (reviewer_name is null or char_length(reviewer_name) <= 80),
  reviewer_email text check (reviewer_email is null or char_length(reviewer_email) <= 320),
  moderation_state public.photo_moderation_state not null default 'pending',
  internal_note text check (internal_note is null or char_length(internal_note) <= 2000),
  created_at timestamptz not null default now()
);

create index photographer_reviews_queue_idx on public.photographer_reviews (moderation_state, created_at);
create index photographer_reviews_photographer_idx on public.photographer_reviews (photographer_id, moderation_state, created_at);

alter table public.photographers enable row level security;
alter table public.photographer_photos enable row level security;
alter table public.photographer_reviews enable row level security;

create policy "staff manage photographers" on public.photographers for all to authenticated using (private.is_staff()) with check (private.is_staff());
create policy "staff manage photographer photos" on public.photographer_photos for all to authenticated using (private.is_staff()) with check (private.is_staff());
create policy "staff manage photographer reviews" on public.photographer_reviews for all to authenticated using (private.is_staff()) with check (private.is_staff());

revoke all on public.photographers from anon, authenticated;
revoke all on public.photographer_photos from anon, authenticated;
revoke all on public.photographer_reviews from anon, authenticated;
grant select, insert, update, delete on public.photographers to authenticated;
grant select, insert, update, delete on public.photographer_photos to authenticated;
grant select, insert, update, delete on public.photographer_reviews to authenticated;

create trigger photographers_set_updated_at before update on public.photographers for each row execute function private.set_updated_at();

create or replace function private.validate_photographer_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.publication_state = new.publication_state then
    return new;
  end if;
  if not (
    (old.publication_state = 'pending' and new.publication_state in ('published', 'rejected'))
    or (old.publication_state = 'published' and new.publication_state = 'hidden')
    or (old.publication_state = 'hidden' and new.publication_state = 'published')
  ) then
    raise exception 'Invalid photographer state transition: % -> %', old.publication_state, new.publication_state;
  end if;
  return new;
end;
$$;

create trigger photographers_validate_transition before update of publication_state on public.photographers for each row execute function private.validate_photographer_transition();
create trigger photographers_audit_state after update of publication_state on public.photographers for each row execute function private.audit_state_change();

alter table public.moderation_actions
  drop constraint moderation_actions_entity_type_check;
alter table public.moderation_actions
  add constraint moderation_actions_entity_type_check
  check (entity_type in ('spot', 'proposal', 'report', 'photo', 'setting', 'admin_user', 'withdrawal_request', 'photographer', 'photographer_review'));

-- Bucket public dès l'envoi : les photos de portfolio n'ont pas les mêmes
-- exigences de confidentialité que les originaux de spots (pas de retrait
-- d'exif obligatoire côté serveur), donc pas de double bucket privé/public
-- ni d'étape de traitement — la modération se fait au niveau applicatif via
-- moderation_state, l'objet reste visible par son URL dès l'envoi.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photographer-photos', 'photographer-photos', true, 6291456, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "staff manage photographer bucket" on storage.objects for all to authenticated using (bucket_id = 'photographer-photos' and private.is_staff()) with check (bucket_id = 'photographer-photos' and private.is_staff());
create policy "public read photographer bucket" on storage.objects for select to anon, authenticated using (bucket_id = 'photographer-photos');

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
  if target_photographer.id is null or target_photographer.publication_state <> 'pending' then
    return false;
  end if;

  return (
    select count(*) from storage.objects o
    where o.bucket_id = 'photographer-photos'
      and o.name like ('photographers/' || target_photographer.id::text || '/%')
  ) < 6;
end;
$$;

create policy "photographer submission uploads" on storage.objects for insert to anon, authenticated with check (bucket_id = 'photographer-photos' and private.may_upload_photographer_photo(name));

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
  item integer;
begin
  if nullif(trim(coalesce(p_website, '')), '') is not null then
    return extensions.gen_random_uuid();
  end if;

  if char_length(trim(coalesce(p_name, ''))) not between 2 and 80 then
    raise exception 'invalid_name';
  end if;
  if char_length(trim(coalesce(p_tagline, ''))) not between 10 and 160 then
    raise exception 'invalid_tagline';
  end if;
  if char_length(trim(coalesce(p_bio, ''))) not between 20 and 2000 then
    raise exception 'invalid_bio';
  end if;
  if p_location_label is not null and char_length(trim(p_location_label)) > 120 then
    raise exception 'invalid_location';
  end if;

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
  if base_slug = '' then
    base_slug := 'photographe';
  end if;
  candidate_slug := base_slug;
  while exists (select 1 from public.photographers where slug = candidate_slug) loop
    suffix := suffix + 1;
    candidate_slug := base_slug || '-' || suffix;
  end loop;

  insert into public.photographers (slug, name, tagline, bio, location_label, socials, contact_email)
  values (
    candidate_slug,
    trim(p_name),
    trim(p_tagline),
    trim(p_bio),
    nullif(trim(coalesce(p_location_label, '')), ''),
    p_socials,
    normalized_email
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.create_public_photographer(text, text, text, text, jsonb, text, text) from public;
grant execute on function public.create_public_photographer(text, text, text, text, jsonb, text, text) to anon, authenticated;

create or replace function public.attach_photographer_photo(
  p_photographer_id uuid,
  p_object_path text,
  p_public_url text,
  p_display_order smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_photographer public.photographers%rowtype;
  new_photo_id uuid;
begin
  select * into target_photographer from public.photographers where id = p_photographer_id;
  if target_photographer.id is null or target_photographer.publication_state <> 'pending' then
    raise exception 'photographer_not_found';
  end if;

  if p_object_path !~ ('^photographers/' || p_photographer_id::text || '/') then
    raise exception 'invalid_object_path';
  end if;
  if position(p_object_path in coalesce(p_public_url, '')) = 0 then
    raise exception 'invalid_public_url';
  end if;
  if p_display_order not between 0 and 5 then
    raise exception 'invalid_display_order';
  end if;

  if (select count(*) from public.photographer_photos where photographer_id = p_photographer_id) >= 6 then
    raise exception 'too_many_photos';
  end if;

  insert into public.photographer_photos (photographer_id, object_path, public_url, display_order)
  values (p_photographer_id, p_object_path, p_public_url, p_display_order)
  returning id into new_photo_id;

  return new_photo_id;
end;
$$;

revoke all on function public.attach_photographer_photo(uuid, text, text, smallint) from public;
grant execute on function public.attach_photographer_photo(uuid, text, text, smallint) to anon, authenticated;

create or replace function public.list_public_photographers()
returns table (
  id uuid,
  slug text,
  name text,
  tagline text,
  bio text,
  location_label text,
  socials jsonb,
  cover_image_url text,
  photo_urls text[],
  average_rating numeric,
  review_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.slug,
    p.name,
    p.tagline,
    p.bio,
    p.location_label,
    p.socials,
    (select ph.public_url from public.photographer_photos ph where ph.photographer_id = p.id and ph.moderation_state = 'approved' order by ph.display_order limit 1),
    coalesce((select array_agg(ph.public_url order by ph.display_order) from public.photographer_photos ph where ph.photographer_id = p.id and ph.moderation_state = 'approved'), '{}'::text[]),
    (select round(avg(r.rating)::numeric, 1) from public.photographer_reviews r where r.photographer_id = p.id and r.moderation_state = 'approved'),
    coalesce((select count(*)::integer from public.photographer_reviews r where r.photographer_id = p.id and r.moderation_state = 'approved'), 0)
  from public.photographers p
  where p.publication_state = 'published'
  order by p.name;
$$;

revoke all on function public.list_public_photographers() from public;
grant execute on function public.list_public_photographers() to anon, authenticated;

create or replace function public.list_public_photographer_reviews(p_photographer_id uuid)
returns table (
  id uuid,
  rating smallint,
  comment text,
  reviewer_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.rating, r.comment, r.reviewer_name, r.created_at
  from public.photographer_reviews r
  where r.photographer_id = p_photographer_id
    and r.moderation_state = 'approved'
  order by r.created_at desc;
$$;

revoke all on function public.list_public_photographer_reviews(uuid) from public;
grant execute on function public.list_public_photographer_reviews(uuid) to anon, authenticated;

create or replace function public.create_public_photographer_review(
  p_photographer_id uuid,
  p_rating smallint,
  p_comment text,
  p_reviewer_name text,
  p_reviewer_email text,
  p_website text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text;
  new_id uuid;
begin
  if nullif(trim(coalesce(p_website, '')), '') is not null then
    return extensions.gen_random_uuid();
  end if;

  if not exists (select 1 from public.photographers where id = p_photographer_id and publication_state = 'published') then
    raise exception 'photographer_unavailable';
  end if;

  if p_rating not between 1 and 5 then
    raise exception 'invalid_rating';
  end if;
  if char_length(trim(coalesce(p_comment, ''))) not between 10 and 800 then
    raise exception 'invalid_comment';
  end if;
  if p_reviewer_name is not null and char_length(trim(p_reviewer_name)) > 80 then
    raise exception 'invalid_name';
  end if;

  normalized_email := nullif(lower(trim(coalesce(p_reviewer_email, ''))), '');
  if normalized_email is not null and (
    char_length(normalized_email) > 320
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then
    raise exception 'invalid_email';
  end if;

  if normalized_email is not null then
    if (
      select count(*) from public.photographer_reviews r
      where lower(r.reviewer_email) = normalized_email
        and r.created_at > now() - interval '1 hour'
    ) >= 3 then
      raise exception 'rate_limit';
    end if;
  else
    if (
      select count(*) from public.photographer_reviews r
      where r.photographer_id = p_photographer_id
        and r.reviewer_email is null
        and r.created_at > now() - interval '1 hour'
    ) >= 5 then
      raise exception 'rate_limit';
    end if;
  end if;

  insert into public.photographer_reviews (photographer_id, rating, comment, reviewer_name, reviewer_email)
  values (
    p_photographer_id,
    p_rating,
    trim(p_comment),
    nullif(trim(coalesce(p_reviewer_name, '')), ''),
    normalized_email
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.create_public_photographer_review(uuid, smallint, text, text, text, text) from public;
grant execute on function public.create_public_photographer_review(uuid, smallint, text, text, text, text) to anon, authenticated;

create or replace function public.admin_review_photographer(
  p_photographer_id uuid,
  p_decision text,
  p_internal_note text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected public.photographers%rowtype;
begin
  if not private.is_staff() then raise exception 'Forbidden'; end if;

  select * into selected from public.photographers where id = p_photographer_id for update;
  if selected.id is null then raise exception 'photographer_not_found'; end if;
  if selected.publication_state <> 'pending' then raise exception 'already_reviewed'; end if;
  if p_decision not in ('published', 'rejected') then raise exception 'invalid_decision'; end if;
  if char_length(trim(coalesce(p_internal_note, ''))) > 2000 then raise exception 'invalid_note'; end if;

  update public.photographers
  set publication_state = p_decision::public.photographer_state,
      internal_note = nullif(trim(coalesce(p_internal_note, '')), ''),
      decided_at = now()
  where id = p_photographer_id;

  if p_decision = 'published' then
    update public.photographer_photos
    set moderation_state = 'approved'
    where photographer_id = p_photographer_id and moderation_state = 'pending';
  end if;

  return p_photographer_id;
end;
$$;

revoke all on function public.admin_review_photographer(uuid, text, text) from public;
grant execute on function public.admin_review_photographer(uuid, text, text) to authenticated;

create or replace function public.admin_set_photographer_state(
  p_photographer_id uuid,
  p_state text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.is_staff() then raise exception 'Forbidden'; end if;
  if p_state not in ('published', 'hidden') then raise exception 'invalid_state'; end if;

  update public.photographers
  set publication_state = p_state::public.photographer_state
  where id = p_photographer_id
    and publication_state in ('published', 'hidden');

  if not found then raise exception 'photographer_not_found'; end if;

  return p_photographer_id;
end;
$$;

revoke all on function public.admin_set_photographer_state(uuid, text) from public;
grant execute on function public.admin_set_photographer_state(uuid, text) to authenticated;

create or replace function public.admin_set_photographer_photo_state(
  p_photo_id uuid,
  p_moderation_state text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected public.photographer_photos%rowtype;
begin
  if not private.is_staff() then raise exception 'Forbidden'; end if;
  if p_moderation_state not in ('approved', 'hidden') then raise exception 'invalid_state'; end if;

  select * into selected from public.photographer_photos where id = p_photo_id for update;
  if selected.id is null then raise exception 'photo_not_found'; end if;

  update public.photographer_photos
  set moderation_state = p_moderation_state::public.photo_moderation_state
  where id = p_photo_id;

  insert into public.moderation_actions (actor_user_id, entity_type, entity_id, action, previous_state, next_state, details)
  values (auth.uid(), 'photo', p_photo_id::text, 'photo_state_decision', selected.moderation_state::text, p_moderation_state, jsonb_build_object('photographer_id', selected.photographer_id));

  return selected.photographer_id;
end;
$$;

revoke all on function public.admin_set_photographer_photo_state(uuid, text) from public;
grant execute on function public.admin_set_photographer_photo_state(uuid, text) to authenticated;

create or replace function public.admin_review_photographer_review(
  p_review_id uuid,
  p_moderation_state text,
  p_internal_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected public.photographer_reviews%rowtype;
begin
  if not private.is_staff() then raise exception 'Forbidden'; end if;
  if p_moderation_state not in ('approved', 'rejected', 'hidden') then raise exception 'invalid_state'; end if;

  select * into selected from public.photographer_reviews where id = p_review_id for update;
  if selected.id is null then raise exception 'review_not_found'; end if;
  if char_length(trim(coalesce(p_internal_note, ''))) > 2000 then raise exception 'invalid_note'; end if;

  update public.photographer_reviews
  set moderation_state = p_moderation_state::public.photo_moderation_state,
      internal_note = coalesce(nullif(trim(coalesce(p_internal_note, '')), ''), internal_note)
  where id = p_review_id;

  insert into public.moderation_actions (actor_user_id, entity_type, entity_id, action, previous_state, next_state, details)
  values (auth.uid(), 'photographer_review', p_review_id::text, 'review_decision', selected.moderation_state::text, p_moderation_state, jsonb_build_object('photographer_id', selected.photographer_id));

  return selected.photographer_id;
end;
$$;

revoke all on function public.admin_review_photographer_review(uuid, text, text) from public;
grant execute on function public.admin_review_photographer_review(uuid, text, text) to authenticated;
