begin;

select plan(30);

select has_function('public', 'admin_set_spot_photo_state', array['uuid', 'text'], 'Le masquage rapide d''une photo publiée existe');
select has_function('public', 'create_withdrawal_request', array['text', 'text', 'text', 'text', 'text', 'text'], 'La création publique d''une demande de retrait existe');
select has_function('public', 'admin_review_withdrawal_request', array['uuid', 'text', 'text', 'text', 'boolean', 'uuid'], 'Le traitement atomique des demandes de retrait existe');
select has_function('public', 'admin_purge_expired_proposals', array[]::text[], 'La purge automatique des propositions expirées existe');
select has_table('public', 'withdrawal_requests', 'La table des demandes de retrait existe');
select ok(not has_table_privilege('anon', 'public.withdrawal_requests', 'select'), 'Le public ne peut pas lire les demandes de retrait');

set local role anon;
select lives_ok(
  $$ select public.create_withdrawal_request(
    'photo',
    'belvedere-des-coteaux-demo',
    null,
    'La photo de couverture montre une plaque d''immatriculation lisible.',
    'demandeur@example.com',
    null
  ) $$,
  'Un visiteur peut demander le retrait d''une photo sans compte'
);
select throws_ok(
  $$ select public.create_withdrawal_request(
    'autre',
    null,
    null,
    'Une description suffisamment longue pour passer la validation du formulaire.',
    'test@example.com',
    null
  ) $$,
  'P0001',
  'invalid_kind',
  'Un type de demande inconnu est refusé'
);
select throws_ok(
  $$ select public.create_withdrawal_request(
    'data',
    'spot-qui-n-existe-pas',
    null,
    'Une description suffisamment longue pour passer la validation du formulaire.',
    'test2@example.com',
    null
  ) $$,
  'P0001',
  'spot_unknown',
  'Une fiche inconnue référencée par erreur est refusée'
);
select lives_ok(
  $$ select public.create_withdrawal_request(
    'data',
    null,
    null,
    'Une description suffisamment longue pour passer la validation du formulaire.',
    'spam@example.com',
    'http://spam.example'
  ) $$,
  'Le piège anti-spam est accepté silencieusement sans être enregistré'
);
reset role;

