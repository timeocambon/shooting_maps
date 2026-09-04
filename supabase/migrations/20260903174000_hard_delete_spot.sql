create or replace function public.admin_delete_spot(
  p_spot_id uuid,
  p_confirmation text
)
returns table (
  deleted_slug text,
  original_paths text[],
  published_paths text[]
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_spot public.spots%rowtype;
begin
  if not private.is_administrator() then raise exception 'Forbidden'; end if;

  select * into selected_spot
  from public.spots
  where id = p_spot_id
  for update;

  if selected_spot.id is null then raise exception 'spot_not_found'; end if;
  if trim(coalesce(p_confirmation, '')) <> selected_spot.name then
    raise exception 'invalid_confirmation';
  end if;

  select
    coalesce(array_agg(original_object_path) filter (where original_object_path is not null), '{}'::text[]),
    coalesce(array_agg(published_object_path) filter (where published_object_path is not null), '{}'::text[])
  into original_paths, published_paths
  from public.spot_photos
  where spot_id = selected_spot.id;

  deleted_slug := selected_spot.slug;

  insert into public.moderation_actions (
    actor_user_id,
    entity_type,
    entity_id,
    action,
    previous_state,
    details
  ) values (
    auth.uid(),
    'spot',
    selected_spot.id::text,
    'permanently_deleted',
    selected_spot.publication_state::text,
    jsonb_build_object('name', selected_spot.name, 'slug', selected_spot.slug)
  );

  delete from public.spots where id = selected_spot.id;
  return next;
end;
$$;

revoke all on function public.admin_delete_spot(uuid, text) from public;
grant execute on function public.admin_delete_spot(uuid, text) to authenticated;
