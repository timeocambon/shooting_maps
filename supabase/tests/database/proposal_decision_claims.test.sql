-- Verrou de décision finale (migration 20261112090000_verrou_decisions.sql).
-- À lancer avec Supabase CLI (`npx supabase test db`) ; transaction annulée.

begin;

select plan(18);

select ok(
  (select bool_and(p.prosecdef and p.proconfig = array['search_path=""'])
   from pg_catalog.pg_proc p
   where p.oid in (
     'public.admin_claim_proposal_decision(uuid, timestamptz)'::regprocedure,
     'public.admin_release_proposal_decision(uuid)'::regprocedure
   )),
  'Verrou : security definer, search_path vide'
);
select ok(
  has_function_privilege('authenticated', 'public.admin_claim_proposal_decision(uuid, timestamptz)', 'execute')
  and not has_function_privilege('anon', 'public.admin_claim_proposal_decision(uuid, timestamptz)', 'execute')
  and not has_function_privilege('anon', 'public.admin_release_proposal_decision(uuid)', 'execute'),
  'Verrou : session connectée seulement'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'private.proposal_decision_claims'::regclass)
  and not has_table_privilege('authenticated', 'private.proposal_decision_claims', 'select'),
  'Table des verrous : aucun accès direct'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f1111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mod-a@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('f2222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mod-b@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('f3333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rider@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
insert into public.admin_users (user_id, role, display_name)
values
  ('f1111111-1111-4111-8111-111111111111', 'moderator', 'Modérateur A'),
  ('f2222222-2222-4222-8222-222222222222', 'moderator', 'Modérateur B');
insert into public.proposals (id, tracking_id, payload, contributor_email, state, email_verified_at, submitted_at, updated_at)
values
  ('a1111111-1111-4111-8111-111111111111', 'SPT-DECISION01', '{}'::jsonb, 'rider@example.com', 'submitted', now(), now(), '2026-11-12 10:00:00.123456+00'),
  ('a2222222-2222-4222-8222-222222222222', 'SPT-DECISION02', '{}'::jsonb, 'rider@example.com', 'submitted', now(), now(), now());

-- Utilisateur normal et modérateur AAL1 refusés.
select set_config('request.jwt.claims', '{"sub":"f3333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok($$ select public.admin_claim_proposal_decision('a1111111-1111-4111-8111-111111111111') $$, 'P0001', 'forbidden', 'Utilisateur normal : refusé');
reset role;
select set_config('request.jwt.claims', '{"sub":"f1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$ select public.admin_claim_proposal_decision('a1111111-1111-4111-8111-111111111111') $$, 'P0001', 'forbidden', 'Modérateur AAL1 : refusé');
reset role;

-- Fiche obsolète, puis verrou obtenu avec la bonne version.
select set_config('request.jwt.claims', '{"sub":"f1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is(
  public.admin_claim_proposal_decision('a1111111-1111-4111-8111-111111111111', '2026-11-12 09:00:00+00') ->> 'status',
  'changed',
  'Version différente : fiche obsolète'
);
select is(
  public.admin_claim_proposal_decision('a1111111-1111-4111-8111-111111111111', '2026-11-12T10:00:00.123456+00:00') ->> 'status',
  'claimed',
  'Version identique (format ISO renvoyé par l’API) : verrou obtenu'
);
select is(
  public.admin_claim_proposal_decision('a1111111-1111-4111-8111-111111111111') ->> 'status',
  'busy',
  'Double appui : second verrou refusé'
);
reset role;
select is((select count(*)::int from private.proposal_decision_claims), 1, 'Un seul verrou enregistré');

-- Second modérateur pendant la décision.
select set_config('request.jwt.claims', '{"sub":"f2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is(
  public.admin_claim_proposal_decision('a1111111-1111-4111-8111-111111111111') ->> 'status',
  'busy',
  'Deux modérateurs : le second attend'
);
select is(
  public.admin_claim_proposal_decision('a2222222-2222-4222-8222-222222222222') ->> 'status',
  'claimed',
  'Verrou propre à chaque proposition'
);
reset role;

-- Libération puis décision via admin_review_proposal (source de vérité).
select set_config('test.claim_id', (select claim_id::text from private.proposal_decision_claims where proposal_id = 'a1111111-1111-4111-8111-111111111111'), true);
select set_config('request.jwt.claims', '{"sub":"f1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.admin_release_proposal_decision(current_setting('test.claim_id')::uuid) $$,
  'Libération du verrou'
);
reset role;
select is(
  (select count(*)::int from private.proposal_decision_claims where proposal_id = 'a1111111-1111-4111-8111-111111111111'),
  0,
  'Verrou supprimé'
);
select set_config('request.jwt.claims', '{"sub":"f1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.admin_review_proposal('a1111111-1111-4111-8111-111111111111', 'rejected', 'NOTE-PRIVEE') $$,
  'Refus enregistré par admin_review_proposal'
);
select throws_ok(
  $$ select public.admin_review_proposal('a1111111-1111-4111-8111-111111111111', 'approved', '', 'exact', false, array['a','b'], array['a','b']) $$,
  'P0001',
  'proposal_already_reviewed',
  'Décision déjà prise : aucune seconde décision, aucun spot'
);
select is(
  public.admin_claim_proposal_decision('a1111111-1111-4111-8111-111111111111') ->> 'status',
  'already_reviewed',
  'Proposition traitée : verrou refusé (409 côté API)'
);
reset role;
select is(
  (select state::text || '|' || coalesce(moderation_comment, '') from public.proposals where id = 'a1111111-1111-4111-8111-111111111111'),
  'rejected|NOTE-PRIVEE',
  'Refus enregistré, note interne conservée'
);

-- Verrou abandonné : repris après 5 minutes.
update private.proposal_decision_claims set claimed_at = now() - interval '6 minutes'
where proposal_id = 'a2222222-2222-4222-8222-222222222222';
select set_config('request.jwt.claims', '{"sub":"f1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is(
  public.admin_claim_proposal_decision('a2222222-2222-4222-8222-222222222222') ->> 'status',
  'claimed',
  'Verrou abandonné depuis plus de 5 minutes : repris'
);
reset role;

select * from finish();
rollback;