select is(
  (select count(*) from public.withdrawal_requests),
  1::bigint,
  'Seule la demande légitime est persistée : le piège et les tentatives invalides n''ont rien créé'
);
select is(
  (select kind from public.withdrawal_requests where description like 'La photo de couverture%'),
  'photo',
  'Le type de la demande est conservé'
);
select is(
  (select state::text from public.withdrawal_requests where description like 'La photo de couverture%'),
  'open',
  'Une nouvelle demande démarre ouverte'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'conformite-moderator@example.com',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.admin_users (user_id, role, display_name)
values ('10000000-0000-4000-8000-000000000001', 'moderator', 'Modérateur conformité');

insert into public.spot_photos (id, spot_id, original_object_path, published_object_path, public_url, display_order, rights_declared, moderation_state, metadata_stripped_at)
values
  ('10000000-0000-4000-8000-000000000002', 'e14e0530-37f6-4e32-926a-56f4f8e6ac31', 'spots/belvedere/original-0.jpg', 'spots/belvedere/published-0.webp', 'https://example.com/belvedere-0.webp', 0, true, 'approved', now()),
  ('10000000-0000-4000-8000-000000000003', 'e14e0530-37f6-4e32-926a-56f4f8e6ac31', 'spots/belvedere/original-1.jpg', 'spots/belvedere/published-1.webp', 'https://example.com/belvedere-1.webp', 1, true, 'approved', now());

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

select is(
  public.admin_set_spot_photo_state('10000000-0000-4000-8000-000000000003', 'hidden'),
  'e14e0530-37f6-4e32-926a-56f4f8e6ac31'::uuid,
  'Le masquage direct d''une photo renvoie la fiche associée'
);
select is(
  (select moderation_state::text from public.spot_photos where id = '10000000-0000-4000-8000-000000000003'),
  'hidden',
  'La photo ciblée est masquée sans toucher au reste de la fiche'
);
select throws_ok(
  $$ select public.admin_set_spot_photo_state('10000000-0000-4000-8000-000000000003', 'archived') $$,
  'P0001',
  'invalid_state',
  'Un état de photo hors approved/hidden est refusé'
);

select is(
  public.admin_review_withdrawal_request(
    (select id from public.withdrawal_requests where description like 'La photo de couverture%'),
    'resolved',
    'La photo signalée a été retirée de la publication.',
    'Vérifiée et masquée manuellement.',
    false,
    '10000000-0000-4000-8000-000000000002'
  ),
  (select id from public.withdrawal_requests where description like 'La photo de couverture%'),
  'Le traitement peut résoudre la demande tout en masquant la photo visée'
);
select is(
  (select state::text from public.withdrawal_requests where description like 'La photo de couverture%'),
  'resolved',
  'La demande traitée passe à l''état résolu'
);
select is(
  (select moderation_state::text from public.spot_photos where id = '10000000-0000-4000-8000-000000000002'),
  'hidden',
  'La photo visée par la demande est masquée par le même traitement'
);
select is(
  (select count(*) from public.moderation_actions where entity_type = 'withdrawal_request' and action = 'review_updated'),
  1::bigint,
  'Le traitement est journalisé'
);
select throws_ok(
  $$ select public.admin_review_withdrawal_request(
    (select id from public.withdrawal_requests where description like 'La photo de couverture%'),
    'dismissed',
    'Nouvelle décision',
    '',
    false,
    null
  ) $$,
  'P0001',
  'request_already_reviewed',
  'Une seconde décision définitive est refusée'
);

insert into public.withdrawal_requests (id, kind, spot_id, description, requester_email)
values (
  '10000000-0000-4000-8000-000000000004',
  'data',
  null,
  'Suppression demandée de toutes les données personnelles associées à mon envoi.',
  'suppression@example.com'
);
select throws_ok(
  $$ select public.admin_review_withdrawal_request(
    '10000000-0000-4000-8000-000000000004',
    'resolved',
    '',
    'note',
    false,
    null
  ) $$,
  'P0001',
  'decision_required',
  'Une décision finale sans motif est refusée'
);
select is(
  public.admin_review_withdrawal_request(
    '10000000-0000-4000-8000-000000000004',
    'dismissed',
    'Aucune fiche publiée n''est associée à cette demande.',
    'Vérifié auprès du contributeur',
    false,
    null
  ),
  '10000000-0000-4000-8000-000000000004'::uuid,
  'Une demande sans fiche associée peut être classée sans suite'
);
select is(
  (select state::text from public.withdrawal_requests where id = '10000000-0000-4000-8000-000000000004'),
  'dismissed',
  'La demande sans fiche est bien classée sans suite'
);

insert into public.withdrawal_requests (id, kind, spot_id, description, requester_email)
values (
  '10000000-0000-4000-8000-000000000005',
  'photo',
  'b60fd0db-86af-4814-bc2b-8c9cb714ed79',
  'Toutes les photos de cette fiche doivent être retirées en attendant vérification.',
  'retrait-fiche@example.com'
);
select is(
  public.admin_review_withdrawal_request(
    '10000000-0000-4000-8000-000000000005',
    'resolved',
    'La fiche est masquée le temps de vérifier les droits sur les images.',
    'Masquage de précaution',
    true,
    null
  ),
  '10000000-0000-4000-8000-000000000005'::uuid,
  'Le traitement peut masquer toute la fiche liée à la demande'
);
select is(
  (select publication_state::text from public.spots where id = 'b60fd0db-86af-4814-bc2b-8c9cb714ed79'),
  'hidden',
  'La fiche visée par la demande de retrait est masquée'
);

insert into public.proposals (id, contributor_email, state, created_at)
values ('10000000-0000-4000-8000-000000000006', 'purge-brouillon@example.com', 'draft', now() - interval '40 days');
insert into public.proposals (id, contributor_email, state, submitted_at, decided_at, created_at)
values ('10000000-0000-4000-8000-000000000007', 'purge-refusee@example.com', 'rejected', now() - interval '150 days', now() - interval '100 days', now() - interval '150 days');
insert into public.proposals (id, contributor_email, state, submitted_at, created_at)
values ('10000000-0000-4000-8000-000000000008', 'purge-recente@example.com', 'submitted', now(), now());
insert into storage.objects (bucket_id, name)
values ('spot-originals', 'proposals/10000000-0000-4000-8000-000000000006/original.jpg');

select is(
  public.admin_purge_expired_proposals(),
  jsonb_build_object('unconfirmed', 1, 'closed', 1),
  'La purge retire une proposition non confirmée expirée et une proposition refusée expirée'
);

reset role;

select is(
  (select count(*) from public.proposals where id in ('10000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000007')),
  0::bigint,
  'Les propositions expirées sont définitivement supprimées'
);
select is(
  (select count(*) from public.proposals where id = '10000000-0000-4000-8000-000000000008'),
  1::bigint,
  'Une proposition récente n''est jamais purgée'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'spot-originals' and name like 'proposals/10000000-0000-4000-8000-000000000006/%'),
  0::bigint,
  'Les fichiers d''origine de la proposition purgée sont retirés du stockage'
);

select * from finish();
rollback;
