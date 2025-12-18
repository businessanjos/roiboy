-- Create table for custom team roles per account
CREATE TABLE public.team_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',
  is_system BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_id, name)
);

-- Create table for role permissions
CREATE TABLE public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id UUID NOT NULL REFERENCES public.team_roles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission)
);

-- Add team_role_id to users table
ALTER TABLE public.users ADD COLUMN team_role_id UUID REFERENCES public.team_roles(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.team_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for team_roles
CREATE POLICY "Users can view team roles in their account"
  ON public.team_roles FOR SELECT
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert team roles in their account"
  ON public.team_roles FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update team roles in their account"
  ON public.team_roles FOR UPDATE
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete team roles in their account"
  ON public.team_roles FOR DELETE
  USING (account_id = get_user_account_id() AND is_system = false);

-- RLS policies for role_permissions
CREATE POLICY "Users can view role permissions in their account"
  ON public.role_permissions FOR SELECT
  USING (role_id IN (SELECT id FROM public.team_roles WHERE account_id = get_user_account_id()));

CREATE POLICY "Users can insert role permissions in their account"
  ON public.role_permissions FOR INSERT
  WITH CHECK (role_id IN (SELECT id FROM public.team_roles WHERE account_id = get_user_account_id()));

CREATE POLICY "Users can delete role permissions in their account"
  ON public.role_permissions FOR DELETE
  USING (role_id IN (SELECT id FROM public.team_roles WHERE account_id = get_user_account_id()));

-- Trigger for updated_at
CREATE TRIGGER update_team_roles_updated_at
  BEFORE UPDATE ON public.team_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create default roles function for new accounts
CREATE OR REPLACE FUNCTION public.create_default_team_roles()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default roles for the new account
  INSERT INTO public.team_roles (account_id, name, description, color, is_system, display_order)
  VALUES
    (NEW.id, 'Admin', 'Acesso total ao sistema', '#ef4444', true, 1),
    (NEW.id, 'Head', 'Líder de área', '#ec4899', true, 2),
    (NEW.id, 'Gestor', 'Gestão de equipe', '#06b6d4', true, 3),
    (NEW.id, 'Consultor', 'Consultoria e atendimento', '#f97316', true, 4),
    (NEW.id, 'CX', 'Customer Experience', '#22c55e', true, 5),
    (NEW.id, 'CS', 'Customer Success', '#a855f7', true, 6);
  
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
  WHERE r.account_id = NEW.id AND r.name IN ('Head', 'Gestor');

  INSERT INTO public.role_permissions (role_id, permission)
  SELECT r.id, p.permission
  FROM public.team_roles r,
  UNNEST(ARRAY['clients.view', 'clients.edit', 'reports.view', 'events.view', 'forms.view']) AS p(permission)
  WHERE r.account_id = NEW.id AND r.name IN ('Consultor', 'CX', 'CS');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create default roles when account is created
CREATE TRIGGER on_account_created_create_roles
  AFTER INSERT ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.create_default_team_roles();