create schema if not exists extensions;
create schema if not exists private;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists unaccent with schema extensions;

create type public.admin_role as enum ('moderator', 'administrator');
create type public.display_precision as enum ('exact', 'approximate', 'hidden');
create type public.best_time as enum ('morning', 'day', 'golden_hour', 'sunset', 'night');
create type public.access_level as enum ('easy', 'intermediate', 'difficult');
create type public.surface_type as enum ('asphalt', 'gravel', 'earth', 'mixed');
create type public.attendance_level as enum ('quiet', 'variable', 'busy');
create type public.location_status as enum ('public', 'private_with_permission', 'to_confirm', 'sensitive');
create type public.spot_state as enum ('published', 'hidden', 'sensitive', 'archived', 'review_due');
create type public.proposal_state as enum ('draft', 'email_pending', 'submitted', 'changes_requested', 'approved', 'rejected', 'duplicate', 'withdrawn');
create type public.photo_moderation_state as enum ('pending', 'approved', 'hidden', 'rejected');
create type public.report_reason as enum ('access_forbidden', 'immediate_danger', 'incorrect_information', 'image_or_identifiable_person', 'private_property_or_nuisance', 'duplicate', 'other');
create type public.report_priority as enum ('normal', 'high');
create type public.report_state as enum ('open', 'in_review', 'resolved', 'dismissed');

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.admin_role not null default 'moderator',
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.spots (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 3 and 120),
  location extensions.geography(point, 4326) not null,
  display_precision public.display_precision not null default 'exact',
  municipality text not null,
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  search_radius_meters integer not null default 60000 check (search_radius_meters between 1000 and 200000),
  short_description text not null check (char_length(short_description) between 20 and 500),
  best_times public.best_time[] not null default '{}',
  light_orientation text,
  access_level public.access_level not null,
  parking text not null,
  walking_approach text not null,
  surface_type public.surface_type not null,
  attendance public.attendance_level not null,
  location_status public.location_status not null,
  warnings text[] not null default '{}',
  publication_state public.spot_state not null default 'hidden',
  last_verified_at date not null,
  last_verified_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index spots_location_gix on public.spots using gist (location);
create index spots_publication_state_idx on public.spots (publication_state);
create index spots_last_verified_at_idx on public.spots (last_verified_at);
create index spots_municipality_idx on public.spots (municipality);

create table public.spot_categories (
  spot_id uuid not null references public.spots (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  primary key (spot_id, category_id)
);

create table public.spot_photos (
  id uuid primary key default extensions.gen_random_uuid(),
  spot_id uuid not null references public.spots (id) on delete cascade,
  original_object_path text not null,
  published_object_path text,
  public_url text,
  display_order smallint not null default 0 check (display_order between 0 and 5),
  alt_text text,
  credit text,
  rights_declared boolean not null default false,
  moderation_state public.photo_moderation_state not null default 'pending',
  metadata_stripped_at timestamptz,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  unique (spot_id, display_order)
);

create table public.proposals (
  id uuid primary key default extensions.gen_random_uuid(),
  tracking_id text not null unique default ('SPT-' || upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 10))),
  payload jsonb not null default '{}'::jsonb,
  contributor_email text not null check (char_length(contributor_email) between 3 and 320),
  public_pseudonym text,
  state public.proposal_state not null default 'draft',
  charter_version text,
  contribution_terms_version text,
  privacy_notice_version text,
  image_rights_accepted_at timestamptz,
  recognizable_people_confirmed_at timestamptz,
  email_verification_token_hash text,
  email_verification_expires_at timestamptz,
  email_verified_at timestamptz,
  moderation_comment text,
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index proposals_state_created_at_idx on public.proposals (state, created_at);
create index proposals_unconfirmed_expiry_idx on public.proposals (email_verification_expires_at) where state = 'email_pending';

