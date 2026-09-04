alter table public.proposals
  add column upload_secret_hash text,
  add column confirmation_sent_at timestamptz;

alter table public.proposal_photos
  add column processed_object_path text,
  add column detected_mime_type text,
  add column byte_size integer check (byte_size between 1 and 15728640),
  add column width integer check (width between 1 and 20000),
  add column height integer check (height between 1 and 20000),
  add column metadata_stripped_at timestamptz;

create index proposals_email_created_at_idx
  on public.proposals (lower(contributor_email), created_at desc);

create or replace function private.may_upload_proposal_object(p_object_name text)
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

  if array_length(folders, 1) <> 3 or folders[1] <> 'proposals' then
    return false;
  end if;

  return exists (
    select 1
    from public.proposals p
    where p.id::text = folders[2]
      and p.state = 'email_pending'
      and p.email_verification_expires_at > now()
      and p.upload_secret_hash = encode(extensions.digest(folders[3], 'sha256'), 'hex')
      and (
        select count(*)
        from storage.objects o
        where o.bucket_id = 'spot-originals'
          and o.name like ('proposals/' || p.id::text || '/' || folders[3] || '/%')
      ) < 12
  );
end;
$$;

revoke all on function private.may_upload_proposal_object(text) from public;
grant execute on function private.may_upload_proposal_object(text) to anon, authenticated;

create policy "proposal capability uploads"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'spot-originals'
  and private.may_upload_proposal_object(name)
);

