begin;

select plan(11);

select has_function('public', 'admin_correct_proposal', array['uuid', 'text', 'text', 'double precision', 'double precision', 'text', 'text', 'text', 'text[]', 'text', 'text[]', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text'], 'La correction contrôlée d''une proposition existe');
select has_function('public', 'admin_set_proposal_photo_state', array['uuid', 'text'], 'Le contrôle photo par photo existe');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '55555555-5555-4555-8555-555555555555',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'reviewer@example.com',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.admin_users (user_id, role, display_name)
values ('55555555-5555-4555-8555-555555555555', 'moderator', 'Modérateur revue');

insert into public.proposals (
  id, tracking_id, payload, contributor_email, state, email_verified_at, submitted_at
) values (
  '66666666-6666-4666-8666-666666666666',
  'SPT-CORRECT01',
  '{
    "address": "1 impasse Faute, 31000 Toulouse",
    "latitude": 43.6,
    "longitude": 1.44,
    "municipality": "Toulousee",
    "postalCode": "31000",
    "displayPrecision": "exact",
    "accessWithoutTrespass": true,
    "name": "Spot a corriger",
    "categories": ["nature"],
    "shortDescription": "Une description suffisamment longue pour la correction du test.",
    "bestTimes": ["morning"],
    "visualFeatures": "",
    "accessLevel": "easy",
    "parking": "Parking proche",
    "walkingApproach": "Deux minutes a pied",
    "surfaceType": "asphalt",
    "traffic": "Faible",
    "attendance": "quiet",
    "risks": "Respecter les riverains et la signalisation",
    "locationStatus": "to_confirm"
  }'::jsonb,
  'correction@example.com',
  'submitted',
  now(),
  now()
);

insert into public.proposal_photos (
  id, proposal_id, original_object_path, processed_object_path, display_order,
  rights_declared, metadata_stripped_at
) values
  ('77777777-7777-4777-8777-777777777777', '66666666-6666-4666-8666-666666666666', 'review/original-1.jpg', 'review/processed-1.webp', 0, true, now()),
  ('88888888-8888-4888-8888-888888888888', '66666666-6666-4666-8666-666666666666', 'review/original-2.jpg', 'review/processed-2.webp', 1, true, now()),
  ('99999999-9999-4999-8999-999999999999', '66666666-6666-4666-8666-666666666666', 'review/original-3.jpg', 'review/processed-3.webp', 2, true, now());

select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

select ok(
  public.admin_correct_proposal(
    '66666666-6666-4666-8666-666666666666',
    'Spot corrige',
    '1 impasse Corrigee, 31000 Toulouse',
    43.6045, 1.4442,
    'Toulouse', '31000', 'exact',
    array['nature'], 'Une description corrigee suffisamment longue pour le test.',
    array['morning'], '', 'easy', 'Parking proche', 'Deux minutes a pied',
    'asphalt', 'Faible', 'quiet', 'Respecter les riverains et la signalisation',
    'to_confirm', 'Faute corrigee'
  ) is not null,
  'Un membre du staff peut corriger une proposition soumise'
);
select is(
  (select payload ->> 'name' from public.proposals where id = '66666666-6666-4666-8666-666666666666'),
  'Spot corrige',
  'Le contenu corrigé remplace le contenu initial'
);
select is(
  (select payload ->> 'municipality' from public.proposals where id = '66666666-6666-4666-8666-666666666666'),
  'Toulouse',
  'La faute de commune est corrigée'
);

select ok(
  public.admin_set_proposal_photo_state('77777777-7777-4777-8777-777777777777', 'rejected') is not null,
  'Une photo individuelle peut être exclue'
);
select is(
  (select moderation_state::text from public.proposal_photos where id = '77777777-7777-4777-8777-777777777777'),
  'rejected',
  'La photo exclue est marquée rejected'
);

select ok(
  public.admin_review_proposal(
    '66666666-6666-4666-8666-666666666666',
    'approved',
    'Contenu vérifié après correction',
    'exact',
    false,
    array['spots/test-review/01.webp', 'spots/test-review/02.webp'],
    array['https://example.com/review-01.webp', 'https://example.com/review-02.webp']
  ) is not null,
  'La proposition corrigée, avec une photo exclue, peut être publiée avec les photos restantes'
);
select is(
  (select count(*) from public.spot_photos sp join public.spots s on s.id = sp.spot_id where s.name = 'Spot corrige'),
  2::bigint,
  'Seules les photos non exclues sont publiées'
);
select is(
  (select moderation_state::text from public.proposal_photos where id = '77777777-7777-4777-8777-777777777777'),
  'rejected',
  'La photo exclue reste rejected après la publication, jamais réécrite en approved'
);
select is(
  (select moderation_state::text from public.proposal_photos where id = '88888888-8888-4888-8888-888888888888'),
  'approved',
  'Les photos publiées passent à approved'
);

reset role;

select * from finish();
rollback;
