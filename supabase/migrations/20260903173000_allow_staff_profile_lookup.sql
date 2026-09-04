-- A signed-in administrator must be able to read only their own role record.
-- The application still requires AAL2 before granting access to administration.
drop policy "staff read own profile" on public.admin_users;

create policy "users read own staff profile"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid());
