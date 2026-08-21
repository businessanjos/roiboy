
INSERT INTO public.users (auth_user_id, account_id, name, email, role, team_role_id, is_also_admin)
VALUES ('fa9c1d3e-c9b9-446e-a9a2-ffd291d7c118', '796e7970-fd93-4574-a871-6090624cace6', 'Lincoln Ricardo', 'videomaker@anjosbusiness.com.br', 'member', '46888c49-a60b-4b3b-95b0-9b37457307ca', false);

INSERT INTO public.user_team_roles (user_id, team_role_id)
SELECT u.id, '46888c49-a60b-4b3b-95b0-9b37457307ca'
FROM public.users u WHERE u.auth_user_id = 'fa9c1d3e-c9b9-446e-a9a2-ffd291d7c118';

INSERT INTO public.user_sector_access (user_id, account_id, sector_id, role_in_sector, is_active)
SELECT u.id, u.account_id, 'marketing', 'member', true
FROM public.users u WHERE u.auth_user_id = 'fa9c1d3e-c9b9-446e-a9a2-ffd291d7c118';
