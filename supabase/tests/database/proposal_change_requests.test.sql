-- Parcours « Demande de précisions » (migration 20261111170000_demandes_precisions.sql).
-- À lancer avec Supabase CLI (`npx supabase test db`) ; transaction annulée.

begin;

select plan(46);

-- Droits et search_path -----------------------------------------------------------
select ok(
  (select bool_and(p.prosecdef and p.proconfig = array['search_path=""'])
   from pg_catalog.pg_proc p
   where p.oid in (
     'public.lookup_proposal_statuses(jsonb, text)'::regprocedure,
     'public.reply_to_proposal_request(text, text, text, text, text)'::regprocedure,
     'public.admin_request_proposal_changes(uuid, text, text)'::regprocedure,
     'private.sync_proposal_change_requests()'::regprocedure
   )),
  'Les quatre fonctions sont security definer avec un search_path vide'
);
select ok(
  has_function_privilege('service_role', 'public.reply_to_proposal_request(text, text, text, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.reply_to_proposal_request(text, text, text, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.reply_to_proposal_request(text, text, text, text, text)', 'execute'),
  'Réponse du contributeur : rôle service uniquement'
);
select ok(
  has_function_privilege('service_role', 'public.lookup_proposal_statuses(jsonb, text)', 'execute')
  and not has_function_privilege('anon', 'public.lookup_proposal_statuses(jsonb, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.lookup_proposal_statuses(jsonb, text)', 'execute'),
  'Suivi : rôle service uniquement'
);
select ok(
  has_function_privilege('authenticated', 'public.admin_request_proposal_changes(uuid, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.admin_request_proposal_changes(uuid, text, text)', 'execute'),
  'Demande de précisions : équipe connectée seulement (contrôle is_staff dans la fonction)'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.proposal_change_requests'::regclass)
  and not has_table_privilege('anon', 'public.proposal_change_requests', 'select')
  and not has_table_privilege('authenticated', 'public.proposal_change_requests', 'insert')
  and not has_table_privilege('authenticated', 'public.proposal_change_requests', 'update'),
  'Échanges : RLS active, aucune écriture directe, aucune lecture anonyme'
);
select ok(
  not has_table_privilege('anon', 'private.proposal_reply_requests', 'select')
  and not has_table_privilege('authenticated', 'private.proposal_reply_requests', 'select'),
  'Journal de limitation des réponses non lisible'
);
select is(
  (select array_agg(a.name order by a.position)
   from pg_catalog.pg_proc p,
     unnest(p.proargnames, p.proargmodes::text[]) with ordinality as a(name, mode, position)
   where p.oid = 'public.lookup_proposal_statuses(jsonb, text)'::regprocedure and a.mode = 't'),
  array['tracking_id', 'status', 'updated_at', 'request_message', 'requested_at'],
  'Suivi : seules colonnes publiques (ni e-mail, ni UUID, ni note interne)'
);

-- Données -----------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'b2222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'moderation-echanges@example.com', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);
insert into public.admin_users (user_id, role, display_name)
values ('b2222222-2222-4222-8222-222222222222', 'moderator', 'Modérateur échanges');

insert into public.proposals (id, tracking_id, payload, contributor_email, state, email_verified_at, submitted_at)
values
  ('c1111111-1111-4111-8111-111111111111', 'SPT-ECHANGE001', '{}'::jsonb, 'rider@example.com', 'submitted', now(), now()),
  ('c2222222-2222-4222-8222-222222222222', 'SPT-ECHANGE002', '{}'::jsonb, 'rider@example.com', 'submitted', now(), now()),
  ('c3333333-3333-4333-8333-333333333333', 'SPT-ECHANGE003', '{}'::jsonb, 'rider@example.com', 'submitted', now(), now());

