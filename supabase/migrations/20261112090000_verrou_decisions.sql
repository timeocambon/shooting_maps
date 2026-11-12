-- Décisions finales (site et application) : verrou de décision.
--
-- Migration additive. `admin_review_proposal` reste la seule source de vérité
-- des transitions d'état (verrou de ligne, état `submitted` exigé, un seul
-- spot par proposition). Ce verrou s'ajoute en amont pour qu'une seule
-- tentative à la fois prépare les photos publiques d'une proposition :
--   - un double appui ou un second modérateur reçoit `busy` sans rien écrire ;
--   - une fiche chargée avant une modification reçoit `changed` ;
--   - une proposition déjà traitée reçoit `already_reviewed`.
-- Un verrou abandonné (fonction serveur interrompue) expire après 5 minutes.

create table private.proposal_decision_claims (
  proposal_id uuid primary key references public.proposals (id) on delete cascade,
  claim_id uuid not null unique default extensions.gen_random_uuid(),
  claimed_by uuid not null,
  claimed_at timestamptz not null default now()
);

alter table private.proposal_decision_claims enable row level security;
revoke all on table private.proposal_decision_claims from public, anon, authenticated;

-- Résultat : {"status": "claimed", "claim_id": "…"} | {"status": "busy"}
--          | {"status": "changed"} | {"status": "already_reviewed"}
create or replace function public.admin_claim_proposal_decision(
  p_proposal_id uuid,
  p_expected_version timestamptz default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  selected_state public.proposal_state;
  selected_version timestamptz;
  new_claim uuid;
begin
  if not private.is_staff() then
    raise exception 'forbidden';
  end if;

  -- Verrou de ligne : deux demandes simultanées sont traitées l'une après l'autre.
  select p.state, p.updated_at into selected_state, selected_version
  from public.proposals p
  where p.id = p_proposal_id
  for update;

  if selected_state is null or selected_state <> 'submitted' then
    return jsonb_build_object('status', 'already_reviewed');
  end if;

  if p_expected_version is not null and selected_version <> p_expected_version then
    return jsonb_build_object('status', 'changed');
  end if;

  delete from private.proposal_decision_claims c
  where c.proposal_id = p_proposal_id
    and c.claimed_at < now() - interval '5 minutes';

  insert into private.proposal_decision_claims (proposal_id, claimed_by)
  values (p_proposal_id, auth.uid())
  on conflict (proposal_id) do nothing
  returning claim_id into new_claim;

  if new_claim is null then
    return jsonb_build_object('status', 'busy');
  end if;

  return jsonb_build_object('status', 'claimed', 'claim_id', new_claim);
end;
$$;

create or replace function public.admin_release_proposal_decision(p_claim_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'forbidden';
  end if;
  delete from private.proposal_decision_claims c where c.claim_id = p_claim_id;
end;
$$;

revoke all on function public.admin_claim_proposal_decision(uuid, timestamptz) from public, anon;
revoke all on function public.admin_release_proposal_decision(uuid) from public, anon;
grant execute on function public.admin_claim_proposal_decision(uuid, timestamptz) to authenticated;
grant execute on function public.admin_release_proposal_decision(uuid) to authenticated;

comment on function public.admin_claim_proposal_decision(uuid, timestamptz) is
  'Verrou de décision finale (équipe AAL2) : une seule tentative à la fois, état et version vérifiés.';
