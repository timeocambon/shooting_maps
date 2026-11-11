-- Administration mobile (première version) : contrôle d'accès et limitation
-- de fréquence des endpoints /api/admin/mobile/*.
--
-- Migration additive : aucune table ni fonction existante n'est modifiée.
-- Les endpoints appellent cette fonction avec le jeton de la session mobile
-- (rôle `authenticated`, jamais la clé de service) : `auth.uid()` et le
-- niveau `aal` viennent du JWT vérifié par PostgREST. Toutes les données sont
-- ensuite lues avec ce même jeton, donc sous les politiques RLS existantes
-- (`private.is_staff()`).

create table private.admin_mobile_requests (
  user_id uuid not null,
  action text not null check (action in ('read', 'write')),
  created_at timestamptz not null default now()
);

create index admin_mobile_requests_user_idx
  on private.admin_mobile_requests (user_id, action, created_at desc);

alter table private.admin_mobile_requests enable row level security;
revoke all on table private.admin_mobile_requests from public, anon, authenticated;

-- Résultat (texte, jamais d'exception pour un refus, afin que le journal reste
-- écrit) :
--   'moderator' | 'administrator' : accès accordé (rôle de l'équipe) ;
--   'forbidden'    : compte hors équipe (aucune ligne admin_users) ;
--   'mfa_required' : membre de l'équipe dont la session n'est pas en AAL2 ;
--   'rate_limit'   : trop de requêtes (lecture : 60 par minute ; écriture :
--                    10 par 10 minutes, par compte).
create or replace function public.admin_mobile_access(p_action text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  staff_role public.admin_role;
  recent_count integer;
  max_requests integer;
  window_length interval;
begin
  if current_user_id is null then
    return 'forbidden';
  end if;
  if p_action is null or p_action not in ('read', 'write') then
    raise exception 'invalid_action';
  end if;

  select au.role into staff_role
  from public.admin_users au
  where au.user_id = current_user_id;

  if staff_role is null then
    return 'forbidden';
  end if;

  -- Même règle que private.is_staff() : AAL2 obligatoire.
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    return 'mfa_required';
  end if;

  -- Purge du journal de ce compte (au-delà d'une heure, inutile).
  delete from private.admin_mobile_requests r
  where r.user_id = current_user_id
    and r.created_at < now() - interval '1 hour';

  if p_action = 'read' then
    max_requests := 60;
    window_length := interval '1 minute';
  else
    max_requests := 10;
    window_length := interval '10 minutes';
  end if;

  select count(*) into recent_count
  from private.admin_mobile_requests r
  where r.user_id = current_user_id
    and r.action = p_action
    and r.created_at > now() - window_length;

  if recent_count >= max_requests then
    return 'rate_limit';
  end if;

  insert into private.admin_mobile_requests (user_id, action)
  values (current_user_id, p_action);

  return staff_role::text;
end;
$$;

revoke all on function public.admin_mobile_access(text) from public, anon;
grant execute on function public.admin_mobile_access(text) to authenticated;

comment on function public.admin_mobile_access(text) is
  'Administration mobile : rôle (équipe), AAL2 et limitation de fréquence pour la session appelante.';
