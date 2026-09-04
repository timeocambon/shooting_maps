begin;

select plan(19);

select has_column('public', 'proposals', 'upload_secret_hash', 'Les capacités de téléversement sont stockées sous forme de condensat');
select has_function('public', 'create_public_proposal', array['jsonb', 'text', 'text', 'text', 'text', 'boolean', 'boolean', 'boolean', 'boolean', 'boolean'], 'La création publique contrôlée existe');
select has_function('public', 'attach_proposal_photo', array['uuid', 'text', 'text', 'text', 'smallint', 'text', 'text', 'integer', 'integer', 'integer'], 'Le rattachement contrôlé des photos existe');
select has_function('public', 'confirm_proposal_email', array['text'], 'La confirmation à usage unique existe');
select has_function('public', 'admin_review_proposal', array['uuid', 'text', 'text', 'text', 'boolean', 'text[]', 'text[]'], 'La décision atomique de modération existe');
select ok(not has_table_privilege('anon', 'public.proposals', 'select'), 'Le public ne peut pas lire les propositions');

insert into public.proposals (
  id, tracking_id, payload, contributor_email, state,
  email_verification_token_hash, email_verification_expires_at
) values (
  '11111111-1111-4111-8111-111111111111',
  'SPT-TESTTOKEN1',
  '{}'::jsonb,
  'confirmation@example.com',
  'email_pending',
  encode(extensions.digest('a-long-confirmation-token-used-for-testing-123456789', 'sha256'), 'hex'),
  now() + interval '1 hour'
);

insert into public.proposal_photos (
  proposal_id, original_object_path, processed_object_path, display_order, rights_declared
) values
  ('11111111-1111-4111-8111-111111111111', 'test/original-1.jpg', 'test/processed-1.webp', 0, true),
  ('11111111-1111-4111-8111-111111111111', 'test/original-2.jpg', 'test/processed-2.webp', 1, true);

set local role anon;
select is(
  (select tracking_id from public.confirm_proposal_email('a-long-confirmation-token-used-for-testing-123456789')),
  'SPT-TESTTOKEN1',
  'Un jeton valide confirme la proposition'
);
select is(
  (select count(*) from public.confirm_proposal_email('a-long-confirmation-token-used-for-testing-123456789')),
  0::bigint,
  'Le même jeton ne peut pas être rejoué'
);
reset role;

select is(
  (select state::text from public.proposals where id = '11111111-1111-4111-8111-111111111111'),
  'submitted',
  'La confirmation place la proposition dans la file de modération'
);
select is(
  (select email_verification_token_hash from public.proposals where id = '11111111-1111-4111-8111-111111111111'),
  null,
  'Le condensat du jeton est supprimé après confirmation'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '22222222-2222-4222-8222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'moderator@example.com',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.admin_users (user_id, role, display_name)
values ('22222222-2222-4222-8222-222222222222', 'moderator', 'Modérateur test');

insert into public.proposals (
  id, tracking_id, payload, contributor_email, state, email_verified_at, submitted_at
) values (
  '33333333-3333-4333-8333-333333333333',
  'SPT-REJECTION1',
  '{}'::jsonb,
  'review@example.com',
  'submitted',
  now(),
  now()
);

select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select ok(
  public.admin_review_proposal(
    '33333333-3333-4333-8333-333333333333',
    'rejected',
    'Accès impossible à vérifier'
  ) is null,
  'Un modérateur avec MFA peut refuser une proposition'
);
reset role;

select is(
  (select state::text from public.proposals where id = '33333333-3333-4333-8333-333333333333'),
  'rejected',
  'La décision est persistée'
);
select is(
  (select moderation_comment from public.proposals where id = '33333333-3333-4333-8333-333333333333'),
  'Accès impossible à vérifier',
  'La note interne est conservée'
);
select ok(
  (select count(*) from public.moderation_actions where entity_id = '33333333-3333-4333-8333-333333333333') >= 2,
  'La transition et la décision détaillée sont journalisées'
);

insert into public.proposals (
  id, tracking_id, payload, contributor_email, state, email_verified_at, submitted_at
) values (
  '44444444-4444-4444-8444-444444444444',
  'SPT-APPROVAL01',
  '{
    "latitude": 43.5477,
    "longitude": 1.4782,
    "municipality": "Ramonville-Saint-Agne",
    "postalCode": "31520",
    "displayPrecision": "exact",
    "accessWithoutTrespass": true,
    "name": "Spot approuvé par le test",
    "categories": ["nature"],
    "shortDescription": "Une description suffisamment longue pour la publication du test.",
    "bestTimes": ["morning"],
    "visualFeatures": "Lumière douce",
    "accessLevel": "easy",
    "parking": "Parking proche",
    "walkingApproach": "Deux minutes à pied",
    "surfaceType": "asphalt",
    "traffic": "Faible",
    "attendance": "quiet",
    "risks": "Respecter les riverains et la signalisation",
    "locationStatus": "to_confirm"
  }'::jsonb,
  'approval@example.com',
  'submitted',
  now(),
  now()
);

insert into public.proposal_photos (
  proposal_id, original_object_path, processed_object_path, display_order,
  rights_declared, metadata_stripped_at
) values
  ('44444444-4444-4444-8444-444444444444', 'approval/original-1.jpg', 'approval/processed-1.webp', 0, true, now()),
  ('44444444-4444-4444-8444-444444444444', 'approval/original-2.jpg', 'approval/processed-2.webp', 1, true, now());

set local role authenticated;
select ok(
  public.admin_review_proposal(
    '44444444-4444-4444-8444-444444444444',
    'approved',
    'Accès et contenu vérifiés',
    'exact',
    true,
    array['spots/test/01.webp', 'spots/test/02.webp'],
    array['https://example.com/01.webp', 'https://example.com/02.webp']
  ) is not null,
  'Une proposition complète peut être publiée atomiquement'
);
select throws_ok(
  $$ select public.admin_review_proposal('44444444-4444-4444-8444-444444444444', 'rejected', 'Seconde décision') $$,
  'P0001',
  'proposal_already_reviewed',
  'Une seconde décision concurrente est refusée'
);
reset role;

select is(
  (select state::text from public.proposals where id = '44444444-4444-4444-8444-444444444444'),
  'approved',
  'La proposition publiée passe à approved'
);
select is(
  (select latitude from public.list_public_spots() where name = 'Spot approuvé par le test'),
  43.55::double precision,
  'Le classement sensible arrondit les coordonnées avant exposition'
);
select is(
  (select count(*) from public.spot_photos sp join public.spots s on s.id = sp.spot_id where s.name = 'Spot approuvé par le test'),
  2::bigint,
  'Les deux variantes publiables sont rattachées à la nouvelle fiche'
);

select * from finish();
rollback;