-- Demande de précisions (modération) ---------------------------------------------
select set_config('request.jwt.claims', '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.admin_request_proposal_changes('c1111111-1111-4111-8111-111111111111', 'Message', null) $$,
  'P0001', 'forbidden', 'Sans MFA (aal1), la demande est refusée'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.admin_request_proposal_changes('c1111111-1111-4111-8111-111111111111', '   ', null) $$,
  'P0001', 'invalid_message', 'Message public obligatoire'
);
select throws_ok(
  format($$ select public.admin_request_proposal_changes('c1111111-1111-4111-8111-111111111111', %L, null) $$, repeat('m', 2001)),
  'P0001', 'invalid_message', 'Message public limité à 2000 caractères'
);
select throws_ok(
  format($$ select public.admin_request_proposal_changes('c1111111-1111-4111-8111-111111111111', 'Message', %L) $$, repeat('n', 2001)),
  'P0001', 'invalid_note', 'Note interne limitée à 2000 caractères'
);
select lives_ok(
  format($$ select public.admin_request_proposal_changes('c1111111-1111-4111-8111-111111111111', %L, 'NOTE-INTERNE-SECRETE') $$,
    '  Pouvez-vous préciser l''accès au parking ?  ' || repeat('x', 1940)),
  'Un modérateur avec MFA demande des précisions (message de 2000 caractères après trim)'
);
select throws_ok(
  $$ select public.admin_request_proposal_changes('c1111111-1111-4111-8111-111111111111', 'Seconde demande', null) $$,
  'P0001', 'proposal_already_reviewed', 'Pas de seconde demande tant que la première est ouverte'
);
select throws_ok(
  $$ select public.admin_review_proposal('c2222222-2222-4222-8222-222222222222', 'changes_requested', 'Note seule') $$,
  'P0001', 'public_message_required', 'admin_review_proposal ne peut plus demander des précisions sans message public'
);
select is(
  (select count(*)::int from public.proposal_change_requests where proposal_id = 'c1111111-1111-4111-8111-111111111111'),
  1,
  'L''équipe lit l''historique des échanges'
);
reset role;

select is(
  (select state::text || '|' || moderation_comment from public.proposals where id = 'c1111111-1111-4111-8111-111111111111'),
  'changes_requested|NOTE-INTERNE-SECRETE',
  'Proposition en « changes_requested », note gardée dans moderation_comment (interne)'
);
select is(
  (select public_message from public.proposal_change_requests where proposal_id = 'c1111111-1111-4111-8111-111111111111'),
  'Pouvez-vous préciser l''accès au parking ?  ' || repeat('x', 1940),
  'Message public enregistré sans espaces de début ni de fin, séparé de la note'
);
select throws_ok(
  $$ insert into public.proposal_change_requests (proposal_id, public_message) values ('c1111111-1111-4111-8111-111111111111', 'Doublon') $$,
  '23505', null, 'Une seule demande ouverte par proposition (index unique)'
);
select ok(
  exists (select 1 from public.moderation_actions m
          where m.entity_id = 'c1111111-1111-4111-8111-111111111111' and m.action = 'reviewed'
            and m.previous_state = 'submitted' and m.next_state = 'changes_requested')
  and exists (select 1 from public.moderation_actions m
          where m.entity_id = 'c1111111-1111-4111-8111-111111111111' and m.action = 'state_changed'
            and m.next_state = 'changes_requested'),
  'Décision journalisée (reviewed + state_changed), comme admin_review_proposal'
);

