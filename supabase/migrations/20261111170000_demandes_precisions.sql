-- Parcours « Demande de précisions » entre la modération et le contributeur.
--
-- 1. public.proposal_change_requests : historique des demandes publiques et
--    des réponses. moderation_comment reste strictement interne et n'est
--    jamais copié ici.
-- 2. Une seule demande ouverte par proposition (index unique partiel).
-- 3. Passage à « changes_requested » impossible sans demande ouverte
--    (déclencheur) : le message public est donc obligatoire, y compris si
--    admin_review_proposal est appelée directement avec cette décision.
-- 4. public.admin_request_proposal_changes : décision du modérateur (staff).
-- 5. public.lookup_proposal_statuses : redéfinie pour renvoyer aussi la
--    demande publique ouverte (message et date), uniquement après
--    vérification du couple numéro + e-mail. Rôle service uniquement.
-- 6. public.reply_to_proposal_request : réponse du contributeur, idempotente,
--    limitée en fréquence, résultat neutre (« not_found »). Rôle service
--    uniquement. Ferme la demande et repasse la proposition de
--    changes_requested à submitted. Résultats : received, already_received,
--    not_found ; exceptions : invalid_request, invalid_response, rate_limit.
--
-- Migration additive : aucune migration existante n'est modifiée.

-- ---------------------------------------------------------------------------
-- 1. Historique des échanges publics
-- ---------------------------------------------------------------------------

create table public.proposal_change_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  public_message text not null
    check (char_length(public_message) between 1 and 2000 and public_message = btrim(public_message)),
  requested_by uuid references auth.users (id) on delete set null,
  requested_at timestamptz not null default now(),
  response text
    check (response is null or (char_length(response) between 1 and 2000 and response = btrim(response))),
  response_key_hash text
    check (response_key_hash is null or response_key_hash ~ '^[0-9a-f]{64}$'),
  responded_at timestamptz,
  closed_at timestamptz,
  constraint proposal_change_requests_response_complete check (
    (response is null) = (responded_at is null)
    and (response is null) = (response_key_hash is null)
  ),
  constraint proposal_change_requests_response_closes check (
    responded_at is null or closed_at is not null
  )
);

create unique index proposal_change_requests_one_open_idx
  on public.proposal_change_requests (proposal_id)
  where closed_at is null;
create index proposal_change_requests_history_idx
  on public.proposal_change_requests (proposal_id, requested_at desc);

alter table public.proposal_change_requests enable row level security;
revoke all on public.proposal_change_requests from public, anon, authenticated;
-- Lecture réservée à l'équipe (fiche de modération) ; écriture par fonctions uniquement.
grant select on public.proposal_change_requests to authenticated;
create policy "staff read change requests"
  on public.proposal_change_requests
  for select to authenticated
  using (private.is_staff());

