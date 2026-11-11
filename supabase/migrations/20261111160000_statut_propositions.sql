-- Statut public des propositions (« Mes propositions » de l'application mobile).
--
-- Consultation par couple (numéro de suivi, e-mail normalisé) uniquement :
-- le numéro seul ne permet jamais de lire une proposition. Réponse neutre
-- (« unknown ») pour un numéro inexistant comme pour un mauvais e-mail.
-- Seuls le numéro public, un statut public et la date de dernière mise à
-- jour sont renvoyés : ni e-mail, ni identifiant interne, ni commentaire.
--
-- Appelée uniquement par la route serveur /api/propositions/status avec la
-- clé de service (jamais par l'application ni par anon/authenticated).
-- Limitation :
--   - par client (empreinte SHA-256 calculée par la route) : 20 requêtes
--     par tranche de 10 minutes ;
--   - globale : 600 requêtes par minute ;
--   - par numéro de suivi : après 10 échecs en 1 heure (numéro inconnu ou
--     mauvais e-mail), le numéro répond « unknown » pendant 1 heure, même
--     avec le bon e-mail (empêche la recherche de l'e-mail par essais).
-- Le journal ne contient que des empreintes et des dates, purgées après
-- 24 heures. Migration additive : aucune migration existante n'est modifiée.

create table private.proposal_status_requests (
  id bigint generated always as identity primary key,
  client_key text not null check (client_key ~ '^[0-9a-f]{64}$'),
  item_count smallint not null check (item_count between 1 and 20),
  created_at timestamptz not null default now()
);

create index proposal_status_requests_client_idx
  on private.proposal_status_requests (client_key, created_at desc);
create index proposal_status_requests_created_idx
  on private.proposal_status_requests (created_at);

create table private.proposal_status_failures (
  id bigint generated always as identity primary key,
  tracking_hash text not null check (tracking_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index proposal_status_failures_tracking_idx
  on private.proposal_status_failures (tracking_hash, created_at desc);
create index proposal_status_failures_created_idx
  on private.proposal_status_failures (created_at);

alter table private.proposal_status_requests enable row level security;
alter table private.proposal_status_failures enable row level security;
revoke all on private.proposal_status_requests from public, anon, authenticated;
revoke all on private.proposal_status_failures from public, anon, authenticated;

create or replace function public.lookup_proposal_statuses(
  p_items jsonb,
  p_client_key text
)
returns table (tracking_id text, status text, updated_at timestamptz)
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
  found_state public.proposal_state;
  found_updated_at timestamptz;
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

  -- Validation complète avant tout enregistrement.
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) <> 'object'
      or jsonb_typeof(item -> 'trackingId') is distinct from 'string'
      or jsonb_typeof(item -> 'email') is distinct from 'string'
      or (item ->> 'trackingId') !~ '^SPT-[A-Z0-9]{10}$'
      or char_length(trim(item ->> 'email')) not between 3 and 320 then
      raise exception 'invalid_request';
    end if;
  end loop;

  delete from private.proposal_status_requests r where r.created_at < now() - interval '1 day';
  delete from private.proposal_status_failures f where f.created_at < now() - interval '1 day';

  if (
    select count(*)
    from private.proposal_status_requests r
    where r.client_key = p_client_key
      and r.created_at > now() - interval '10 minutes'
  ) >= 20 then
    raise exception 'rate_limit';
  end if;

  if (
    select count(*)
    from private.proposal_status_requests r
    where r.created_at > now() - interval '1 minute'
  ) >= 600 then
    raise exception 'rate_limit';
  end if;

  insert into private.proposal_status_requests (client_key, item_count)
  values (p_client_key, jsonb_array_length(p_items));

  for item in select value from jsonb_array_elements(p_items) loop
    item_tracking := item ->> 'trackingId';
    item_email := lower(trim(item ->> 'email'));

    if item_tracking = any(seen) then
      continue;
    end if;
    seen := seen || item_tracking;

    item_hash := encode(extensions.digest(item_tracking, 'sha256'), 'hex');
    select count(*) into recent_failures
    from private.proposal_status_failures f
    where f.tracking_hash = item_hash
      and f.created_at > now() - interval '1 hour';

    found_state := null;
    found_updated_at := null;
    if recent_failures < 10 then
      select p.state, p.updated_at
      into found_state, found_updated_at
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
    end if;
    return next;
  end loop;
end;
$$;

revoke all on function public.lookup_proposal_statuses(jsonb, text) from public, anon, authenticated;
grant execute on function public.lookup_proposal_statuses(jsonb, text) to service_role;
