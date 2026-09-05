-- Étape 4 — conformité : masquage rapide d'une photo déjà publiée, demandes
-- de retrait (photo ou donnée), et rétention/suppression automatique des
-- propositions non confirmées ou refusées.

-- Le journal accepte désormais aussi les demandes de retrait comme entité.
alter table public.moderation_actions
  drop constraint moderation_actions_entity_type_check;
alter table public.moderation_actions
  add constraint moderation_actions_entity_type_check
  check (entity_type in ('spot', 'proposal', 'report', 'photo', 'setting', 'admin_user', 'withdrawal_request'));

-- Masquage rapide d'une photo déjà publiée, sans masquer toute la fiche.
create or replace function public.admin_set_spot_photo_state(
  p_photo_id uuid,
  p_moderation_state text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_photo public.spot_photos%rowtype;
begin
  if not private.is_staff() then raise exception 'Forbidden'; end if;

  if p_moderation_state not in ('approved', 'hidden') then
    raise exception 'invalid_state';
  end if;

  select * into selected_photo
  from public.spot_photos sp
  where sp.id = p_photo_id
  for update;

  if selected_photo.id is null then raise exception 'photo_not_found'; end if;

  update public.spot_photos
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
    jsonb_build_object('spot_id', selected_photo.spot_id)
  );

  return selected_photo.spot_id;
end;
$$;

revoke all on function public.admin_set_spot_photo_state(uuid, text) from public;
grant execute on function public.admin_set_spot_photo_state(uuid, text) to authenticated;

-- Demandes de retrait : concernent une photo ou une donnée, avec ou sans
-- fiche déjà publiée (ex. contenu encore en cours d'examen, ou aucune fiche
-- du tout pour une demande de suppression de données générale).
create table public.withdrawal_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  kind text not null check (kind in ('photo', 'data')),
  spot_id uuid references public.spots (id) on delete set null,
  proposal_tracking_id text,
  description text not null check (char_length(description) between 10 and 2000),
  requester_email text not null check (char_length(requester_email) between 3 and 320),
  state public.report_state not null default 'open',
  decision text,
  internal_note text,
  handled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  updated_at timestamptz not null default now()
);

create index withdrawal_requests_queue_idx on public.withdrawal_requests (state, created_at);

alter table public.withdrawal_requests enable row level security;
create policy "staff manage withdrawal requests" on public.withdrawal_requests for all to authenticated using (private.is_staff()) with check (private.is_staff());
revoke all on public.withdrawal_requests from anon, authenticated;
grant select, insert, update, delete on public.withdrawal_requests to authenticated;

create trigger withdrawal_requests_set_updated_at before update on public.withdrawal_requests for each row execute function private.set_updated_at();
-- Réutilise le même automate d'état et la même journalisation générique que
-- les signalements (report_state est le type de la colonne state).
create trigger withdrawal_requests_validate_transition before update of state on public.withdrawal_requests for each row execute function private.validate_report_transition();
create trigger withdrawal_requests_audit_state after update of state on public.withdrawal_requests for each row execute function private.audit_state_change();

