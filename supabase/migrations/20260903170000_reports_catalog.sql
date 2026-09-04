alter table public.reports
  add constraint reports_reporter_email_length_check
  check (reporter_email is null or char_length(reporter_email) between 3 and 320);

create or replace function private.validate_report_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.state = new.state then return new; end if;

  if not (
    (old.state = 'open' and new.state in ('in_review', 'resolved', 'dismissed'))
    or (old.state = 'in_review' and new.state in ('resolved', 'dismissed'))
  ) then
    raise exception 'Invalid report state transition: % -> %', old.state, new.state;
  end if;

  return new;
end;
$$;

create trigger reports_validate_transition
before update of state on public.reports
for each row execute function private.validate_report_transition();

create or replace function public.create_public_report(
  p_spot_id uuid,
  p_reason text,
  p_comment text,
  p_email text default null,
  p_website text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text;
  created_report_id uuid;
begin
  -- A filled honeypot is accepted without persisting data so automated senders
  -- cannot use the response to tune their submissions.
  if nullif(trim(coalesce(p_website, '')), '') is not null then
    return extensions.gen_random_uuid();
  end if;

  if p_reason not in (
    'access_forbidden',
    'immediate_danger',
    'incorrect_information',
    'image_or_identifiable_person',
    'private_property_or_nuisance',
    'duplicate',
    'other'
  ) then
    raise exception 'invalid_reason';
  end if;

  if char_length(trim(coalesce(p_comment, ''))) not between 10 and 2000 then
    raise exception 'invalid_comment';
  end if;

  normalized_email := nullif(lower(trim(coalesce(p_email, ''))), '');
  if normalized_email is not null and (
    char_length(normalized_email) > 320
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then
    raise exception 'invalid_email';
  end if;

  if p_reason in ('image_or_identifiable_person', 'private_property_or_nuisance')
    and normalized_email is null then
    raise exception 'email_required';
  end if;

  if not exists (
    select 1
    from public.spots s
    where s.id = p_spot_id
      and s.publication_state in ('published', 'sensitive', 'review_due')
      and s.display_precision <> 'hidden'
  ) then
    raise exception 'spot_unavailable';
  end if;

  if normalized_email is not null and (
    select count(*)
    from public.reports r
    where lower(r.reporter_email) = normalized_email
      and r.created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception 'rate_limit';
  end if;

  if normalized_email is null and (
    select count(*)
    from public.reports r
    where r.spot_id = p_spot_id
      and r.reporter_email is null
      and r.created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'rate_limit';
  end if;

  insert into public.reports (spot_id, reason, comment, reporter_email)
  values (p_spot_id, p_reason::public.report_reason, trim(p_comment), normalized_email)
  returning id into created_report_id;

  return created_report_id;
end;
$$;

revoke all on function public.create_public_report(uuid, text, text, text, text) from public;
grant execute on function public.create_public_report(uuid, text, text, text, text) to anon, authenticated;

create or replace function public.get_public_spot_unavailability(p_slug text)
returns table (name text, publication_state text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.name, s.publication_state::text
  from public.spots s
  where s.slug = p_slug
    and (
      s.publication_state in ('hidden', 'archived')
      or s.display_precision = 'hidden'
    )
  limit 1;
$$;

revoke all on function public.get_public_spot_unavailability(text) from public;
grant execute on function public.get_public_spot_unavailability(text) to anon, authenticated;

create or replace function public.admin_review_report(
  p_report_id uuid,
  p_next_state text,
  p_decision text,
  p_internal_note text,
  p_hide_spot boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_report public.reports%rowtype;
  selected_spot public.spots%rowtype;
begin
  if not private.is_staff() then raise exception 'Forbidden'; end if;

  select * into selected_report
  from public.reports r
  where r.id = p_report_id
  for update;

  if selected_report.id is null then raise exception 'report_not_found'; end if;
  if selected_report.state in ('resolved', 'dismissed') then raise exception 'report_already_reviewed'; end if;
  if p_next_state not in ('in_review', 'resolved', 'dismissed') then raise exception 'invalid_decision'; end if;
  if char_length(trim(coalesce(p_internal_note, ''))) > 2000 then raise exception 'invalid_note'; end if;
  if p_next_state in ('resolved', 'dismissed')
    and char_length(trim(coalesce(p_decision, ''))) not between 3 and 1000 then
    raise exception 'decision_required';
  end if;

  if p_hide_spot then
    select * into selected_spot
    from public.spots s
    where s.id = selected_report.spot_id
    for update;

    if selected_spot.publication_state in ('published', 'sensitive', 'review_due') then
      update public.spots
      set publication_state = 'hidden'
      where id = selected_spot.id;
    end if;
  end if;

  update public.reports
  set state = p_next_state::public.report_state,
      decision = case when p_next_state in ('resolved', 'dismissed') then trim(p_decision) else decision end,
      internal_note = nullif(trim(coalesce(p_internal_note, '')), ''),
      handled_by = auth.uid(),
      handled_at = case when p_next_state in ('resolved', 'dismissed') then now() else null end
  where id = selected_report.id;

  insert into public.moderation_actions (
    actor_user_id, entity_type, entity_id, action, previous_state, next_state, details
  ) values (
    auth.uid(),
    'report',
    selected_report.id::text,
    'review_updated',
    selected_report.state::text,
    p_next_state,
    jsonb_build_object(
      'spot_id', selected_report.spot_id,
      'spot_hidden', p_hide_spot,
      'decision', nullif(trim(coalesce(p_decision, '')), ''),
      'internal_note', nullif(trim(coalesce(p_internal_note, '')), '')
    )
  );

  return selected_report.spot_id;
end;
$$;

revoke all on function public.admin_review_report(uuid, text, text, text, boolean) from public;
grant execute on function public.admin_review_report(uuid, text, text, text, boolean) to authenticated;

create or replace function public.admin_list_spots()
returns table (
  id uuid,
  slug text,
  name text,
  municipality text,
  postal_code text,
  publication_state text,
  display_precision text,
  last_verified_at date,
  updated_at timestamptz,
  categories text[],
  open_report_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    s.id,
    s.slug,
    s.name,
    s.municipality,
    s.postal_code,
    s.publication_state::text,
    s.display_precision::text,
    s.last_verified_at,
    s.updated_at,
    coalesce((
      select array_agg(c.slug order by c.sort_order, c.label)
      from public.spot_categories sc
      join public.categories c on c.id = sc.category_id
      where sc.spot_id = s.id
    ), '{}'::text[]),
    (select count(*) from public.reports r where r.spot_id = s.id and r.state in ('open', 'in_review'))
  from public.spots s
  where private.is_staff()
  order by s.updated_at desc, s.name;
$$;

revoke all on function public.admin_list_spots() from public;
grant execute on function public.admin_list_spots() to authenticated;

create or replace function public.admin_get_spot(p_spot_id uuid)
returns table (
  id uuid,
  slug text,
  name text,
  latitude double precision,
  longitude double precision,
  municipality text,
  postal_code text,
  short_description text,
  categories text[],
  best_times text[],
  light_orientation text,
  access_level text,
  parking text,
  walking_approach text,
  surface_type text,
  attendance text,
  location_status text,
  display_precision text,
  warnings text[],
  publication_state text,
  last_verified_at date,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    s.id,
    s.slug,
    s.name,
    extensions.st_y(s.location::extensions.geometry),
    extensions.st_x(s.location::extensions.geometry),
    s.municipality,
    s.postal_code,
    s.short_description,
    coalesce((
      select array_agg(c.slug order by c.sort_order, c.label)
      from public.spot_categories sc
      join public.categories c on c.id = sc.category_id
      where sc.spot_id = s.id
    ), '{}'::text[]),
    s.best_times::text[],
    s.light_orientation,
    s.access_level::text,
    s.parking,
    s.walking_approach,
    s.surface_type::text,
    s.attendance::text,
    s.location_status::text,
    s.display_precision::text,
    s.warnings,
    s.publication_state::text,
    s.last_verified_at,
    s.updated_at
  from public.spots s
  where s.id = p_spot_id
    and private.is_staff();
$$;

revoke all on function public.admin_get_spot(uuid) from public;
grant execute on function public.admin_get_spot(uuid) to authenticated;

create or replace function public.admin_update_spot(
  p_spot_id uuid,
  p_name text,
  p_latitude double precision,
  p_longitude double precision,
  p_municipality text,
  p_postal_code text,
  p_short_description text,
  p_category_slugs text[],
  p_best_times text[],
  p_light_orientation text,
  p_access_level text,
  p_parking text,
  p_walking_approach text,
  p_surface_type text,
  p_attendance text,
  p_location_status text,
  p_display_precision text,
  p_warnings text[],
  p_mark_verified boolean default false
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_spot public.spots%rowtype;
begin
  if not private.is_staff() then raise exception 'Forbidden'; end if;

  select * into selected_spot
  from public.spots s
  where s.id = p_spot_id
  for update;

  if selected_spot.id is null then raise exception 'spot_not_found'; end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'invalid_coordinates'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 3 and 120
    or char_length(trim(coalesce(p_municipality, ''))) not between 2 and 120
    or coalesce(p_postal_code, '') !~ '^[0-9]{5}$'
    or char_length(trim(coalesce(p_short_description, ''))) not between 20 and 500
    or char_length(trim(coalesce(p_parking, ''))) not between 3 and 500
    or char_length(trim(coalesce(p_walking_approach, ''))) not between 3 and 500
    or char_length(trim(coalesce(p_light_orientation, ''))) > 500 then
    raise exception 'invalid_content';
  end if;
  if cardinality(p_category_slugs) not between 1 and 3
    or (select count(distinct c.slug) from public.categories c where c.slug = any(p_category_slugs) and c.is_active) <> cardinality(p_category_slugs) then
    raise exception 'invalid_categories';
  end if;
  if cardinality(p_best_times) not between 1 and 3
    or (select count(distinct value) from unnest(p_best_times) value where value in ('morning', 'day', 'golden_hour', 'sunset', 'night')) <> cardinality(p_best_times) then
    raise exception 'invalid_best_times';
  end if;
  if cardinality(p_warnings) > 8 or exists (select 1 from unnest(p_warnings) warning where char_length(warning) > 500) then
    raise exception 'invalid_warnings';
  end if;

  update public.spots
  set name = trim(p_name),
      location = extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
      municipality = trim(p_municipality),
      postal_code = p_postal_code,
      short_description = trim(p_short_description),
      best_times = p_best_times::public.best_time[],
      light_orientation = nullif(trim(coalesce(p_light_orientation, '')), ''),
      access_level = p_access_level::public.access_level,
      parking = trim(p_parking),
      walking_approach = trim(p_walking_approach),
      surface_type = p_surface_type::public.surface_type,
      attendance = p_attendance::public.attendance_level,
      location_status = p_location_status::public.location_status,
      display_precision = p_display_precision::public.display_precision,
      warnings = p_warnings,
      last_verified_at = case when p_mark_verified then current_date else last_verified_at end,
      last_verified_by = case when p_mark_verified then auth.uid() else last_verified_by end
  where id = selected_spot.id;

  delete from public.spot_categories where spot_id = selected_spot.id;
  insert into public.spot_categories (spot_id, category_id)
  select selected_spot.id, c.id
  from public.categories c
  where c.slug = any(p_category_slugs);

  insert into public.moderation_actions (actor_user_id, entity_type, entity_id, action, details)
  values (
    auth.uid(),
    'spot',
    selected_spot.id::text,
    'content_updated',
    jsonb_build_object('marked_verified', p_mark_verified, 'categories', p_category_slugs)
  );

  return selected_spot.slug;
end;
$$;

revoke all on function public.admin_update_spot(uuid, text, double precision, double precision, text, text, text, text[], text[], text, text, text, text, text, text, text, text, text[], boolean) from public;
grant execute on function public.admin_update_spot(uuid, text, double precision, double precision, text, text, text, text[], text[], text, text, text, text, text, text, text, text, text[], boolean) to authenticated;

create or replace function public.admin_change_spot_state(
  p_spot_id uuid,
  p_next_state text,
  p_note text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_spot public.spots%rowtype;
begin
  if not private.is_staff() then raise exception 'Forbidden'; end if;

  select * into selected_spot
  from public.spots s
  where s.id = p_spot_id
  for update;

  if selected_spot.id is null then raise exception 'spot_not_found'; end if;
  if selected_spot.publication_state::text = p_next_state then return selected_spot.slug; end if;
  if p_next_state not in ('published', 'hidden', 'sensitive', 'archived', 'review_due') then raise exception 'invalid_state'; end if;
  if char_length(trim(coalesce(p_note, ''))) not between 3 and 1000 then raise exception 'note_required'; end if;

  update public.spots
  set publication_state = p_next_state::public.spot_state,
      last_verified_at = case when p_next_state in ('published', 'sensitive') then current_date else last_verified_at end,
      last_verified_by = case when p_next_state in ('published', 'sensitive') then auth.uid() else last_verified_by end
  where id = selected_spot.id;

  insert into public.moderation_actions (
    actor_user_id, entity_type, entity_id, action, previous_state, next_state, details
  ) values (
    auth.uid(),
    'spot',
    selected_spot.id::text,
    'publication_state_decision',
    selected_spot.publication_state::text,
    p_next_state,
    jsonb_build_object('note', trim(p_note))
  );

  return selected_spot.slug;
end;
$$;

revoke all on function public.admin_change_spot_state(uuid, text, text) from public;
grant execute on function public.admin_change_spot_state(uuid, text, text) to authenticated;

create or replace function public.admin_refresh_review_due_spots()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  review_after_months integer;
  updated_count integer;
begin
  if not private.is_staff() then raise exception 'Forbidden'; end if;

  select coalesce((value #>> '{}')::integer, 12)
  into review_after_months
  from public.app_settings
  where key = 'spot_review_after_months';

  review_after_months := coalesce(review_after_months, 12);

  update public.spots
  set publication_state = 'review_due'
  where publication_state in ('published', 'sensitive')
    and last_verified_at < current_date - make_interval(months => review_after_months);

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.admin_refresh_review_due_spots() from public;
grant execute on function public.admin_refresh_review_due_spots() to authenticated;
