-- Correctif : private.audit_state_change() codait en dur le nom de la colonne
-- d'état (« state », sauf pour la table spots). La table photographers utilise
-- publication_state et tombait donc dans la branche par défaut, qui échouait
-- avec « record "old" has no field "state" » — la validation d'un profil
-- photographe était impossible.
--
-- La colonne d'état est désormais détectée automatiquement, pour que toute
-- nouvelle table puisse réutiliser ce déclencheur sans le modifier.
-- Comportement inchangé pour spots, proposals, reports et withdrawal_requests.

create or replace function private.audit_state_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb := to_jsonb(old);
  new_row jsonb := to_jsonb(new);
  state_column text;
  old_state text;
  new_state text;
begin
  state_column := case
    when new_row ? 'publication_state' then 'publication_state'
    when new_row ? 'state' then 'state'
    when new_row ? 'moderation_state' then 'moderation_state'
    else null
  end;

  if state_column is null then
    return new;
  end if;

  old_state := old_row ->> state_column;
  new_state := new_row ->> state_column;

  if old_state is distinct from new_state then
    insert into public.moderation_actions (
      actor_user_id, entity_type, entity_id, action, previous_state, next_state
    ) values (
      auth.uid(),
      rtrim(tg_table_name, 's'),
      new_row ->> 'id',
      'state_changed',
      old_state,
      new_state
    );
  end if;

  return new;
end;
$$;
