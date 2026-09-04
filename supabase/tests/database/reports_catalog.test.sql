begin;

select plan(23);

select has_function('public', 'create_public_report', array['uuid', 'text', 'text', 'text', 'text'], 'La création publique de signalement existe');
select has_function('public', 'admin_review_report', array['uuid', 'text', 'text', 'text', 'boolean'], 'Le traitement atomique des signalements existe');
select has_function('public', 'admin_update_spot', array['uuid', 'text', 'double precision', 'double precision', 'text', 'text', 'text', 'text[]', 'text[]', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text[]', 'boolean'], 'La modification contrôlée du catalogue existe');
select has_function('public', 'admin_change_spot_state', array['uuid', 'text', 'text'], 'Le changement d’état contrôlé existe');
select has_trigger('public', 'reports', 'reports_validate_transition', 'Les transitions de signalement sont protégées');
select ok(not has_table_privilege('anon', 'public.reports', 'select'), 'Le public ne peut pas lire les signalements');

set local role anon;
select lives_ok(
  $$ select public.create_public_report(
    'e14e0530-37f6-4e32-926a-56f4f8e6ac31',
    'immediate_danger',
    'Une barrière métallique bloque dangereusement le passage.',
    null,
    null
  ) $$,
  'Un visiteur peut signaler un danger sans compte'
);
select throws_ok(
  $$ select public.create_public_report(
    'e14e0530-37f6-4e32-926a-56f4f8e6ac31',
    'image_or_identifiable_person',
    'Une personne reconnaissable apparaît sur la première image.',
    null,
    null
  ) $$,
  'P0001',
  'email_required',
  'Un contact est exigé pour une demande liée à une personne'
);
reset role;

select is(
  (select priority::text from public.reports where comment like 'Une barrière métallique%'),
  'high',
  'Le danger est automatiquement prioritaire'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '77777777-7777-4777-8777-777777777777',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'catalog-moderator@example.com',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.admin_users (user_id, role, display_name)
values ('77777777-7777-4777-8777-777777777777', 'moderator', 'Catalogue test');

select set_config('request.jwt.claims', '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;

select is(
  public.admin_review_report(
    (select id from public.reports where comment like 'Une barrière métallique%'),
    'in_review',
    '',
    'Contrôle de sécurité lancé',
    true
  ),
  'e14e0530-37f6-4e32-926a-56f4f8e6ac31'::uuid,
  'Le modérateur prend en charge et masque la fiche dans la même opération'
);

select is(
  (select state::text from public.reports where comment like 'Une barrière métallique%'),
  'in_review',
  'Le signalement passe en cours de traitement'
);
select is(
  (select publication_state::text from public.spots where id = 'e14e0530-37f6-4e32-926a-56f4f8e6ac31'),
  'hidden',
  'La fiche critique est masquée immédiatement'
);
select is(
  (select count(*) from public.list_public_spots() where id = 'e14e0530-37f6-4e32-926a-56f4f8e6ac31'),
  0::bigint,
  'La fiche masquée disparaît de l’exposition publique'
);

select lives_ok(
  $$ select public.admin_review_report(
    (select id from public.reports where comment like 'Une barrière métallique%'),
    'resolved',
    'Accès condamné, la fiche reste masquée.',
    'Vérification terminée',
    false
  ) $$,
  'Le signalement pris en charge peut être résolu'
);
select throws_ok(
  $$ select public.admin_review_report(
    (select id from public.reports where comment like 'Une barrière métallique%'),
    'dismissed',
    'Seconde décision',
    '',
    false
  ) $$,
  'P0001',
  'report_already_reviewed',
  'Une seconde décision définitive est refusée'
);

select is(
  public.admin_update_spot(
    'b60fd0db-86af-4814-bc2b-8c9cb714ed79',
    'Halle aux briques rouges vérifiée',
    43.6354,
    1.3895,
    'Blagnac',
    '31700',
    'Une description mise à jour et suffisamment longue pour rester publiable.',
    array['architecture', 'industrial'],
    array['morning', 'golden_hour'],
    'Façade orientée est.',
    'easy',
    'Stationnement autorisé à proximité.',
    'Accès de plain-pied depuis le parking.',
    'asphalt',
    'quiet',
    'public',
    'exact',
    array['Respecter les activités voisines.'],
    true
  ),
  'halle-briques-rouges-demo',
  'Une fiche complète peut être modifiée sans changer son URL'
);
select is(
  (select name from public.spots where id = 'b60fd0db-86af-4814-bc2b-8c9cb714ed79'),
  'Halle aux briques rouges vérifiée',
  'Le contenu corrigé est persisté'
);

select is(
  public.admin_change_spot_state(
    'b60fd0db-86af-4814-bc2b-8c9cb714ed79',
    'archived',
    'Lieu fermé durablement'
  ),
  'halle-briques-rouges-demo',
  'Une fiche peut être archivée'
);
select is(
  (select publication_state from public.get_public_spot_unavailability('halle-briques-rouges-demo')),
  'archived',
  'L’URL archivée expose seulement un état explicatif'
);
select is(
  public.admin_change_spot_state(
    'b60fd0db-86af-4814-bc2b-8c9cb714ed79',
    'published',
    'Accès de nouveau confirmé'
  ),
  'halle-briques-rouges-demo',
  'Une fiche archivée peut être restaurée'
);
select is(
  (select count(*) from public.list_public_spots() where slug = 'halle-briques-rouges-demo'),
  1::bigint,
  'La fiche restaurée revient dans le catalogue public'
);

update public.spots
set last_verified_at = current_date - interval '13 months'
where id = '932a4c64-4952-44df-b465-9a053352d1a3';

select is(
  public.admin_refresh_review_due_spots(),
  1,
  'Le contrôle de maintenance détecte une fiche vieille de douze mois'
);
select is(
  (select publication_state::text from public.spots where id = '932a4c64-4952-44df-b465-9a053352d1a3'),
  'review_due',
  'La fiche ancienne passe automatiquement à revérifier'
);

reset role;

select * from finish();
rollback;