create table public.proposal_photos (
  id uuid primary key default extensions.gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  original_object_path text not null,
  display_order smallint not null check (display_order between 0 and 5),
  credit text,
  rights_declared boolean not null default false,
  moderation_state public.photo_moderation_state not null default 'pending',
  created_at timestamptz not null default now(),
  unique (proposal_id, display_order)
);

create table public.reports (
  id uuid primary key default extensions.gen_random_uuid(),
  spot_id uuid not null references public.spots (id) on delete cascade,
  reason public.report_reason not null,
  comment text not null check (char_length(comment) between 10 and 2000),
  reporter_email text,
  priority public.report_priority not null default 'normal',
  state public.report_state not null default 'open',
  decision text,
  internal_note text,
  handled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  updated_at timestamptz not null default now()
);

create index reports_queue_idx on public.reports (state, priority, created_at);

create table public.moderation_actions (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users (id) on delete set null,
  entity_type text not null check (entity_type in ('spot', 'proposal', 'report', 'photo', 'setting', 'admin_user')),
  entity_id text not null,
  action text not null,
  previous_state text,
  next_state text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index moderation_actions_entity_idx on public.moderation_actions (entity_type, entity_id, created_at desc);

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (
      select 1 from public.admin_users au
      where au.user_id = auth.uid()
    );
$$;

create or replace function private.is_administrator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (
      select 1 from public.admin_users au
      where au.user_id = auth.uid() and au.role = 'administrator'
    );
$$;

revoke all on function private.is_staff() from public;
revoke all on function private.is_administrator() from public;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_administrator() to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger admin_users_set_updated_at before update on public.admin_users for each row execute function private.set_updated_at();
create trigger categories_set_updated_at before update on public.categories for each row execute function private.set_updated_at();
create trigger spots_set_updated_at before update on public.spots for each row execute function private.set_updated_at();
create trigger proposals_set_updated_at before update on public.proposals for each row execute function private.set_updated_at();
create trigger reports_set_updated_at before update on public.reports for each row execute function private.set_updated_at();

create or replace function private.validate_spot_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.publication_state = new.publication_state then return new; end if;

  if not (
    (old.publication_state = 'published' and new.publication_state in ('hidden', 'sensitive', 'archived', 'review_due'))
    or (old.publication_state = 'hidden' and new.publication_state in ('published', 'sensitive', 'archived'))
    or (old.publication_state = 'sensitive' and new.publication_state in ('published', 'hidden', 'archived', 'review_due'))
    or (old.publication_state = 'archived' and new.publication_state in ('hidden', 'published'))
    or (old.publication_state = 'review_due' and new.publication_state in ('published', 'hidden', 'sensitive', 'archived'))
  ) then
    raise exception 'Invalid spot state transition: % -> %', old.publication_state, new.publication_state;
  end if;

  return new;
end;
$$;

create trigger spots_validate_transition before update of publication_state on public.spots for each row execute function private.validate_spot_transition();

create or replace function private.validate_proposal_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.state = new.state then return new; end if;

  if not (
    (old.state = 'draft' and new.state in ('email_pending', 'withdrawn'))
    or (old.state = 'email_pending' and new.state in ('submitted', 'withdrawn'))
    or (old.state = 'submitted' and new.state in ('changes_requested', 'approved', 'rejected', 'duplicate', 'withdrawn'))
    or (old.state = 'changes_requested' and new.state in ('submitted', 'rejected', 'withdrawn'))
    or (old.state in ('approved', 'rejected', 'duplicate') and new.state = 'withdrawn')
  ) then
    raise exception 'Invalid proposal state transition: % -> %', old.state, new.state;
  end if;

  return new;
end;
$$;

create trigger proposals_validate_transition before update of state on public.proposals for each row execute function private.validate_proposal_transition();

create or replace function private.prioritize_report()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.reason in ('access_forbidden', 'immediate_danger', 'image_or_identifiable_person', 'private_property_or_nuisance') then
    new.priority = 'high';
  end if;
  return new;
end;
$$;

create trigger reports_set_priority before insert or update of reason on public.reports for each row execute function private.prioritize_report();

create or replace function private.audit_state_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_state text;
  new_state text;
begin
  if tg_table_name = 'spots' then
    old_state := old.publication_state::text;
    new_state := new.publication_state::text;
  elsif tg_table_name = 'proposals' then
    old_state := old.state::text;
    new_state := new.state::text;
  else
    old_state := old.state::text;
    new_state := new.state::text;
  end if;

  if old_state is distinct from new_state then
    insert into public.moderation_actions (actor_user_id, entity_type, entity_id, action, previous_state, next_state)
    values (auth.uid(), rtrim(tg_table_name, 's'), new.id::text, 'state_changed', old_state, new_state);
  end if;
  return new;
end;
$$;

create trigger spots_audit_state after update of publication_state on public.spots for each row execute function private.audit_state_change();
create trigger proposals_audit_state after update of state on public.proposals for each row execute function private.audit_state_change();
create trigger reports_audit_state after update of state on public.reports for each row execute function private.audit_state_change();

alter table public.admin_users enable row level security;
alter table public.categories enable row level security;
alter table public.app_settings enable row level security;
alter table public.spots enable row level security;
alter table public.spot_categories enable row level security;
alter table public.spot_photos enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_photos enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;

create policy "staff read own profile" on public.admin_users for select to authenticated using (private.is_staff());
create policy "administrators manage staff" on public.admin_users for all to authenticated using (private.is_administrator()) with check (private.is_administrator());

create policy "staff manage categories" on public.categories for all to authenticated using (private.is_staff()) with check (private.is_staff());
create policy "staff manage settings" on public.app_settings for all to authenticated using (private.is_staff()) with check (private.is_staff());
create policy "staff manage spots" on public.spots for all to authenticated using (private.is_staff()) with check (private.is_staff());
create policy "staff manage spot categories" on public.spot_categories for all to authenticated using (private.is_staff()) with check (private.is_staff());
create policy "staff manage spot photos" on public.spot_photos for all to authenticated using (private.is_staff()) with check (private.is_staff());
create policy "staff manage proposals" on public.proposals for all to authenticated using (private.is_staff()) with check (private.is_staff());
create policy "staff manage proposal photos" on public.proposal_photos for all to authenticated using (private.is_staff()) with check (private.is_staff());
create policy "staff manage reports" on public.reports for all to authenticated using (private.is_staff()) with check (private.is_staff());
create policy "staff read audit log" on public.moderation_actions for select to authenticated using (private.is_staff());

revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update, delete on public.admin_users, public.categories, public.app_settings, public.spots, public.spot_categories, public.spot_photos, public.proposals, public.proposal_photos, public.reports to authenticated;
grant select on public.moderation_actions to authenticated;
grant usage, select on sequence public.moderation_actions_id_seq to authenticated;

create or replace function public.list_public_spots()
returns table (
  id uuid,
  slug text,
  name text,
  municipality text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  display_precision public.display_precision,
  short_description text,
  categories text[],
  best_times text[],
  access_level text,
  surface_type text,
  attendance text,
  location_status text,
  warnings text[],
  parking text,
  walking_approach text,
  light_orientation text,
  last_verified_at date,
  cover_image_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.slug,
    s.name,
    s.municipality,
    s.postal_code,
    case when s.display_precision = 'approximate' or s.publication_state = 'sensitive'
      then round(extensions.st_y(s.location::extensions.geometry)::numeric, 2)::double precision
      else extensions.st_y(s.location::extensions.geometry)
    end as latitude,
    case when s.display_precision = 'approximate' or s.publication_state = 'sensitive'
      then round(extensions.st_x(s.location::extensions.geometry)::numeric, 2)::double precision
      else extensions.st_x(s.location::extensions.geometry)
    end as longitude,
    case when s.publication_state = 'sensitive' then 'approximate'::public.display_precision else s.display_precision end,
    s.short_description,
    coalesce((select array_agg(c.slug order by c.sort_order, c.label) from public.spot_categories sc join public.categories c on c.id = sc.category_id where sc.spot_id = s.id and c.is_active), '{}'::text[]),
    s.best_times::text[],
    s.access_level::text,
    s.surface_type::text,
    s.attendance::text,
    s.location_status::text,
    s.warnings,
    s.parking,
    s.walking_approach,
    s.light_orientation,
    s.last_verified_at,
    (select p.public_url from public.spot_photos p where p.spot_id = s.id and p.moderation_state = 'approved' and p.removed_at is null order by p.display_order limit 1)
  from public.spots s
  where s.publication_state in ('published', 'sensitive', 'review_due')
    and s.display_precision <> 'hidden'
  order by s.name;
$$;

revoke all on function public.list_public_spots() from public;
grant execute on function public.list_public_spots() to anon, authenticated;

create or replace function public.admin_create_spot(
  p_name text,
  p_slug text,
  p_latitude double precision,
  p_longitude double precision,
  p_municipality text,
  p_postal_code text,
  p_short_description text,
  p_category_slug text,
  p_best_time text,
  p_access_level text,
  p_parking text,
  p_walking_approach text,
  p_surface_type text,
  p_attendance text,
  p_location_status text,
  p_display_precision text,
  p_warnings text[] default '{}'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_spot_id uuid;
  selected_category_id uuid;
begin
  if not private.is_staff() then raise exception 'Forbidden'; end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'Invalid coordinates'; end if;

  select id into selected_category_id from public.categories where slug = p_category_slug and is_active;
  if selected_category_id is null then raise exception 'Unknown category'; end if;

  insert into public.spots (
    slug, name, location, display_precision, municipality, postal_code,
    short_description, best_times, access_level, parking, walking_approach,
    surface_type, attendance, location_status, warnings, publication_state,
    last_verified_at, last_verified_by
  ) values (
    p_slug,
    p_name,
    extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
    p_display_precision::public.display_precision,
    p_municipality,
    p_postal_code,
    p_short_description,
    array[p_best_time::public.best_time],
    p_access_level::public.access_level,
    p_parking,
    p_walking_approach,
    p_surface_type::public.surface_type,
    p_attendance::public.attendance_level,
    p_location_status::public.location_status,
    p_warnings,
    'published',
    current_date,
    auth.uid()
  ) returning id into created_spot_id;

  insert into public.spot_categories (spot_id, category_id) values (created_spot_id, selected_category_id);
  insert into public.moderation_actions (actor_user_id, entity_type, entity_id, action, next_state)
  values (auth.uid(), 'spot', created_spot_id::text, 'created', 'published');

  return created_spot_id;
end;
$$;

revoke all on function public.admin_create_spot(text, text, double precision, double precision, text, text, text, text, text, text, text, text, text, text, text, text, text[]) from public;
grant execute on function public.admin_create_spot(text, text, double precision, double precision, text, text, text, text, text, text, text, text, text, text, text, text, text[]) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('spot-originals', 'spot-originals', false, 15728640, array['image/jpeg', 'image/png', 'image/webp']),
  ('spot-published', 'spot-published', true, 8388608, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "staff manage original images" on storage.objects for all to authenticated using (bucket_id = 'spot-originals' and private.is_staff()) with check (bucket_id = 'spot-originals' and private.is_staff());
create policy "staff manage published images" on storage.objects for all to authenticated using (bucket_id = 'spot-published' and private.is_staff()) with check (bucket_id = 'spot-published' and private.is_staff());
create policy "public read published images" on storage.objects for select to anon, authenticated using (bucket_id = 'spot-published');

insert into public.app_settings (key, value, description)
values
  ('launch_center', '{"latitude":43.6045,"longitude":1.4442}'::jsonb, 'Centre initial de la carte'),
  ('launch_radius_km', '60'::jsonb, 'Rayon indicatif autour de Toulouse'),
  ('spot_review_after_months', '12'::jsonb, 'Délai avant passage à review_due')
on conflict (key) do nothing;
