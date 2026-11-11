-- Administration mobile (migration 20261111180000_administration_mobile.sql).
-- À lancer avec Supabase CLI (`npx supabase test db`) ; transaction annulée.

begin;

select plan(19);

-- Droits et search_path -----------------------------------------------------------
select ok(
  (select p.prosecdef and p.proconfig = array['search_path=""']
   from pg_catalog.pg_proc p
   where p.oid = 'public.admin_mobile_access(text)'::regprocedure),
  'admin_mobile_access : security definer, search_path vide'
);
select ok(
  has_function_privilege('authenticated', 'public.admin_mobile_access(text)', 'execute')
  and not has_function_privilege('anon', 'public.admin_mobile_access(text)', 'execute'),
  'admin_mobile_access : session connectée seulement, jamais anonyme'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'private.admin_mobile_requests'::regclass)
  and not has_table_privilege('authenticated', 'private.admin_mobile_requests', 'select')
  and not has_table_privilege('authenticated', 'private.admin_mobile_requests', 'insert')
  and not has_table_privilege('anon', 'private.admin_mobile_requests', 'select'),
  'Journal de limitation : RLS active, aucun droit direct'
);

-- Données -----------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('d1111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mod-mobile@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('d2222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rider-mobile@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('d3333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-mobile@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
insert into public.admin_users (user_id, role, display_name)
values
  ('d1111111-1111-4111-8111-111111111111', 'moderator', 'Modérateur mobile'),
  ('d3333333-3333-4333-8333-333333333333', 'administrator', 'Administrateur mobile');
insert into public.proposals (id, tracking_id, payload, contributor_email, state, email_verified_at, submitted_at, moderation_comment)
values ('e1111111-1111-4111-8111-111111111111', 'SPT-MOBILE0001', '{}'::jsonb, 'rider@example.com', 'submitted', now(), now(), 'NOTE-EQUIPE');

-- Utilisateur normal (AAL2 ou non) : refusé ----------------------------------------
select set_config('request.jwt.claims', '{"sub":"d2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is(public.admin_mobile_access('read'), 'forbidden', 'Utilisateur normal en AAL2 : refusé');
select is((select count(*)::int from public.proposals), 0, 'Utilisateur normal : aucune proposition visible (RLS)');
reset role;
select set_config('request.jwt.claims', '{"sub":"d2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is(public.admin_mobile_access('read'), 'forbidden', 'Utilisateur normal en AAL1 : refusé (pas d’invitation MFA)');
reset role;

-- Modérateur AAL1 : MFA demandée, aucune donnée -------------------------------------
select set_config('request.jwt.claims', '{"sub":"d1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is(public.admin_mobile_access('read'), 'mfa_required', 'Modérateur AAL1 : vérification MFA demandée');
select is((select count(*)::int from public.proposals), 0, 'Modérateur AAL1 : aucune proposition visible (RLS)');
reset role;
select is((select count(*)::int from private.admin_mobile_requests), 0, 'Refus non journalisés comme accès');

-- Modérateur AAL2 : autorisé ------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"d1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is(public.admin_mobile_access('read'), 'moderator', 'Modérateur AAL2 : autorisé (rôle renvoyé)');
select is(
  (select moderation_comment from public.proposals where id = 'e1111111-1111-4111-8111-111111111111'),
  'NOTE-EQUIPE',
  'Modérateur AAL2 : note interne lisible par l’équipe'
);
select throws_ok(
  $$ select public.admin_mobile_access('delete') $$,
  'P0001',
  'invalid_action',
  'Action inconnue refusée'
);
reset role;

-- Administrateur AAL2 --------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"d3333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is(public.admin_mobile_access('write'), 'administrator', 'Administrateur AAL2 : autorisé');
reset role;

-- Limitation de fréquence -----------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"d1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
do $loop$ begin for i in 1..59 loop perform public.admin_mobile_access('read'); end loop; end $loop$;
select is(public.admin_mobile_access('read'), 'rate_limit', 'Lecture : 61e requête de la minute refusée');
do $loop$ begin for i in 1..10 loop perform public.admin_mobile_access('write'); end loop; end $loop$;
select is(public.admin_mobile_access('write'), 'rate_limit', 'Écriture : 11e requête des 10 minutes refusée');
reset role;
select is(
  (select count(*)::int from private.admin_mobile_requests where user_id = 'd1111111-1111-4111-8111-111111111111'),
  70,
  'Journal : 60 lectures et 10 écritures, refus non comptés'
);
select set_config('request.jwt.claims', '{"sub":"d3333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is(public.admin_mobile_access('read'), 'administrator', 'Limitation par compte : un autre membre reste autorisé');
reset role;

-- Purge : les entrées de plus d'une heure sont supprimées au passage suivant.
update private.admin_mobile_requests set created_at = now() - interval '2 hours'
where user_id = 'd1111111-1111-4111-8111-111111111111';
select set_config('request.jwt.claims', '{"sub":"d1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is(public.admin_mobile_access('read'), 'moderator', 'Après une heure : accès rétabli');
reset role;
select is(
  (select count(*)::int from private.admin_mobile_requests where user_id = 'd1111111-1111-4111-8111-111111111111'),
  1,
  'Journal purgé (seule la dernière requête reste)'
);

select * from finish();
rollback;
