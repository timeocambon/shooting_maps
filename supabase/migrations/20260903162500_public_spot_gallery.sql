drop function public.list_public_spots();

create function public.list_public_spots()
returns table (
  id uuid,
  slug text,
  name text,
  municipality text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  display_precision public.display_precision,
  short_description text,
  categories text[],
  best_times text[],
  access_level text,
  surface_type text,
  attendance text,
  location_status text,
  warnings text[],
  parking text,
  walking_approach text,
  light_orientation text,
  last_verified_at date,
  cover_image_url text,
  photo_urls text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.slug,
    s.name,
    s.municipality,
    s.postal_code,
    case when s.display_precision = 'approximate' or s.publication_state = 'sensitive'
      then round(extensions.st_y(s.location::extensions.geometry)::numeric, 2)::double precision
      else extensions.st_y(s.location::extensions.geometry)
    end as latitude,
    case when s.display_precision = 'approximate' or s.publication_state = 'sensitive'
      then round(extensions.st_x(s.location::extensions.geometry)::numeric, 2)::double precision
      else extensions.st_x(s.location::extensions.geometry)
    end as longitude,
    case when s.publication_state = 'sensitive' then 'approximate'::public.display_precision else s.display_precision end,
    s.short_description,
    coalesce((select array_agg(c.slug order by c.sort_order, c.label) from public.spot_categories sc join public.categories c on c.id = sc.category_id where sc.spot_id = s.id and c.is_active), '{}'::text[]),
    s.best_times::text[],
    s.access_level::text,
    s.surface_type::text,
    s.attendance::text,
    s.location_status::text,
    s.warnings,
    s.parking,
    s.walking_approach,
    s.light_orientation,
    s.last_verified_at,
    (select p.public_url from public.spot_photos p where p.spot_id = s.id and p.moderation_state = 'approved' and p.removed_at is null order by p.display_order limit 1),
    coalesce((select array_agg(p.public_url order by p.display_order) from public.spot_photos p where p.spot_id = s.id and p.moderation_state = 'approved' and p.removed_at is null and p.public_url is not null), '{}'::text[])
  from public.spots s
  where s.publication_state in ('published', 'sensitive', 'review_due')
    and s.display_precision <> 'hidden'
  order by s.name;
$$;

revoke all on function public.list_public_spots() from public;
grant execute on function public.list_public_spots() to anon, authenticated;
