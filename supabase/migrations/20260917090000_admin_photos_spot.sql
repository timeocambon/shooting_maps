-- Gestion des photos d'une fiche depuis l'administration : ajout, suppression
-- et réordonnancement, sans passer par le circuit de proposition.

-- Une photo ajoutée directement par l'administration n'a pas d'« original »
-- séparé : le fichier envoyé est déjà la version publiée.
alter table public.spot_photos alter column original_object_path drop not null;

-- Réordonner deux photos impose de leur échanger leur rang. Avec une
-- contrainte vérifiée à chaque ligne, l'échange casse au premier update ;
-- reportée en fin de transaction, la séquence complète est valide.
alter table public.spot_photos
  drop constraint spot_photos_spot_id_display_order_key;
alter table public.spot_photos
  add constraint spot_photos_spot_id_display_order_key
  unique (spot_id, display_order) deferrable initially deferred;

create or replace function public.admin_list_spot_photos(p_spot_id uuid)
returns table (
  id uuid,
  public_url text,
  published_object_path text,
  display_order smallint,
  moderation_state text,
  alt_text text,
  credit text
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.is_staff() then raise exception 'Forbidden'; end if;

  return query
    select sp.id,
           sp.public_url,
           sp.published_object_path,
           sp.display_order,
           sp.moderation_state::text,
           sp.alt_text,
           sp.credit
    from public.spot_photos sp
    where sp.spot_id = p_spot_id
      and sp.removed_at is null
    order by sp.display_order;
end;
$$;

revoke all on function public.admin_list_spot_photos(uuid) from public;
grant execute on function public.admin_list_spot_photos(uuid) to authenticated;

create or replace function public.admin_add_spot_photo(
  p_spot_id uuid,
  p_object_path text,
  p_public_url text,
  p_alt_text text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  spot_name text;
  next_order smallint;
  new_photo_id uuid;
begin
  if not private.is_staff() then raise exception 'Forbidden'; end if;

  select s.name into spot_name from public.spots s where s.id = p_spot_id;
  if spot_name is null then raise exception 'spot_not_found'; end if;

  -- Le premier rang libre, et non « le dernier + 1 » : après une suppression,
  -- les rangs sont troués et le maximum ne dit plus combien il reste de place.
  -- Les lignes retirées comptent : la contrainte d'unicité les voit encore.
  select min(candidate)::smallint into next_order
  from generate_series(0, 5) as candidate
  where not exists (
    select 1 from public.spot_photos sp
    where sp.spot_id = p_spot_id and sp.display_order = candidate
  );

  if next_order is null then raise exception 'photo_limit'; end if;

  insert into public.spot_photos (
    spot_id,
    original_object_path,
    published_object_path,
    public_url,
    display_order,
    alt_text,
    rights_declared,
    moderation_state,
    metadata_stripped_at
  ) values (
    p_spot_id,
    null,
    p_object_path,
    p_public_url,
    next_order,
    coalesce(nullif(trim(coalesce(p_alt_text, '')), ''), 'Photo du spot ' || spot_name),
    true,
    'approved',
    now()
  )
  returning id into new_photo_id;

  insert into public.moderation_actions (
    actor_user_id, entity_type, entity_id, action, next_state, details
  ) values (
    auth.uid(), 'photo', new_photo_id::text, 'photo_added_by_staff', 'approved',
    jsonb_build_object('spot_id', p_spot_id, 'object_path', p_object_path)
  );

  return new_photo_id;
end;
$$;

revoke all on function public.admin_add_spot_photo(uuid, text, text, text) from public;
grant execute on function public.admin_add_spot_photo(uuid, text, text, text) to authenticated;

-- La suppression des fichiers eux-mêmes revient à l'application : Supabase
-- interdit désormais le delete direct sur storage.objects depuis SQL.
create or replace function public.admin_delete_spot_photo(p_photo_id uuid)
returns table (original_path text, published_path text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_photo public.spot_photos%rowtype;
begin
  if not private.is_staff() then raise exception 'Forbidden'; end if;

  select * into selected_photo
  from public.spot_photos sp
  where sp.id = p_photo_id
  for update;

  if selected_photo.id is null then raise exception 'photo_not_found'; end if;

  original_path := selected_photo.original_object_path;
  published_path := selected_photo.published_object_path;

  insert into public.moderation_actions (
    actor_user_id, entity_type, entity_id, action, previous_state, details
  ) values (
    auth.uid(), 'photo', p_photo_id::text, 'photo_deleted_by_staff',
    selected_photo.moderation_state::text,
    jsonb_build_object('spot_id', selected_photo.spot_id, 'display_order', selected_photo.display_order)
  );

  delete from public.spot_photos where id = p_photo_id;
  return next;
end;
$$;

revoke all on function public.admin_delete_spot_photo(uuid) from public;
grant execute on function public.admin_delete_spot_photo(uuid) to authenticated;

-- L'ordre décide de la photo de couverture : la première sert de vignette sur
-- la carte et dans les listes.
create or replace function public.admin_reorder_spot_photos(
  p_spot_id uuid,
  p_photo_ids uuid[]
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expected_count integer;
  moved_count integer := 0;
begin
  if not private.is_staff() then raise exception 'Forbidden'; end if;

  select count(*) into expected_count
  from public.spot_photos sp
  where sp.spot_id = p_spot_id and sp.removed_at is null;

  -- La liste doit décrire exactement les photos de la fiche : un identifiant
  -- manquant laisserait une photo sur un rang devenu ambigu.
  if coalesce(array_length(p_photo_ids, 1), 0) <> expected_count then
    raise exception 'incomplete_order';
  end if;

  update public.spot_photos sp
  set display_order = (position.index - 1)::smallint
  from unnest(p_photo_ids) with ordinality as position(photo_id, index)
  where sp.id = position.photo_id and sp.spot_id = p_spot_id;

  get diagnostics moved_count = row_count;
  if moved_count <> expected_count then raise exception 'incomplete_order'; end if;

  insert into public.moderation_actions (
    actor_user_id, entity_type, entity_id, action, details
  ) values (
    auth.uid(), 'spot', p_spot_id::text, 'photos_reordered',
    jsonb_build_object('order', to_jsonb(p_photo_ids))
  );

  return moved_count;
end;
$$;

revoke all on function public.admin_reorder_spot_photos(uuid, uuid[]) from public;
grant execute on function public.admin_reorder_spot_photos(uuid, uuid[]) to authenticated;
