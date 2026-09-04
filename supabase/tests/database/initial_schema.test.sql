begin;

select plan(10);

select has_extension('postgis', 'PostGIS est installé');
select has_table('public', 'spots', 'La table des spots existe');
select has_table('public', 'proposals', 'La table des propositions existe');
select has_table('public', 'reports', 'La table des signalements existe');
select has_table('public', 'moderation_actions', 'Le journal de modération existe');
select has_function('public', 'list_public_spots', array[]::text[], 'La fonction publique contrôlée existe');
select has_trigger('public', 'spots', 'spots_validate_transition', 'Les transitions de spot sont protégées');
select ok(not has_table_privilege('anon', 'public.spots', 'select'), 'Le rôle public ne peut pas lire les coordonnées brutes');
select is(
  (select latitude from public.list_public_spots() where slug = 'sous-bois-du-canal-demo'),
  43.55::double precision,
  'La latitude sensible est arrondie avant exposition'
);
select is(
  (select count(*)::integer from public.list_public_spots()),
  3,
  'Les trois fiches publiables de démonstration sont exposées'
);

select * from finish();
rollback;