create or replace function public.create_public_proposal(
  p_payload jsonb,
  p_email text,
  p_pseudonym text,
  p_email_token_hash text,
  p_upload_secret_hash text,
  p_rights_declared boolean,
  p_people_confirmed boolean,
  p_charter_accepted boolean,
  p_terms_accepted boolean,
  p_privacy_accepted boolean
)
returns table (proposal_id uuid, tracking_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text;
  created_proposal_id uuid;
  created_tracking_id text;
begin
  normalized_email := lower(trim(p_email));

  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(normalized_email) > 320 then
    raise exception 'invalid_email';
  end if;

  if p_email_token_hash !~ '^[a-f0-9]{64}$'
    or p_upload_secret_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_capability';
  end if;

  if not (p_rights_declared and p_people_confirmed and p_charter_accepted and p_terms_accepted and p_privacy_accepted) then
    raise exception 'missing_consent';
  end if;

  if jsonb_typeof(p_payload) <> 'object'
    or char_length(trim(coalesce(p_payload ->> 'name', ''))) not between 3 and 120
    or char_length(trim(coalesce(p_payload ->> 'municipality', ''))) not between 2 and 120
    or coalesce(p_payload ->> 'postalCode', '') !~ '^[0-9]{5}$'
    or char_length(trim(coalesce(p_payload ->> 'shortDescription', ''))) not between 20 and 500
    or coalesce(p_payload ->> 'accessWithoutTrespass', 'false') <> 'true'
    or jsonb_typeof(p_payload -> 'categories') <> 'array'
    or jsonb_array_length(p_payload -> 'categories') not between 1 and 3
    or jsonb_typeof(p_payload -> 'bestTimes') <> 'array'
    or jsonb_array_length(p_payload -> 'bestTimes') not between 1 and 3 then
    raise exception 'invalid_payload';
  end if;

  if (p_payload ->> 'latitude')::double precision not between -90 and 90
    or (p_payload ->> 'longitude')::double precision not between -180 and 180 then
    raise exception 'invalid_coordinates';
  end if;

  if (
    select count(*)
    from public.proposals p
    where lower(p.contributor_email) = normalized_email
      and p.created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception 'rate_limit';
  end if;

  insert into public.proposals (
    payload,
    contributor_email,
    public_pseudonym,
    state,
    charter_version,
    contribution_terms_version,
    privacy_notice_version,
    image_rights_accepted_at,
    recognizable_people_confirmed_at,
    email_verification_token_hash,
    email_verification_expires_at,
    upload_secret_hash
  ) values (
    p_payload,
    normalized_email,
    nullif(trim(p_pseudonym), ''),
    'email_pending',
    '2026-09-03',
    '2026-09-03',
    '2026-09-03',
    now(),
    now(),
    p_email_token_hash,
    now() + interval '24 hours',
    p_upload_secret_hash
  )
  returning id, proposals.tracking_id
  into created_proposal_id, created_tracking_id;

  return query select created_proposal_id, created_tracking_id;
end;
$$;

revoke all on function public.create_public_proposal(jsonb, text, text, text, text, boolean, boolean, boolean, boolean, boolean) from public;
grant execute on function public.create_public_proposal(jsonb, text, text, text, text, boolean, boolean, boolean, boolean, boolean) to anon, authenticated;

create or replace function public.attach_proposal_photo(
  p_proposal_id uuid,
  p_upload_secret text,
  p_original_path text,
  p_processed_path text,
  p_display_order smallint,
  p_credit text,
  p_detected_mime_type text,
  p_byte_size integer,
  p_width integer,
  p_height integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_photo_id uuid;
  expected_prefix text;
begin
  expected_prefix := 'proposals/' || p_proposal_id::text || '/' || p_upload_secret || '/';

  if p_display_order not between 0 and 5
    or p_detected_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or p_byte_size not between 1 and 15728640
    or p_width not between 1000 and 20000
    or p_height not between 600 and 20000
    or p_original_path not like (expected_prefix || 'original-%')
    or p_processed_path not like (expected_prefix || 'processed-%') then
    raise exception 'invalid_photo';
  end if;

  if not exists (
    select 1
    from public.proposals p
    where p.id = p_proposal_id
      and p.state = 'email_pending'
      and p.email_verification_expires_at > now()
      and p.upload_secret_hash = encode(extensions.digest(p_upload_secret, 'sha256'), 'hex')
  ) then
    raise exception 'invalid_capability';
  end if;

  if (select count(*) from public.proposal_photos pp where pp.proposal_id = p_proposal_id) >= 6 then
    raise exception 'too_many_photos';
  end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'spot-originals' and o.name = p_original_path
  ) or not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'spot-originals' and o.name = p_processed_path
  ) then
    raise exception 'missing_object';
  end if;

  insert into public.proposal_photos (
    proposal_id,
    original_object_path,
    processed_object_path,
    display_order,
    credit,
    rights_declared,
    detected_mime_type,
    byte_size,
    width,
    height,
    metadata_stripped_at
  ) values (
    p_proposal_id,
    p_original_path,
    p_processed_path,
    p_display_order,
    nullif(trim(p_credit), ''),
    true,
    p_detected_mime_type,
    p_byte_size,
    p_width,
    p_height,
    now()
  ) returning id into created_photo_id;

  return created_photo_id;
end;
$$;

revoke all on function public.attach_proposal_photo(uuid, text, text, text, smallint, text, text, integer, integer, integer) from public;
grant execute on function public.attach_proposal_photo(uuid, text, text, text, smallint, text, text, integer, integer, integer) to anon, authenticated;

create or replace function public.mark_proposal_confirmation_sent(
  p_proposal_id uuid,
  p_upload_secret text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.proposals p
  set confirmation_sent_at = now()
  where p.id = p_proposal_id
    and p.state = 'email_pending'
    and p.upload_secret_hash = encode(extensions.digest(p_upload_secret, 'sha256'), 'hex');

  return found;
end;
$$;

revoke all on function public.mark_proposal_confirmation_sent(uuid, text) from public;
grant execute on function public.mark_proposal_confirmation_sent(uuid, text) to anon, authenticated;

create or replace function public.refresh_proposal_confirmation(
  p_tracking_id text,
  p_email text,
  p_email_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  refreshed_id uuid;
begin
  if p_email_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_capability';
  end if;

  update public.proposals p
  set email_verification_token_hash = p_email_token_hash,
      email_verification_expires_at = now() + interval '24 hours',
      confirmation_sent_at = now()
  where p.tracking_id = upper(trim(p_tracking_id))
    and lower(p.contributor_email) = lower(trim(p_email))
    and p.state = 'email_pending'
    and (p.confirmation_sent_at is null or p.confirmation_sent_at < now() - interval '2 minutes')
  returning p.id into refreshed_id;

  return refreshed_id;
end;
$$;

revoke all on function public.refresh_proposal_confirmation(text, text, text) from public;
grant execute on function public.refresh_proposal_confirmation(text, text, text) to anon, authenticated;

create or replace function public.confirm_proposal_email(p_token text)
returns table (proposal_id uuid, tracking_id text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if char_length(p_token) < 40 then
    return;
  end if;

  return query
  update public.proposals p
  set state = 'submitted',
      email_verified_at = now(),
      submitted_at = now(),
      email_verification_token_hash = null,
      email_verification_expires_at = null,
      upload_secret_hash = null
  where p.state = 'email_pending'
    and p.email_verification_expires_at > now()
    and p.email_verification_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and (select count(*) from public.proposal_photos pp where pp.proposal_id = p.id) between 2 and 6
  returning p.id, p.tracking_id;
end;
$$;

revoke all on function public.confirm_proposal_email(text) from public;
grant execute on function public.confirm_proposal_email(text) to anon, authenticated;

create or replace function public.admin_review_proposal(
  p_proposal_id uuid,
  p_decision text,
  p_internal_note text,
  p_display_precision text default 'exact',
  p_sensitive boolean default false,
  p_published_paths text[] default '{}',
  p_public_urls text[] default '{}'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_proposal public.proposals%rowtype;
  created_spot_id uuid;
  created_slug text;
  photo_record record;
  photo_index integer := 0;
  photo_count integer;
begin
  if not private.is_staff() then
    raise exception 'forbidden';
  end if;

  if p_decision not in ('approved', 'changes_requested', 'rejected', 'duplicate') then
    raise exception 'invalid_decision';
  end if;

  if char_length(coalesce(p_internal_note, '')) > 2000 then
    raise exception 'invalid_note';
  end if;

  select * into selected_proposal
  from public.proposals p
  where p.id = p_proposal_id
  for update;

  if selected_proposal.id is null or selected_proposal.state <> 'submitted' then
    raise exception 'proposal_already_reviewed';
  end if;

  if p_decision = 'approved' then
    if p_display_precision not in ('exact', 'approximate') then
      raise exception 'invalid_precision';
    end if;

    select count(*) into photo_count
    from public.proposal_photos pp
    where pp.proposal_id = p_proposal_id and pp.processed_object_path is not null;

    if photo_count not between 2 and 6
      or coalesce(array_length(p_published_paths, 1), 0) <> photo_count
      or coalesce(array_length(p_public_urls, 1), 0) <> photo_count then
      raise exception 'invalid_published_photos';
    end if;

    created_slug := trim(both '-' from lower(regexp_replace(
      extensions.unaccent(selected_proposal.payload ->> 'name'),
      '[^a-zA-Z0-9]+', '-', 'g'
    )));
    created_slug := coalesce(nullif(left(created_slug, 80), ''), 'spot')
      || '-' || lower(replace(selected_proposal.tracking_id, 'SPT-', ''));

    insert into public.spots (
      slug,
      name,
      location,
      display_precision,
      municipality,
      postal_code,
      short_description,
      best_times,
      light_orientation,
      access_level,
      parking,
      walking_approach,
      surface_type,
      attendance,
      location_status,
      warnings,
      publication_state,
      last_verified_at,
      last_verified_by
    ) values (
      created_slug,
      selected_proposal.payload ->> 'name',
      extensions.st_setsrid(extensions.st_makepoint(
        (selected_proposal.payload ->> 'longitude')::double precision,
        (selected_proposal.payload ->> 'latitude')::double precision
      ), 4326)::extensions.geography,
      case when p_sensitive then 'approximate'::public.display_precision else p_display_precision::public.display_precision end,
      selected_proposal.payload ->> 'municipality',
      selected_proposal.payload ->> 'postalCode',
      selected_proposal.payload ->> 'shortDescription',
      array(select value::public.best_time from jsonb_array_elements_text(selected_proposal.payload -> 'bestTimes')),
      nullif(selected_proposal.payload ->> 'visualFeatures', ''),
      (selected_proposal.payload ->> 'accessLevel')::public.access_level,
      selected_proposal.payload ->> 'parking',
      selected_proposal.payload ->> 'walkingApproach',
      (selected_proposal.payload ->> 'surfaceType')::public.surface_type,
      (selected_proposal.payload ->> 'attendance')::public.attendance_level,
      case when p_sensitive then 'sensitive'::public.location_status else (selected_proposal.payload ->> 'locationStatus')::public.location_status end,
      regexp_split_to_array(selected_proposal.payload ->> 'risks', E'\\n+'),
      case when p_sensitive then 'sensitive'::public.spot_state else 'published'::public.spot_state end,
      current_date,
      auth.uid()
    ) returning id into created_spot_id;

    insert into public.spot_categories (spot_id, category_id)
    select created_spot_id, c.id
    from public.categories c
    where c.is_active
      and c.slug in (select jsonb_array_elements_text(selected_proposal.payload -> 'categories'));

    for photo_record in
      select * from public.proposal_photos pp
      where pp.proposal_id = p_proposal_id
      order by pp.display_order
    loop
      photo_index := photo_index + 1;
      insert into public.spot_photos (
        spot_id,
        original_object_path,
        published_object_path,
        public_url,
        display_order,
        alt_text,
        credit,
        rights_declared,
        moderation_state,
        metadata_stripped_at
      ) values (
        created_spot_id,
        photo_record.original_object_path,
        p_published_paths[photo_index],
        p_public_urls[photo_index],
        photo_record.display_order,
        'Photo du spot ' || (selected_proposal.payload ->> 'name'),
        photo_record.credit,
        true,
        'approved',
        photo_record.metadata_stripped_at
      );
    end loop;

    update public.proposal_photos
    set moderation_state = 'approved'
    where proposal_id = p_proposal_id;
  end if;

  update public.proposals
  set state = p_decision::public.proposal_state,
      moderation_comment = nullif(trim(p_internal_note), ''),
      decided_at = case when p_decision in ('approved', 'rejected', 'duplicate') then now() else null end
  where id = p_proposal_id;

  insert into public.moderation_actions (
    actor_user_id,
    entity_type,
    entity_id,
    action,
    previous_state,
    next_state,
    details
  ) values (
    auth.uid(),
    'proposal',
    p_proposal_id::text,
    'reviewed',
    'submitted',
    p_decision,
    jsonb_build_object('note', nullif(trim(p_internal_note), ''), 'spot_id', created_spot_id)
  );

  return created_spot_id;
end;
$$;

revoke all on function public.admin_review_proposal(uuid, text, text, text, boolean, text[], text[]) from public;
grant execute on function public.admin_review_proposal(uuid, text, text, text, boolean, text[], text[]) to authenticated;
