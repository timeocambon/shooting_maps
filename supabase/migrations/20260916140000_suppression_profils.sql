-- Étape 7 — suppressions définitives : une fiche photographe (par la
-- modération ou par son propriétaire) et un avis (par la modération).
--
-- Les suppressions passent par des fonctions dédiées plutôt que par un droit
-- DELETE direct : chacune vérifie qui appelle, journalise l'action avant
-- d'effacer, et renvoie les chemins des fichiers à retirer du stockage
-- (storage.objects n'accepte plus de suppression directe en SQL).

create or replace function public.admin_delete_photographer(p_photographer_id uuid)
returns text[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.photographers%rowtype;
  object_paths text[];
begin
  if not private.is_staff() then raise exception 'Forbidden'; end if;

  select * into target from public.photographers where id = p_photographer_id for update;
  if target.id is null then raise exception 'photographer_not_found'; end if;

  select coalesce(array_agg(object_path), '{}'::text[]) into object_paths
  from public.photographer_photos where photographer_id = target.id;

  -- Journalisé avant la suppression : la ligne n'existera plus après.
  insert into public.moderation_actions (
    actor_user_id, entity_type, entity_id, action, previous_state, details
  ) values (
    auth.uid(),
    'photographer',
    target.id::text,
    'deleted',
    target.publication_state::text,
    jsonb_build_object('name', target.name, 'slug', target.slug, 'email', target.contact_email)
  );

  -- Les photos et les avis disparaissent par cascade.
  delete from public.photographers where id = target.id;

  return object_paths;
end;
$$;

revoke all on function public.admin_delete_photographer(uuid) from public;
grant execute on function public.admin_delete_photographer(uuid) to authenticated;

create or replace function public.delete_my_photographer_profile()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.photographers%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select * into target from public.photographers
  where owner_user_id = auth.uid()
  order by created_at
  limit 1;

  if target.id is null then raise exception 'not_owner'; end if;

  insert into public.moderation_actions (
    actor_user_id, entity_type, entity_id, action, previous_state, details
  ) values (
    auth.uid(),
    'photographer',
    target.id::text,
    'owner_deleted',
    target.publication_state::text,
    jsonb_build_object('name', target.name, 'slug', target.slug)
  );

  delete from public.photographers where id = target.id;

  return target.id;
end;
$$;

revoke all on function public.delete_my_photographer_profile() from public;
grant execute on function public.delete_my_photographer_profile() to authenticated;

create or replace function public.admin_delete_photographer_review(p_review_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.photographer_reviews%rowtype;
begin
  if not private.is_staff() then raise exception 'Forbidden'; end if;

  select * into target from public.photographer_reviews where id = p_review_id for update;
  if target.id is null then raise exception 'review_not_found'; end if;

  insert into public.moderation_actions (
    actor_user_id, entity_type, entity_id, action, previous_state, details
  ) values (
    auth.uid(),
    'photographer_review',
    target.id::text,
    'deleted',
    target.moderation_state::text,
    jsonb_build_object('photographer_id', target.photographer_id, 'rating', target.rating)
  );

  delete from public.photographer_reviews where id = target.id;

  return target.photographer_id;
end;
$$;

revoke all on function public.admin_delete_photographer_review(uuid) from public;
grant execute on function public.admin_delete_photographer_review(uuid) to authenticated;
