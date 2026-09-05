-- Étape 3 (modération P0) : permettre de corriger une proposition avant
-- publication et d'exclure une photo individuellement, sans intervention
-- technique. Corrige aussi un défaut de admin_review_proposal qui publiait
-- et « approuvait » silencieusement des photos qui avaient été rejetées
-- pendant la revue.

create or replace function public.admin_correct_proposal(
  p_proposal_id uuid,
  p_name text,
  p_address text,
  p_latitude double precision,
  p_longitude double precision,
  p_municipality text,
  p_postal_code text,
  p_payload_display_precision text,
  p_categories text[],
  p_short_description text,
  p_best_times text[],
  p_visual_features text,
  p_access_level text,
  p_parking text,
  p_walking_approach text,
  p_surface_type text,
  p_traffic text,
  p_attendance text,
  p_risks text,
  p_location_status text,
  p_internal_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_proposal public.proposals%rowtype;
  corrected_payload jsonb;
begin
  if not private.is_staff() then
    raise exception 'forbidden';
  end if;

  select * into selected_proposal
  from public.proposals p
  where p.id = p_proposal_id
  for update;

  if selected_proposal.id is null or selected_proposal.state <> 'submitted' then
    raise exception 'proposal_not_correctable';
  end if;

  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'invalid_coordinates';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 3 and 120
    or char_length(trim(coalesce(p_address, ''))) not between 5 and 180
    or char_length(trim(coalesce(p_municipality, ''))) not between 2 and 120
    or coalesce(p_postal_code, '') !~ '^[0-9]{5}$'
    or char_length(trim(coalesce(p_short_description, ''))) not between 20 and 500
    or char_length(coalesce(p_visual_features, '')) > 500
    or char_length(trim(coalesce(p_parking, ''))) not between 3 and 500
    or char_length(trim(coalesce(p_walking_approach, ''))) not between 3 and 500
    or char_length(trim(coalesce(p_traffic, ''))) not between 3 and 500
    or char_length(trim(coalesce(p_risks, ''))) not between 10 and 2000 then
    raise exception 'invalid_content';
  end if;
  if p_payload_display_precision not in ('exact', 'approximate') then raise exception 'invalid_precision'; end if;
  if p_access_level not in ('easy', 'intermediate', 'difficult') then raise exception 'invalid_access_level'; end if;
  if p_surface_type not in ('asphalt', 'gravel', 'earth', 'mixed') then raise exception 'invalid_surface_type'; end if;
  if p_attendance not in ('quiet', 'variable', 'busy') then raise exception 'invalid_attendance'; end if;
  if p_location_status not in ('public', 'private_with_permission', 'to_confirm', 'sensitive') then raise exception 'invalid_location_status'; end if;
  if cardinality(p_categories) not between 1 and 3
    or exists (
      select 1 from unnest(p_categories) value
      where value not in ('urban', 'industrial', 'architecture', 'nature', 'panorama', 'graffiti')
    ) then
    raise exception 'invalid_categories';
  end if;
  if cardinality(p_best_times) not between 1 and 3
    or exists (
      select 1 from unnest(p_best_times) value
      where value not in ('morning', 'day', 'golden_hour', 'sunset', 'night')
    ) then
    raise exception 'invalid_best_times';
  end if;
  if char_length(coalesce(p_internal_note, '')) > 2000 then
    raise exception 'invalid_note';
  end if;

  -- L'engagement d'accès sans intrusion a été donné par le contributeur à la
  -- soumission ; une correction administrative ne le remet pas en cause.
  corrected_payload := jsonb_build_object(
    'address', trim(p_address),
    'latitude', p_latitude,
    'longitude', p_longitude,
    'municipality', trim(p_municipality),
    'postalCode', p_postal_code,
    'displayPrecision', p_payload_display_precision,
    'accessWithoutTrespass', true,
    'name', trim(p_name),
    'categories', to_jsonb(p_categories),
    'shortDescription', trim(p_short_description),
    'bestTimes', to_jsonb(p_best_times),
    'visualFeatures', trim(coalesce(p_visual_features, '')),
    'accessLevel', p_access_level,
    'parking', trim(p_parking),
    'walkingApproach', trim(p_walking_approach),
    'surfaceType', p_surface_type,
    'traffic', trim(p_traffic),
    'attendance', p_attendance,
    'risks', trim(p_risks),
    'locationStatus', p_location_status
  );

  update public.proposals
  set payload = corrected_payload
  where id = p_proposal_id;

  insert into public.moderation_actions (
    actor_user_id, entity_type, entity_id, action, previous_state, next_state, details
  ) values (
    auth.uid(),
    'proposal',
    p_proposal_id::text,
    'corrected',
    'submitted',
    'submitted',
    jsonb_build_object('note', nullif(trim(coalesce(p_internal_note, '')), ''))
  );

  return p_proposal_id;
end;
$$;

revoke all on function public.admin_correct_proposal(
  uuid, text, text, double precision, double precision, text, text, text, text[], text,
  text[], text, text, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.admin_correct_proposal(
  uuid, text, text, double precision, double precision, text, text, text, text[], text,
  text[], text, text, text, text, text, text, text, text, text, text
) to authenticated;

create or replace function public.admin_set_proposal_photo_state(
  p_photo_id uuid,
  p_moderation_state text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_photo public.proposal_photos%rowtype;
  parent_state public.proposal_state;
begin
  if not private.is_staff() then
    raise exception 'forbidden';
  end if;

  if p_moderation_state not in ('pending', 'approved', 'rejected') then
    raise exception 'invalid_state';
  end if;

  select * into selected_photo
  from public.proposal_photos pp
  where pp.id = p_photo_id
  for update;

  if selected_photo.id is null then
    raise exception 'photo_not_found';
  end if;

  select p.state into parent_state
  from public.proposals p
  where p.id = selected_photo.proposal_id;

  if parent_state is null or parent_state <> 'submitted' then
    raise exception 'proposal_not_correctable';
  end if;

  update public.proposal_photos
  set moderation_state = p_moderation_state::public.photo_moderation_state
  where id = p_photo_id;

  insert into public.moderation_actions (
    actor_user_id, entity_type, entity_id, action, previous_state, next_state, details
  ) values (
    auth.uid(),
    'photo',
    p_photo_id::text,
    'photo_state_decision',
    selected_photo.moderation_state::text,
    p_moderation_state,
    jsonb_build_object('proposal_id', selected_photo.proposal_id)
  );

  return selected_photo.proposal_id;
end;
$$;

revoke all on function public.admin_set_proposal_photo_state(uuid, text) from public;
grant execute on function public.admin_set_proposal_photo_state(uuid, text) to authenticated;

-- Redéfinition : exclure les photos rejetées pendant la revue de la
-- publication, et ne plus écraser leur état à 'approved' à la décision.
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
    where pp.proposal_id = p_proposal_id
      and pp.processed_object_path is not null
      and pp.moderation_state <> 'rejected';

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
        and pp.processed_object_path is not null
        and pp.moderation_state <> 'rejected'
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
    where proposal_id = p_proposal_id
      and moderation_state <> 'rejected';
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