create or replace function public.create_withdrawal_request(
  p_kind text,
  p_spot_slug text,
  p_tracking_id text,
  p_description text,
  p_email text,
  p_website text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text;
  resolved_spot_id uuid;
  created_request_id uuid;
begin
  -- Un honeypot rempli est accepté sans être persisté, pour ne pas donner
  -- d'indice utile à un envoi automatisé.
  if nullif(trim(coalesce(p_website, '')), '') is not null then
    return extensions.gen_random_uuid();
  end if;

  if p_kind not in ('photo', 'data') then
    raise exception 'invalid_kind';
  end if;

  if char_length(trim(coalesce(p_description, ''))) not between 10 and 2000 then
    raise exception 'invalid_description';
  end if;

  normalized_email := lower(trim(coalesce(p_email, '')));
  if normalized_email = '' or char_length(normalized_email) > 320
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_email';
  end if;

  if nullif(trim(coalesce(p_spot_slug, '')), '') is not null then
    select id into resolved_spot_id from public.spots where slug = trim(p_spot_slug);
    if resolved_spot_id is null then raise exception 'spot_unknown'; end if;
  end if;

  if (
    select count(*)
    from public.withdrawal_requests w
    where lower(w.requester_email) = normalized_email
      and w.created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception 'rate_limit';
  end if;

  insert into public.withdrawal_requests (kind, spot_id, proposal_tracking_id, description, requester_email)
  values (
    p_kind,
    resolved_spot_id,
    nullif(trim(coalesce(p_tracking_id, '')), ''),
    trim(p_description),
    normalized_email
  )
  returning id into created_request_id;

  return created_request_id;
end;
$$;

revoke all on function public.create_withdrawal_request(text, text, text, text, text, text) from public;
grant execute on function public.create_withdrawal_request(text, text, text, text, text, text) to anon, authenticated;

create or replace function public.admin_review_withdrawal_request(
  p_request_id uuid,
  p_next_state text,
  p_decision text,
  p_internal_note text,
  p_hide_spot boolean default false,
  p_hide_photo_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_request public.withdrawal_requests%rowtype;
begin
  if not private.is_staff() then raise exception 'Forbidden'; end if;

  select * into selected_request
  from public.withdrawal_requests w
  where w.id = p_request_id
  for update;

  if selected_request.id is null then raise exception 'request_not_found'; end if;
  if selected_request.state in ('resolved', 'dismissed') then raise exception 'request_already_reviewed'; end if;
  if p_next_state not in ('in_review', 'resolved', 'dismissed') then raise exception 'invalid_decision'; end if;
  if char_length(trim(coalesce(p_internal_note, ''))) > 2000 then raise exception 'invalid_note'; end if;
  if p_next_state in ('resolved', 'dismissed')
    and char_length(trim(coalesce(p_decision, ''))) not between 3 and 1000 then
    raise exception 'decision_required';
  end if;

  if p_hide_photo_id is not null then
    if not exists (
      select 1 from public.spot_photos sp
      where sp.id = p_hide_photo_id and sp.spot_id = selected_request.spot_id
    ) then
      raise exception 'photo_not_found';
    end if;
    perform public.admin_set_spot_photo_state(p_hide_photo_id, 'hidden');
  end if;

  if p_hide_spot and selected_request.spot_id is not null then
    update public.spots
    set publication_state = 'hidden'
    where id = selected_request.spot_id
      and publication_state in ('published', 'sensitive', 'review_due');
  end if;

  update public.withdrawal_requests
  set state = p_next_state::public.report_state,
      decision = case when p_next_state in ('resolved', 'dismissed') then trim(p_decision) else decision end,
      internal_note = nullif(trim(coalesce(p_internal_note, '')), ''),
      handled_by = auth.uid(),
      handled_at = case when p_next_state in ('resolved', 'dismissed') then now() else null end
  where id = selected_request.id;

  insert into public.moderation_actions (
    actor_user_id, entity_type, entity_id, action, previous_state, next_state, details
  ) values (
    auth.uid(),
    'withdrawal_request',
    selected_request.id::text,
    'review_updated',
    selected_request.state::text,
    p_next_state,
    jsonb_build_object('spot_id', selected_request.spot_id, 'spot_hidden', p_hide_spot, 'photo_hidden', p_hide_photo_id)
  );

  return selected_request.id;
end;
$$;

revoke all on function public.admin_review_withdrawal_request(uuid, text, text, text, boolean, uuid) from public;
grant execute on function public.admin_review_withdrawal_request(uuid, text, text, text, boolean, uuid) to authenticated;

-- Rétention et suppression automatique des propositions non confirmées ou
-- refusées (durées réglables via app_settings). Suit le même principe que
-- admin_refresh_review_due_spots : déclenché à l'ouverture du tableau de
-- bord admin ; une exécution planifiée indépendante de toute visite sera
-- ajoutée avec l'environnement de production (étape 5).
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
begin
  if not private.is_staff() then raise exception 'Forbidden'; end if;

  select coalesce((value #>> '{}')::integer, 30) into unconfirmed_days
  from public.app_settings where key = 'proposal_unconfirmed_retention_days';
  unconfirmed_days := coalesce(unconfirmed_days, 30);

  select coalesce((value #>> '{}')::integer, 90) into closed_days
  from public.app_settings where key = 'proposal_closed_retention_days';
  closed_days := coalesce(closed_days, 90);

  -- Retire d'abord les fichiers d'origine encore présents dans le stockage :
  -- le cascade sur proposal_photos ne supprime pas les objets réels dans
  -- storage.objects.
  delete from storage.objects
  where bucket_id = 'spot-originals'
    and (storage.foldername(name))[1] = 'proposals'
    and (storage.foldername(name))[2] in (
      select id::text from public.proposals
      where (state in ('draft', 'email_pending') and created_at < now() - make_interval(days => unconfirmed_days))
         or (state in ('rejected', 'duplicate', 'withdrawn', 'changes_requested')
             and coalesce(decided_at, updated_at) < now() - make_interval(days => closed_days))
    );

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

  return jsonb_build_object('unconfirmed', purged_unconfirmed, 'closed', purged_closed);
end;
$$;

revoke all on function public.admin_purge_expired_proposals() from public;
grant execute on function public.admin_purge_expired_proposals() to authenticated;

insert into public.app_settings (key, value, description)
values
  ('proposal_unconfirmed_retention_days', '30'::jsonb, 'Durée de conservation (jours) des propositions non confirmées (brouillon ou e-mail non vérifié) avant suppression automatique'),
  ('proposal_closed_retention_days', '90'::jsonb, 'Durée de conservation (jours) des propositions refusées, doublons, retirées ou en attente de précisions sans réponse, avant suppression automatique')
on conflict (key) do nothing;
