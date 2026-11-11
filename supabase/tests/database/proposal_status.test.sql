-- public.lookup_proposal_statuses (migration 20261111160000_statut_propositions.sql).
-- À lancer avec Supabase CLI (`npx supabase test db`) ; transaction annulée.

begin;

select plan(26);

-- Droits : rôle service uniquement --------------------------------------------
select ok(
  (select p.prosecdef from pg_catalog.pg_proc p where p.oid = 'public.lookup_proposal_statuses(jsonb, text)'::regprocedure),
  'Fonction security definer'
);
select ok(
  (select p.proconfig from pg_catalog.pg_proc p where p.oid = 'public.lookup_proposal_statuses(jsonb, text)'::regprocedure)
  = array['search_path=""'],
  'search_path vide'
);
select ok(
  not has_function_privilege('anon', 'public.lookup_proposal_statuses(jsonb, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.lookup_proposal_statuses(jsonb, text)', 'execute'),
  'anon et authenticated ne peuvent pas l''appeler'
);
select ok(
  has_function_privilege('service_role', 'public.lookup_proposal_statuses(jsonb, text)', 'execute'),
  'Le rôle service peut l''appeler'
);
select ok(
  not has_table_privilege('anon', 'private.proposal_status_requests', 'select')
  and not has_table_privilege('authenticated', 'private.proposal_status_failures', 'select'),
  'Le journal de limitation n''est pas lisible par le public'
);

-- Données ----------------------------------------------------------------------
insert into public.proposals (id, tracking_id, payload, contributor_email, state, moderation_comment)
values
  ('a1111111-1111-4111-8111-111111111111', 'SPT-STATUS0001', '{}'::jsonb, 'rider@example.com', 'email_pending', null),
  ('a2222222-2222-4222-8222-222222222222', 'SPT-STATUS0002', '{}'::jsonb, 'rider@example.com', 'submitted', null),
  ('a3333333-3333-4333-8333-333333333333', 'SPT-STATUS0003', '{}'::jsonb, 'autre@example.com', 'changes_requested', 'Commentaire interne confidentiel'),
  ('a4444444-4444-4444-8444-444444444444', 'SPT-STATUS0004', '{}'::jsonb, 'rider@example.com', 'approved', null),
  ('a5555555-5555-4555-8555-555555555555', 'SPT-STATUS0005', '{}'::jsonb, 'rider@example.com', 'rejected', 'Refus interne'),
  ('a6666666-6666-4666-8666-666666666666', 'SPT-STATUS0006', '{}'::jsonb, 'rider@example.com', 'duplicate', null),
  ('a7777777-7777-4777-8777-777777777777', 'SPT-STATUS0007', '{}'::jsonb, 'rider@example.com', 'withdrawn', null),
  ('a8888888-8888-4888-8888-888888888888', 'SPT-STATUS0008', '{}'::jsonb, 'cible@example.com', 'submitted', null);

set local role service_role;

-- Correspondance correcte, statuts publics -------------------------------------
select is(
  (select array_agg(s.tracking_id || '=' || s.status order by s.tracking_id)
   from public.lookup_proposal_statuses(
     '[{"trackingId":"SPT-STATUS0001","email":"rider@example.com"},
       {"trackingId":"SPT-STATUS0002","email":" Rider@Example.COM "},
       {"trackingId":"SPT-STATUS0003","email":"autre@example.com"},
       {"trackingId":"SPT-STATUS0004","email":"rider@example.com"},
       {"trackingId":"SPT-STATUS0005","email":"rider@example.com"},
       {"trackingId":"SPT-STATUS0006","email":"rider@example.com"},
       {"trackingId":"SPT-STATUS0007","email":"rider@example.com"}]'::jsonb,
     repeat('a', 64)) s),
  array['SPT-STATUS0001=email_pending', 'SPT-STATUS0002=in_review', 'SPT-STATUS0003=changes_requested',
        'SPT-STATUS0004=published', 'SPT-STATUS0005=rejected', 'SPT-STATUS0006=duplicate', 'SPT-STATUS0007=withdrawn'],
  'Numéro + e-mail normalisé : statut public de chaque état'
);
select ok(
  (select bool_and(s.updated_at is not null)
   from public.lookup_proposal_statuses('[{"trackingId":"SPT-STATUS0002","email":"rider@example.com"}]'::jsonb, repeat('a', 64)) s),
  'La date de dernière mise à jour est renvoyée pour une correspondance'
);
select is(
  (select array_agg(a.name order by a.position)
   from pg_catalog.pg_proc p,
     unnest(p.proargnames, p.proargmodes::text[]) with ordinality as a(name, mode, position)
   where p.oid = 'public.lookup_proposal_statuses(jsonb, text)'::regprocedure
     and a.mode = 't'),
  array['tracking_id', 'status', 'updated_at', 'request_message', 'requested_at'],
  'Colonnes publiques seulement : numéro, statut, date, demande publique ouverte (20261111170000) ; ni e-mail, ni UUID, ni commentaire'
);

