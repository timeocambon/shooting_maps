alter table public.spots
  add column address text
  check (address is null or char_length(address) between 5 and 240);

create or replace function public.admin_set_spot_address(
  p_spot_id uuid,
  p_address text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_address text := nullif(trim(coalesce(p_address, '')), '');
begin
  if not private.is_staff() then raise exception 'Forbidden'; end if;
  if normalized_address is not null and char_length(normalized_address) not between 5 and 240 then
    raise exception 'invalid_address';
  end if;

  update public.spots
  set address = normalized_address
  where id = p_spot_id
    and address is distinct from normalized_address;

  if found then
    insert into public.moderation_actions (actor_user_id, entity_type, entity_id, action, details)
    values (
      auth.uid(),
      'spot',
      p_spot_id::text,
      'address_updated',
      jsonb_build_object('address_present', normalized_address is not null)
    );
  end if;

  return exists (select 1 from public.spots where id = p_spot_id);
end;
$$;

revoke all on function public.admin_set_spot_address(uuid, text) from public;
grant execute on function public.admin_set_spot_address(uuid, text) to authenticated;
