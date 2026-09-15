-- Correctif : Supabase interdit désormais la suppression directe dans
-- storage.objects (erreur 42501 « Direct deletion from storage tables is not
-- allowed. Use the Storage API instead. »). La purge de rétention échouait
-- donc à chaque ouverture du tableau de bord, et empêchait son affichage.
--
-- La fonction ne touche plus au stockage : elle renvoie les identifiants des
-- propositions purgées, et l'application supprime les fichiers correspondants
-- via l'API Storage, avec la session du modérateur.

create or replace function public.admin_purge_expired_proposals()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  unconfirmed_days integer;
  closed_days integer;
  purged_unconfirmed integer := 0;
  purged_closed integer := 0;
  expired_ids uuid[];
begin
  if not private.is_staff() then raise exception 'Forbidden'; end if;

  select coalesce((value #>> '{}')::integer, 30) into unconfirmed_days
  from public.app_settings where key = 'proposal_unconfirmed_retention_days';
  unconfirmed_days := coalesce(unconfirmed_days, 30);

  select coalesce((value #>> '{}')::integer, 90) into closed_days
  from public.app_settings where key = 'proposal_closed_retention_days';
  closed_days := coalesce(closed_days, 90);

  -- Relevé des identifiants avant suppression : ils servent à nettoyer le
  -- stockage côté application.
  select coalesce(array_agg(id), '{}'::uuid[]) into expired_ids
  from public.proposals
  where (state in ('draft', 'email_pending') and created_at < now() - make_interval(days => unconfirmed_days))
     or (state in ('rejected', 'duplicate', 'withdrawn', 'changes_requested')
         and coalesce(decided_at, updated_at) < now() - make_interval(days => closed_days));

  with removed as (
    delete from public.proposals
    where state in ('draft', 'email_pending')
      and created_at < now() - make_interval(days => unconfirmed_days)
    returning id
  )
  select count(*) into purged_unconfirmed from removed;

  with removed as (
    delete from public.proposals
    where state in ('rejected', 'duplicate', 'withdrawn', 'changes_requested')
      and coalesce(decided_at, updated_at) < now() - make_interval(days => closed_days)
    returning id
  )
  select count(*) into purged_closed from removed;

  if purged_unconfirmed > 0 or purged_closed > 0 then
    insert into public.moderation_actions (actor_user_id, entity_type, entity_id, action, details)
    values (
      auth.uid(),
      'setting',
      'retention_purge',
      'automatic_purge',
      jsonb_build_object('unconfirmed', purged_unconfirmed, 'closed', purged_closed)
    );
  end if;

  return jsonb_build_object(
    'unconfirmed', purged_unconfirmed,
    'closed', purged_closed,
    'expired_proposal_ids', to_jsonb(expired_ids)
  );
end;
$$;

revoke all on function public.admin_purge_expired_proposals() from public;
grant execute on function public.admin_purge_expired_proposals() to authenticated;