-- Journal de limitation des réponses (empreintes et dates uniquement).
create table private.proposal_reply_requests (
  id bigint generated always as identity primary key,
  client_key text not null check (client_key ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index proposal_reply_requests_client_idx
  on private.proposal_reply_requests (client_key, created_at desc);
create index proposal_reply_requests_created_idx
  on private.proposal_reply_requests (created_at);
alter table private.proposal_reply_requests enable row level security;
revoke all on private.proposal_reply_requests from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Cohérence état ↔ demande ouverte
-- ---------------------------------------------------------------------------

create or replace function private.sync_proposal_change_requests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.state = 'changes_requested' and old.state is distinct from 'changes_requested' then
    if not exists (
      select 1 from public.proposal_change_requests r
      where r.proposal_id = new.id and r.closed_at is null
    ) then
      raise exception 'public_message_required';
    end if;
  elsif old.state = 'changes_requested' and new.state is distinct from 'changes_requested' then
    -- Refus ou retrait pendant l'attente : la demande restée sans réponse est close.
    update public.proposal_change_requests r
    set closed_at = now()
    where r.proposal_id = new.id and r.closed_at is null;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_proposal_change_requests() from public, anon, authenticated;

create trigger proposals_sync_change_requests
  before update of state on public.proposals
  for each row execute function private.sync_proposal_change_requests();

-- ---------------------------------------------------------------------------
-- 3. Demande de précisions par la modération (équipe connectée)
-- ---------------------------------------------------------------------------

create or replace function public.admin_request_proposal_changes(
  p_proposal_id uuid,
  p_public_message text,
  p_internal_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_state public.proposal_state;
  created_request_id uuid;
  message text := btrim(coalesce(p_public_message, ''));
  note text := nullif(btrim(coalesce(p_internal_note, '')), '');
begin
  if not private.is_staff() then
    raise exception 'forbidden';
  end if;

  if char_length(message) not between 1 and 2000 then
    raise exception 'invalid_message';
  end if;
  if char_length(coalesce(note, '')) > 2000 then
    raise exception 'invalid_note';
  end if;

  select p.state into selected_state
  from public.proposals p
  where p.id = p_proposal_id
  for update;

  if selected_state is null or selected_state <> 'submitted' then
    raise exception 'proposal_already_reviewed';
  end if;

  if exists (
    select 1 from public.proposal_change_requests r
    where r.proposal_id = p_proposal_id and r.closed_at is null
  ) then
    raise exception 'request_already_open';
  end if;

  insert into public.proposal_change_requests (proposal_id, public_message, requested_by)
  values (p_proposal_id, message, auth.uid())
  returning id into created_request_id;

  -- La note reste interne (moderation_comment), comme pour admin_review_proposal.
  update public.proposals
  set state = 'changes_requested',
      moderation_comment = note,
      decided_at = null
  where id = p_proposal_id;

  insert into public.moderation_actions (
    actor_user_id, entity_type, entity_id, action, previous_state, next_state, details
  ) values (
    auth.uid(),
    'proposal',
    p_proposal_id::text,
    'reviewed',
    'submitted',
    'changes_requested',
    jsonb_build_object('note', note, 'change_request_id', created_request_id)
  );

  return created_request_id;
end;
$$;

revoke all on function public.admin_request_proposal_changes(uuid, text, text) from public, anon;
grant execute on function public.admin_request_proposal_changes(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Suivi : statut public + demande ouverte (rôle service uniquement)
-- ---------------------------------------------------------------------------

-- Les colonnes renvoyées changent : la fonction est recréée (même contrôle,
-- même limitation que 20261111160000_statut_propositions.sql).
drop function public.lookup_proposal_statuses(jsonb, text);

create function public.lookup_proposal_statuses(
  p_items jsonb,
  p_client_key text
)
returns table (
  tracking_id text,
  status text,
  updated_at timestamptz,
  request_message text,
  requested_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  item_tracking text;
  item_email text;
  item_hash text;
  recent_failures integer;
  found_id uuid;
  found_state public.proposal_state;
  found_updated_at timestamptz;
  open_message text;
  open_requested_at timestamptz;
  seen text[] := array[]::text[];
begin
  if p_client_key is null or p_client_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_request';
  end if;

  if p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'invalid_request';
  end if;

  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) <> 'object'
      or jsonb_typeof(item -> 'trackingId') is distinct from 'string'
      or jsonb_typeof(item -> 'email') is distinct from 'string'
      or (item ->> 'trackingId') !~ '^SPT-[A-Z0-9]{10}$'
      or char_length(btrim(item ->> 'email')) not between 3 and 320 then
      raise exception 'invalid_request';
    end if;
  end loop;

  delete from private.proposal_status_requests r where r.created_at < now() - interval '1 day';
  delete from private.proposal_status_failures f where f.created_at < now() - interval '1 day';

  if (
    select count(*) from private.proposal_status_requests r
    where r.client_key = p_client_key and r.created_at > now() - interval '10 minutes'
  ) >= 20 then
    raise exception 'rate_limit';
  end if;

  if (
    select count(*) from private.proposal_status_requests r
    where r.created_at > now() - interval '1 minute'
  ) >= 600 then
    raise exception 'rate_limit';
  end if;

  insert into private.proposal_status_requests (client_key, item_count)
  values (p_client_key, jsonb_array_length(p_items));

  for item in select value from jsonb_array_elements(p_items) loop
    item_tracking := item ->> 'trackingId';
    item_email := lower(btrim(item ->> 'email'));

    if item_tracking = any(seen) then
      continue;
    end if;
    seen := seen || item_tracking;

    item_hash := encode(extensions.digest(item_tracking, 'sha256'), 'hex');
    select count(*) into recent_failures
    from private.proposal_status_failures f
    where f.tracking_hash = item_hash and f.created_at > now() - interval '1 hour';

    found_id := null;
    found_state := null;
    found_updated_at := null;
    open_message := null;
    open_requested_at := null;
    if recent_failures < 10 then
      select p.id, p.state, p.updated_at
      into found_id, found_state, found_updated_at
      from public.proposals p
      where p.tracking_id = item_tracking
        and lower(p.contributor_email) = item_email;
    end if;

    tracking_id := item_tracking;
    if found_state is null then
      if recent_failures < 10 then
        insert into private.proposal_status_failures (tracking_hash) values (item_hash);
      end if;
      status := 'unknown';
      updated_at := null;
    else
      status := case found_state
        when 'draft' then 'email_pending'
        when 'email_pending' then 'email_pending'
        when 'submitted' then 'in_review'
        when 'changes_requested' then 'changes_requested'
        when 'approved' then 'published'
        when 'rejected' then 'rejected'
        when 'duplicate' then 'duplicate'
        when 'withdrawn' then 'withdrawn'
        else 'unknown'
      end;
      updated_at := case when status = 'unknown' then null else found_updated_at end;
      -- Seule la demande publique ouverte est exposée (jamais la note interne).
      if found_state = 'changes_requested' then
        select r.public_message, r.requested_at
        into open_message, open_requested_at
        from public.proposal_change_requests r
        where r.proposal_id = found_id and r.closed_at is null;
      end if;
    end if;
    request_message := open_message;
    requested_at := open_requested_at;
    return next;
  end loop;
end;
$$;

revoke all on function public.lookup_proposal_statuses(jsonb, text) from public, anon, authenticated;
grant execute on function public.lookup_proposal_statuses(jsonb, text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Réponse du contributeur (rôle service uniquement)
-- ---------------------------------------------------------------------------

create or replace function public.reply_to_proposal_request(
  p_tracking_id text,
  p_email text,
  p_response text,
  p_idempotency_key text,
  p_client_key text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  response_text text := btrim(coalesce(p_response, ''));
  key_hash text;
  tracking_hash_value text;
  recent_failures integer;
  found_id uuid;
  found_state public.proposal_state;
  open_request_id uuid;
begin
  if p_client_key is null or p_client_key !~ '^[0-9a-f]{64}$'
    or p_tracking_id is null or p_tracking_id !~ '^SPT-[A-Z0-9]{10}$'
    or char_length(normalized_email) not between 3 and 320
    or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9-]{16,64}$' then
    raise exception 'invalid_request';
  end if;

  if char_length(response_text) not between 1 and 2000 then
    raise exception 'invalid_response';
  end if;

  delete from private.proposal_reply_requests r where r.created_at < now() - interval '1 day';

  if (
    select count(*) from private.proposal_reply_requests r
    where r.client_key = p_client_key and r.created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'rate_limit';
  end if;

  if (
    select count(*) from private.proposal_reply_requests r
    where r.created_at > now() - interval '1 minute'
  ) >= 120 then
    raise exception 'rate_limit';
  end if;

  insert into private.proposal_reply_requests (client_key) values (p_client_key);

  tracking_hash_value := encode(extensions.digest(p_tracking_id, 'sha256'), 'hex');
  key_hash := encode(extensions.digest(p_idempotency_key, 'sha256'), 'hex');

  -- Même verrou anti-essais que le suivi (échecs partagés par numéro).
  select count(*) into recent_failures
  from private.proposal_status_failures f
  where f.tracking_hash = tracking_hash_value and f.created_at > now() - interval '1 hour';

  if recent_failures < 10 then
    select p.id, p.state into found_id, found_state
    from public.proposals p
    where p.tracking_id = p_tracking_id
      and lower(p.contributor_email) = normalized_email
    for update;
  end if;

  -- Double appui ou nouvelle tentative après une coupure : même clé, même
  -- résultat, aucune seconde réponse.
  if found_id is not null and exists (
    select 1 from public.proposal_change_requests r
    where r.proposal_id = found_id and r.response_key_hash = key_hash
  ) then
    return 'already_received';
  end if;

  if found_id is not null and found_state = 'changes_requested' then
    select r.id into open_request_id
    from public.proposal_change_requests r
    where r.proposal_id = found_id and r.closed_at is null
    for update;
  end if;

  -- Numéro inconnu, mauvais e-mail, aucune demande ouverte : même résultat.
  -- Pas d'exception : elle annulerait l'enregistrement de l'échec et de la
  -- requête, et la limitation ne compterait plus les essais.
  if open_request_id is null then
    if recent_failures < 10 then
      insert into private.proposal_status_failures (tracking_hash) values (tracking_hash_value);
    end if;
    return 'not_found';
  end if;

  update public.proposal_change_requests
  set response = response_text,
      response_key_hash = key_hash,
      responded_at = now(),
      closed_at = now()
  where id = open_request_id;

  -- Retour dans la file « En cours de vérification » (transition autorisée
  -- par private.validate_proposal_transition, journalisée par
  -- private.audit_state_change).
  update public.proposals
  set state = 'submitted'
  where id = found_id;

  insert into public.moderation_actions (
    actor_user_id, entity_type, entity_id, action, previous_state, next_state, details
  ) values (
    null,
    'proposal',
    found_id::text,
    'contributor_replied',
    'changes_requested',
    'submitted',
    jsonb_build_object('change_request_id', open_request_id)
  );

  return 'received';
end;
$$;

revoke all on function public.reply_to_proposal_request(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.reply_to_proposal_request(text, text, text, text, text) to service_role;
