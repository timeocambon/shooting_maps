-- Règle des dimensions de public.attach_proposal_photo, indépendante de
-- l'orientation (migration 20261103150000_photos_orientation_libre.sql) :
-- grand côté >= 1000 px, petit côté >= 600 px, chaque côté <= 20000 px,
-- dimensions null, nulles ou négatives refusées.
-- À lancer avec Supabase CLI (`npx supabase test db`) ; transaction annulée.

begin;

select plan(23);

-- Structure et droits inchangés ------------------------------------------------
select ok(
  exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = 'public.attach_proposal_photo(uuid, text, text, text, smallint, text, text, integer, integer, integer)'::regprocedure
      and p.prosecdef
  ),
  'attach_proposal_photo garde sa signature et reste security definer'
);
select ok(
  (select p.proconfig from pg_catalog.pg_proc p
    where p.oid = 'public.attach_proposal_photo(uuid, text, text, text, smallint, text, text, integer, integer, integer)'::regprocedure)
  = array['search_path=""'],
  'search_path vide conservé'
);
select ok(
  has_function_privilege('anon', 'public.attach_proposal_photo(uuid, text, text, text, smallint, text, text, integer, integer, integer)', 'execute')
  and has_function_privilege('authenticated', 'public.attach_proposal_photo(uuid, text, text, text, smallint, text, text, integer, integer, integer)', 'execute'),
  'anon et authenticated peuvent toujours l''exécuter'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'public.attach_proposal_photo(uuid, text, text, text, smallint, text, text, integer, integer, integer)'::regprocedure
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ),
  'public n''a toujours pas le droit d''exécution'
);

-- Proposition en attente et objets déjà envoyés ---------------------------------
insert into public.proposals (
  id, tracking_id, payload, contributor_email, state,
  email_verification_token_hash, email_verification_expires_at, upload_secret_hash
) values (
  '55555555-5555-4555-8555-555555555555',
  'SPT-ORIENT0001',
  '{}'::jsonb,
  'orientation@example.com',
  'email_pending',
  encode(extensions.digest('orientation-email-token-for-tests-0123456789', 'sha256'), 'hex'),
  now() + interval '1 hour',
  encode(extensions.digest('orientation-upload-secret', 'sha256'), 'hex')
);

insert into storage.objects (bucket_id, name)
select 'spot-originals',
  'proposals/55555555-5555-4555-8555-555555555555/orientation-upload-secret/' || kind || '-' || i || '.webp'
from generate_series(0, 4) i, unnest(array['original', 'processed']) kind;

set local role anon;

-- Acceptées : verticales comme horizontales ------------------------------------
select lives_ok(
  format(
    $$ select public.attach_proposal_photo(
         '55555555-5555-4555-8555-555555555555', 'orientation-upload-secret',
         'proposals/55555555-5555-4555-8555-555555555555/orientation-upload-secret/original-%1$s.webp',
         'proposals/55555555-5555-4555-8555-555555555555/orientation-upload-secret/processed-%1$s.webp',
         %1$s::smallint, '', 'image/jpeg', 2000000, %2$s, %3$s) $$,
    c.i, c.w, c.h
  ),
  format('%s × %s px acceptée', c.w, c.h)
)
from (values (0, 1600, 900), (1, 900, 1600), (2, 1000, 1000), (3, 600, 1000), (4, 1000, 600)) as c(i, w, h);

-- Refusées -----------------------------------------------------------------------
select throws_ok(
  format(
    $$ select public.attach_proposal_photo(
         '55555555-5555-4555-8555-555555555555', 'orientation-upload-secret',
         'proposals/55555555-5555-4555-8555-555555555555/orientation-upload-secret/original-0.webp',
         'proposals/55555555-5555-4555-8555-555555555555/orientation-upload-secret/processed-0.webp',
         0::smallint, '', 'image/jpeg', %s, %s, %s) $$,
    c.bytes, c.w, c.h
  ),
  'P0001',
  'invalid_photo',
  c.label
)
from (values
  ('2000000', '500', '2000', '500 × 2000 px refusée'),
  ('2000000', '2000', '500', '2000 × 500 px refusée'),
  ('2000000', '800', '800', '800 × 800 px refusée'),
  ('2000000', '999', '600', '999 × 600 px refusée'),
  ('2000000', '1000', '599', '1000 × 599 px refusée'),
  ('2000000', 'null', '1600', 'largeur absente refusée'),
  ('2000000', '1600', 'null', 'hauteur absente refusée'),
  ('2000000', '0', '1600', 'largeur nulle refusée'),
  ('2000000', '-1600', '-900', 'dimensions négatives refusées'),
  ('2000000', '20001', '1000', 'largeur supérieure à 20000 px refusée'),
  ('2000000', '1000', '20001', 'hauteur supérieure à 20000 px refusée'),
  ('15728641', '1600', '900', 'fichier supérieur à 15 Mo refusé')
) as c(bytes, w, h, label);

reset role;

select is(
  (select count(*)::int from public.proposal_photos
    where proposal_id = '55555555-5555-4555-8555-555555555555'),
  5,
  'Seules les 5 photos valides sont rattachées'
);
select is(
  (select array_agg(width || 'x' || height order by display_order) from public.proposal_photos
    where proposal_id = '55555555-5555-4555-8555-555555555555'),
  array['1600x900', '900x1600', '1000x1000', '600x1000', '1000x600'],
  'Les dimensions sont enregistrées telles quelles (orientation conservée)'
);

select * from finish();
rollback;