-- Un compte non membre de l'équipe ne voit aucun échange.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('b3333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'visiteur@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
select set_config('request.jwt.claims', '{"sub":"b3333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::int from public.proposal_change_requests), 0, 'Un compte hors équipe ne lit aucun échange');
reset role;

-- Suivi (rôle service) -------------------------------------------------------------
set local role service_role;
select is(
  (select s.status || '|' || left(s.request_message, 41) || '|' || (s.requested_at is not null)::text
   from public.lookup_proposal_statuses('[{"trackingId":"SPT-ECHANGE001","email":" Rider@Example.com "}]'::jsonb, repeat('a', 64)) s),
  'changes_requested|Pouvez-vous préciser l''accès au parking ?|true',
  'Bon couple : statut et message public de la demande ouverte'
);
select ok(
  (select row_to_json(s)::text not like '%NOTE-INTERNE%' and row_to_json(s)::text not like '%rider@%'
     and row_to_json(s)::text not like '%c1111111%'
   from public.lookup_proposal_statuses('[{"trackingId":"SPT-ECHANGE001","email":"rider@example.com"}]'::jsonb, repeat('a', 64)) s),
  'Suivi : jamais la note interne, l''e-mail ni l''UUID'
);
select is(
  (select row_to_json(s)::jsonb - 'tracking_id'
   from public.lookup_proposal_statuses('[{"trackingId":"SPT-ECHANGE001","email":"intrus@example.com"}]'::jsonb, repeat('b', 64)) s),
  (select row_to_json(s)::jsonb - 'tracking_id'
   from public.lookup_proposal_statuses('[{"trackingId":"SPT-INCONNU001","email":"rider@example.com"}]'::jsonb, repeat('b', 64)) s),
  'Mauvais e-mail et numéro inconnu : réponses identiques'
);
select is(
  (select row_to_json(s)::jsonb - 'tracking_id'
   from public.lookup_proposal_statuses('[{"trackingId":"SPT-ECHANGE001","email":"intrus@example.com"}]'::jsonb, repeat('b', 64)) s),
  '{"status":"unknown","updated_at":null,"request_message":null,"requested_at":null}'::jsonb,
  'Réponse neutre : ni statut, ni date, ni message'
);

-- Réponse du contributeur (rôle service) --------------------------------------------
select is(
  public.reply_to_proposal_request('SPT-ECHANGE001', 'intrus@example.com', 'Réponse', 'cle-intrus-0000001', repeat('c', 64)),
  'not_found', 'Mauvais e-mail : not_found'
);
select is(
  public.reply_to_proposal_request('SPT-INCONNU001', 'rider@example.com', 'Réponse', 'cle-inconnu-000001', repeat('c', 64)),
  'not_found', 'Numéro inconnu : même résultat'
);
select is(
  public.reply_to_proposal_request('SPT-ECHANGE002', 'rider@example.com', 'Réponse', 'cle-sans-demande-1', repeat('c', 64)),
  'not_found', 'Réponse impossible sans demande ouverte'
);
select throws_ok(
  $$ select public.reply_to_proposal_request('SPT-ECHANGE001', 'rider@example.com', '   ', 'cle-vide-00000001', repeat('c', 64)) $$,
  'P0001', 'invalid_response', 'Réponse vide refusée'
);
select throws_ok(
  format($$ select public.reply_to_proposal_request('SPT-ECHANGE001', 'rider@example.com', %L, 'cle-longue-000001', %L) $$, repeat('r', 2001), repeat('c', 64)),
  'P0001', 'invalid_response', 'Réponse limitée à 2000 caractères'
);
select throws_ok(
  $$ select public.reply_to_proposal_request('SPT-ECHANGE001', 'rider@example.com', 'Réponse', 'court', repeat('c', 64)) $$,
  'P0001', 'invalid_request', 'Clé d''idempotence trop courte refusée'
);
select is(
  public.reply_to_proposal_request('SPT-ECHANGE001', ' RIDER@example.com ', '  Le parking est derrière l''église.  ', 'cle-reponse-0000001', repeat('c', 64)),
  'received', 'Bonne réponse : reçue'
);
select is(
  public.reply_to_proposal_request('SPT-ECHANGE001', 'rider@example.com', 'Le parking est derrière l''église.', 'cle-reponse-0000001', repeat('c', 64)),
  'already_received', 'Double appui (même clé) : idempotent'
);
select is(
  public.reply_to_proposal_request('SPT-ECHANGE001', 'rider@example.com', 'Autre réponse', 'cle-reponse-0000002', repeat('c', 64)),
  'not_found', 'Nouvelle clé après réponse : plus de demande ouverte'
);
select is(
  (select s.status || '|' || coalesce(s.request_message, 'null')
   from public.lookup_proposal_statuses('[{"trackingId":"SPT-ECHANGE001","email":"rider@example.com"}]'::jsonb, repeat('a', 64)) s),
  'in_review|null',
  'Après réponse : « en cours de vérification », plus de demande affichée'
);
reset role;

select is(
  (select state::text from public.proposals where id = 'c1111111-1111-4111-8111-111111111111'),
  'submitted',
  'Transition changes_requested → submitted'
);
select is(
  (select count(*)::int || '|' || max(response) || '|' || bool_and(closed_at is not null and responded_at is not null)::text
   from public.proposal_change_requests where proposal_id = 'c1111111-1111-4111-8111-111111111111'),
  '1|Le parking est derrière l''église.|true',
  'Une seule réponse enregistrée, demande close'
);
select ok(
  exists (select 1 from public.moderation_actions m
          where m.entity_id = 'c1111111-1111-4111-8111-111111111111' and m.action = 'contributor_replied'
            and m.previous_state = 'changes_requested' and m.next_state = 'submitted'
            and not (m.details ? 'response'))
  and exists (select 1 from public.moderation_actions m
          where m.entity_id = 'c1111111-1111-4111-8111-111111111111' and m.action = 'state_changed'
            and m.previous_state = 'changes_requested' and m.next_state = 'submitted'),
  'Réponse journalisée (contributor_replied + state_changed), sans copier le texte'
);

-- Nouvelle décision possible, puis seconde demande ----------------------------------
select set_config('request.jwt.claims', '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.admin_request_proposal_changes('c1111111-1111-4111-8111-111111111111', 'Une dernière photo du portail ?', null) $$,
  'Après la réponse, une nouvelle décision (ici une seconde demande) est possible'
);
select lives_ok(
  $$ select public.admin_request_proposal_changes('c3333333-3333-4333-8333-333333333333', 'Précisez la circulation.', null) $$,
  'Demande sur une autre proposition'
);
update public.proposals set state = 'rejected' where id = 'c3333333-3333-4333-8333-333333333333';
reset role;
select is(
  (select count(*)::int from public.proposal_change_requests where proposal_id = 'c1111111-1111-4111-8111-111111111111'),
  2,
  'Historique conservé : deux demandes'
);
select ok(
  (select closed_at is not null and response is null from public.proposal_change_requests
   where proposal_id = 'c3333333-3333-4333-8333-333333333333'),
  'Refus pendant l''attente : la demande sans réponse est close'
);

-- Limitation des réponses ---------------------------------------------------------------
set local role service_role;
select lives_ok(
  $$ do $loop$ begin
       for i in 1..10 loop
         perform public.reply_to_proposal_request('SPT-LIMITE0001', 'rider@example.com', 'Réponse', 'cle-limite-' || lpad(i::text, 8, '0'), repeat('d', 64));
       end loop;
     end $loop$ $$,
  '10 réponses du même client en une heure acceptées'
);
select throws_ok(
  $$ select public.reply_to_proposal_request('SPT-LIMITE0001', 'rider@example.com', 'Réponse', 'cle-limite-00000011', repeat('d', 64)) $$,
  'P0001', 'rate_limit', 'La 11e réponse du même client est refusée'
);
select is(
  public.reply_to_proposal_request('SPT-ECHANGE001', 'rider@example.com', 'Réponse au portail', 'cle-autre-client-01', repeat('e', 64)),
  'received',
  'Un autre client n''est pas bloqué'
);
-- 10 essais d'e-mail sur un numéro : verrou, même avec le bon e-mail ensuite.
select lives_ok(
  $$ do $loop$ begin
       for i in 1..10 loop
         perform public.reply_to_proposal_request('SPT-ECHANGE002', 'essai' || i || '@example.com', 'Réponse',
           'cle-essai-' || lpad(i::text, 8, '0'), encode(extensions.digest('client' || i, 'sha256'), 'hex'));
       end loop;
     end $loop$ $$,
  '10 essais d''e-mail depuis 10 clients'
);
reset role;
set local role service_role;
select is(
  (select s.status from public.lookup_proposal_statuses('[{"trackingId":"SPT-ECHANGE002","email":"rider@example.com"}]'::jsonb, repeat('f', 64)) s),
  'unknown',
  'Après 10 échecs, le numéro est verrouillé (suivi et réponse)'
);
reset role;

select * from finish();
rollback;