-- Mauvais e-mail et numéro inconnu : même réponse neutre -----------------------
select is(
  (select s.status || '/' || coalesce(s.updated_at::text, 'null')
   from public.lookup_proposal_statuses('[{"trackingId":"SPT-STATUS0002","email":"intrus@example.com"}]'::jsonb, repeat('b', 64)) s),
  'unknown/null',
  'Mauvais e-mail : « unknown » sans date'
);
select is(
  (select s.status || '/' || coalesce(s.updated_at::text, 'null')
   from public.lookup_proposal_statuses('[{"trackingId":"SPT-INCONNU999","email":"rider@example.com"}]'::jsonb, repeat('b', 64)) s),
  'unknown/null',
  'Numéro inconnu : exactement la même réponse'
);
select is(
  (select count(*)::int from public.lookup_proposal_statuses(
     '[{"trackingId":"SPT-STATUS0001","email":"rider@example.com"},{"trackingId":"SPT-STATUS0001","email":"rider@example.com"}]'::jsonb,
     repeat('b', 64))),
  1,
  'Un numéro répété n''est traité qu''une fois'
);

-- Validation et limite de lot ---------------------------------------------------
select throws_ok(
  format($$ select * from public.lookup_proposal_statuses(%L::jsonb, %L) $$,
    (select jsonb_agg(jsonb_build_object('trackingId', 'SPT-STATUS0001', 'email', 'rider@example.com')) from generate_series(1, 21)),
    repeat('c', 64)),
  'P0001', 'invalid_request', 'Plus de 20 éléments refusés'
);
select throws_ok($$ select * from public.lookup_proposal_statuses('[]'::jsonb, repeat('c', 64)) $$, 'P0001', 'invalid_request', 'Lot vide refusé');
select throws_ok($$ select * from public.lookup_proposal_statuses('{"trackingId":"SPT-STATUS0001"}'::jsonb, repeat('c', 64)) $$, 'P0001', 'invalid_request', 'Objet au lieu d''une liste refusé');
select throws_ok($$ select * from public.lookup_proposal_statuses('[{"trackingId":"SPT-STATUS0001"}]'::jsonb, repeat('c', 64)) $$, 'P0001', 'invalid_request', 'E-mail absent refusé');
select throws_ok($$ select * from public.lookup_proposal_statuses('[{"trackingId":"spt-status0001","email":"rider@example.com"}]'::jsonb, repeat('c', 64)) $$, 'P0001', 'invalid_request', 'Numéro mal formé refusé');
select throws_ok($$ select * from public.lookup_proposal_statuses('[{"trackingId":"SPT-STATUS0001","email":"rider@example.com"}]'::jsonb, 'pas-une-empreinte') $$, 'P0001', 'invalid_request', 'Clé client invalide refusée');
-- Journal privé lu par le propriétaire (le rôle service n'a pas accès à « private »).
reset role;
select is(
  (select count(*)::int from private.proposal_status_requests where client_key = repeat('c', 64)),
  0,
  'Une requête invalide n''est pas comptée'
);
set local role service_role;

-- Limitation par client ---------------------------------------------------------
select lives_ok(
  $$ do $loop$ begin
       for i in 1..20 loop
         perform * from public.lookup_proposal_statuses('[{"trackingId":"SPT-STATUS0004","email":"rider@example.com"}]'::jsonb, repeat('d', 64));
       end loop;
     end $loop$ $$,
  '20 requêtes du même client en 10 minutes acceptées'
);
select throws_ok(
  $$ select * from public.lookup_proposal_statuses('[{"trackingId":"SPT-STATUS0004","email":"rider@example.com"}]'::jsonb, repeat('d', 64)) $$,
  'P0001', 'rate_limit', 'La 21e requête du même client est refusée'
);
select lives_ok(
  $$ select * from public.lookup_proposal_statuses('[{"trackingId":"SPT-STATUS0004","email":"rider@example.com"}]'::jsonb, repeat('e', 64)) $$,
  'Un autre client n''est pas bloqué'
);

-- Verrou anti-recherche de l'e-mail par essais ----------------------------------
select lives_ok(
  $$ select count(*) from generate_series(1, 10) g,
       lateral public.lookup_proposal_statuses(
         jsonb_build_array(jsonb_build_object('trackingId', 'SPT-STATUS0008', 'email', 'essai' || g || '@example.com')),
         encode(extensions.digest('essai' || g, 'sha256'), 'hex')) $$,
  '10 essais d''e-mail sur le même numéro, depuis 10 clients différents'
);
select is(
  (select s.status from public.lookup_proposal_statuses('[{"trackingId":"SPT-STATUS0008","email":"cible@example.com"}]'::jsonb, repeat('f', 64)) s),
  'unknown',
  'Après 10 échecs, même le bon e-mail reçoit la réponse neutre pendant 1 heure'
);
select is(
  (select s.status from public.lookup_proposal_statuses('[{"trackingId":"SPT-STATUS0004","email":"rider@example.com"}]'::jsonb, repeat('f', 64)) s),
  'published',
  'Les autres numéros ne sont pas affectés'
);
reset role;

select ok(
  not exists (select 1 from private.proposal_status_failures where tracking_hash !~ '^[0-9a-f]{64}$')
  and not exists (select 1 from private.proposal_status_requests where client_key !~ '^[0-9a-f]{64}$'),
  'Le journal ne contient que des empreintes (aucun e-mail ni numéro en clair)'
);

select is(
  (select count(*)::int from public.proposals where moderation_comment is not null),
  2,
  'Les données des propositions ne sont pas modifiées'
);

select * from finish();
rollback;
