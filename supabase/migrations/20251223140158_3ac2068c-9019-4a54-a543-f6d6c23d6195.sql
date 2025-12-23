-- Update the create_default_team_roles function to include Mentor
CREATE OR REPLACE FUNCTION public.create_default_team_roles()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert default roles for the new account
  INSERT INTO public.team_roles (account_id, name, description, color, is_system, display_order)
  VALUES
    (NEW.id, 'Admin', 'Acesso total ao sistema', '#ef4444', true, 1),
    (NEW.id, 'Head', 'Líder de área', '#ec4899', true, 2),
    (NEW.id, 'Gestor', 'Gestão de equipe', '#06b6d4', true, 3),
    (NEW.id, 'Mentor', 'Mentoria e desenvolvimento', '#6366f1', true, 4),
    (NEW.id, 'Consultor', 'Consultoria e atendimento', '#f97316', true, 5),
    (NEW.id, 'CX', 'Customer Experience', '#22c55e', true, 6),
    (NEW.id, 'CS', 'Customer Success', '#a855f7', true, 7);
  
  -- Add default permissions for Admin role
  INSERT INTO public.role_permissions (role_id, permission)
  SELECT r.id, p.permission
  FROM public.team_roles r,
  UNNEST(ARRAY['clients.view', 'clients.edit', 'clients.delete', 'team.view', 'team.edit', 'settings.view', 'settings.edit', 'reports.view', 'events.view', 'events.edit', 'forms.view', 'forms.edit', 'products.view', 'products.edit']) AS p(permission)
  WHERE r.account_id = NEW.id AND r.name = 'Admin';

  -- Add default permissions for other roles
  INSERT INTO public.role_permissions (role_id, permission)
  SELECT r.id, p.permission
  FROM public.team_roles r,
  UNNEST(ARRAY['clients.view', 'clients.edit', 'team.view', 'reports.view', 'events.view', 'forms.view', 'products.view']) AS p(permission)
  WHERE r.account_id = NEW.id AND r.name IN ('Head', 'Gestor', 'Mentor');

  INSERT INTO public.role_permissions (role_id, permission)
  SELECT r.id, p.permission
  FROM public.team_roles r,
  UNNEST(ARRAY['clients.view', 'clients.edit', 'reports.view', 'events.view', 'forms.view']) AS p(permission)
  WHERE r.account_id = NEW.id AND r.name IN ('Consultor', 'CX', 'CS');

  RETURN NEW;
END;
$function$;