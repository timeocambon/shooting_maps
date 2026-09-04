create or replace function private.may_remove_proposal_object(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folders text[];
begin
  folders := storage.foldername(p_object_name);

  if array_length(folders, 1) <> 3 or folders[1] <> 'proposals' then
    return false;
  end if;

  return exists (
    select 1
    from public.proposals p
    where p.id::text = folders[2]
      and p.state = 'email_pending'
      and p.confirmation_sent_at is null
      and p.upload_secret_hash = encode(extensions.digest(folders[3], 'sha256'), 'hex')
  );
end;
$$;

revoke all on function private.may_remove_proposal_object(text) from public;
grant execute on function private.may_remove_proposal_object(text) to anon, authenticated;

create policy "proposal capability cleanup"
on storage.objects
for delete
to anon, authenticated
using (
  bucket_id = 'spot-originals'
  and private.may_remove_proposal_object(name)
);

create or replace function public.abandon_public_proposal(
  p_proposal_id uuid,
  p_upload_secret text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.proposals p
  where p.id = p_proposal_id
    and p.state = 'email_pending'
    and p.confirmation_sent_at is null
    and p.upload_secret_hash = encode(extensions.digest(p_upload_secret, 'sha256'), 'hex');

  return found;
end;
$$;

revoke all on function public.abandon_public_proposal(uuid, text) from public;
grant execute on function public.abandon_public_proposal(uuid, text) to anon, authenticated;
