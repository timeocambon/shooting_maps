-- Photos verticales acceptées comme les horizontales.
--
-- Remplace uniquement public.attach_proposal_photo (même signature, mêmes
-- contrôles de sécurité, même search_path, mêmes droits). Seule la
-- validation des dimensions change :
--   avant : largeur >= 1000 et hauteur >= 600 (favorisait le paysage, et une
--           dimension null n'était pas refusée : « null not between » vaut null) ;
--   après : grand côté >= 1000, petit côté >= 600, chaque côté <= 20000,
--           dimensions null, nulles ou négatives refusées explicitement.
-- La contrainte de table proposal_photos (1 à 20000 par côté) reste inchangée.
-- Migration additive : l'ancienne migration n'est pas modifiée.

create or replace function public.attach_proposal_photo(
  p_proposal_id uuid,
  p_upload_secret text,
  p_original_path text,
  p_processed_path text,
  p_display_order smallint,
  p_credit text,
  p_detected_mime_type text,
  p_byte_size integer,
  p_width integer,
  p_height integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_photo_id uuid;
  expected_prefix text;
begin
  expected_prefix := 'proposals/' || p_proposal_id::text || '/' || p_upload_secret || '/';

  if p_display_order not between 0 and 5
    or p_detected_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or p_byte_size not between 1 and 15728640
    -- Dimensions : absentes, nulles ou négatives refusées explicitement ;
    -- grand côté >= 1000 px et petit côté >= 600 px, quelle que soit
    -- l'orientation ; 20000 px au plus par côté.
    or p_width is null
    or p_height is null
    or p_width <= 0
    or p_height <= 0
    or greatest(p_width, p_height) < 1000
    or least(p_width, p_height) < 600
    or p_width > 20000
    or p_height > 20000
    or p_original_path not like (expected_prefix || 'original-%')
    or p_processed_path not like (expected_prefix || 'processed-%') then
    raise exception 'invalid_photo';
  end if;

  if not exists (
    select 1
    from public.proposals p
    where p.id = p_proposal_id
      and p.state = 'email_pending'
      and p.email_verification_expires_at > now()
      and p.upload_secret_hash = encode(extensions.digest(p_upload_secret, 'sha256'), 'hex')
  ) then
    raise exception 'invalid_capability';
  end if;

  if (select count(*) from public.proposal_photos pp where pp.proposal_id = p_proposal_id) >= 6 then
    raise exception 'too_many_photos';
  end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'spot-originals' and o.name = p_original_path
  ) or not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'spot-originals' and o.name = p_processed_path
  ) then
    raise exception 'missing_object';
  end if;

  insert into public.proposal_photos (
    proposal_id,
    original_object_path,
    processed_object_path,
    display_order,
    credit,
    rights_declared,
    detected_mime_type,
    byte_size,
    width,
    height,
    metadata_stripped_at
  ) values (
    p_proposal_id,
    p_original_path,
    p_processed_path,
    p_display_order,
    nullif(trim(p_credit), ''),
    true,
    p_detected_mime_type,
    p_byte_size,
    p_width,
    p_height,
    now()
  ) returning id into created_photo_id;

  return created_photo_id;
end;
$$;

revoke all on function public.attach_proposal_photo(uuid, text, text, text, smallint, text, text, integer, integer, integer) from public;
grant execute on function public.attach_proposal_photo(uuid, text, text, text, smallint, text, text, integer, integer, integer) to anon, authenticated;
