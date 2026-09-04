create policy "staff append audit log"
on public.moderation_actions
for insert
to authenticated
with check (private.is_staff() and actor_user_id = auth.uid());

grant insert on public.moderation_actions to authenticated;

