insert into public.categories (slug, label, sort_order)
values
  ('urban', 'Urbain', 10),
  ('industrial', 'Industriel', 20),
  ('architecture', 'Architecture', 30),
  ('nature', 'Nature', 40),
  ('panorama', 'Panorama', 50),
  ('graffiti', 'Graffiti', 60)
on conflict (slug) do update set label = excluded.label, sort_order = excluded.sort_order;

insert into public.spots (
  id, slug, name, location, display_precision, municipality, postal_code,
  short_description, best_times, light_orientation, access_level, parking,
  walking_approach, surface_type, attendance, location_status, warnings,
  publication_state, last_verified_at
)
values
  (
    'e14e0530-37f6-4e32-926a-56f4f8e6ac31',
    'belvedere-des-coteaux-demo',
    'Belvédère des coteaux — démo',
    extensions.st_setsrid(extensions.st_makepoint(1.4746, 43.5868), 4326)::extensions.geography,
    'exact', 'Toulouse', '31400',
    'Une vue dégagée et une lumière latérale douce pour tester le parcours de découverte.',
    array['golden_hour', 'sunset']::public.best_time[],
    'Lumière latérale en fin de journée.', 'easy',
    'Information à confirmer lors de la modération.',
    'Moins de cinq minutes dans ce scénario de test.', 'asphalt', 'variable',
    'public', array['Fiche fictive destinée au développement : ne pas utiliser comme itinéraire réel.'],
    'published', '2026-09-01'
  ),
  (
    'b60fd0db-86af-4814-bc2b-8c9cb714ed79',
    'halle-briques-rouges-demo',
    'Halle aux briques rouges — démo',
    extensions.st_setsrid(extensions.st_makepoint(1.3895, 43.6354), 4326)::extensions.geography,
    'exact', 'Blagnac', '31700',
    'Un décor architectural chaud imaginé pour valider filtres, galerie et contraste des cartes.',
    array['morning', 'golden_hour']::public.best_time[],
    'Façade orientée est dans le scénario de test.', 'easy',
    'Zone de stationnement fictive à confirmer.',
    'Accès de plain-pied dans le scénario de test.', 'asphalt', 'quiet',
    'to_confirm', array['Fiche fictive : accès et statut à vérifier avant toute publication réelle.'],
    'published', '2026-09-01'
  ),
  (
    '932a4c64-4952-44df-b465-9a053352d1a3',
    'sous-bois-du-canal-demo',
    'Sous-bois du canal — démo',
    extensions.st_setsrid(extensions.st_makepoint(1.4782, 43.5477), 4326)::extensions.geography,
    'approximate', 'Ramonville-Saint-Agne', '31520',
    'Une zone ombragée fictive utilisée pour contrôler l''affichage d''une position approximative.',
    array['morning', 'day']::public.best_time[], null, 'intermediate',
    'Stationnement éloigné dans le scénario de test.',
    'Approche à pied fictive de dix minutes.', 'mixed', 'variable',
    'sensitive', array['Position volontairement approximative.', 'Fiche fictive destinée exclusivement au développement.'],
    'sensitive', '2026-09-01'
  )
on conflict (id) do nothing;

insert into public.spot_categories (spot_id, category_id)
select values_to_insert.spot_id, categories.id
from (
  values
    ('e14e0530-37f6-4e32-926a-56f4f8e6ac31'::uuid, 'panorama'),
    ('e14e0530-37f6-4e32-926a-56f4f8e6ac31'::uuid, 'nature'),
    ('b60fd0db-86af-4814-bc2b-8c9cb714ed79'::uuid, 'architecture'),
    ('b60fd0db-86af-4814-bc2b-8c9cb714ed79'::uuid, 'industrial'),
    ('932a4c64-4952-44df-b465-9a053352d1a3'::uuid, 'nature')
) as values_to_insert(spot_id, category_slug)
join public.categories on categories.slug = values_to_insert.category_slug
on conflict do nothing;
