-- Masquer ou réafficher une photo de fiche depuis l'administration.
--
-- Le gestionnaire de photos (bouton œil) appelait déjà
-- public.admin_set_spot_photo_state, mais aucune migration ne la définissait :
-- le bouton échouait à l'exécution. Fonction ajoutée ici, sur le même modèle
-- que les autres RPC d'administration des photos.

create or replace function public.admin_set_spot_photo_state(
  p_photo_id uuid,
  p_moderation_state text
)
returns public.photo_moderation_state
language plpgsql
security invoker
set search_path = ''
as $$
declare
  previous_state public.photo_moderation_state;
  next_state public.photo_moderation_state;
begin
  if not private.is_staff() then raise exception 'Forbidden'; end if;

  -- Seuls ces deux états sont pilotés depuis cet écran. 'pending' et
  -- 'rejected' appartiennent au circuit de modération des propositions : les
  -- accepter ici permettrait de replacer une photo publiée dans une file
  -- d'attente dont cet écran ne sait pas la sortir.
  if p_moderation_state not in ('approved', 'hidden') then
    raise exception 'invalid_state';
  end if;
  next_state := p_moderation_state::public.photo_moderation_state;

  select sp.moderation_state into previous_state
  from public.spot_photos sp
  where sp.id = p_photo_id
  for update;

  if previous_state is null then raise exception 'photo_not_found'; end if;

  update public.spot_photos
  set moderation_state = next_state
  where id = p_photo_id;

  insert into public.moderation_actions (
    actor_user_id, entity_type, entity_id, action, previous_state, next_state
  ) values (
    auth.uid(), 'photo', p_photo_id::text, 'photo_state_changed_by_staff',
    previous_state::text, next_state::text
  );

  return next_state;
end;
$$;

revoke all on function public.admin_set_spot_photo_state(uuid, text) from public;
grant execute on function public.admin_set_spot_photo_state(uuid, text) to authenticated;
