create table public.zapp_account_settings (
  account_id uuid primary key,
  ruler_keep_title boolean not null default true,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.zapp_account_settings enable row level security;
grant select, insert, update on public.zapp_account_settings to authenticated;
grant all on public.zapp_account_settings to service_role;

create or replace function public.is_zapp_account_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users u
    where u.auth_user_id = auth.uid()
      and u.account_id = public.get_user_account_id()
      and (u.role in ('admin','super_admin') or u.is_also_admin = true)
  );
$$;

create policy "Account members read zapp settings" on public.zapp_account_settings
  for select to authenticated using (account_id = public.get_user_account_id());
create policy "Admins insert zapp settings" on public.zapp_account_settings
  for insert to authenticated with check (account_id = public.get_user_account_id() and public.is_zapp_account_admin());
create policy "Admins update zapp settings" on public.zapp_account_settings
  for update to authenticated using (account_id = public.get_user_account_id() and public.is_zapp_account_admin())
  with check (account_id = public.get_user_account_id() and public.is_zapp_account_admin());