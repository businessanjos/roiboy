-- Create super_admins table for platform-level admin access
CREATE TABLE public.super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.super_admins
    WHERE user_id = _user_id
  )
$$;

-- Super admins can view super_admins table
CREATE POLICY "Super admins can view super_admins"
ON public.super_admins
FOR SELECT
USING (public.is_super_admin());

-- Super admins can manage super_admins
CREATE POLICY "Super admins can manage super_admins"
ON public.super_admins
FOR ALL
USING (public.is_super_admin());

-- Create subscription_plans table
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  billing_period text NOT NULL DEFAULT 'monthly',
  trial_days integer DEFAULT 0,
  max_clients integer,
  max_users integer,
  max_ai_analyses integer,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on subscription_plans
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Anyone can view active plans
CREATE POLICY "Anyone can view active plans"
ON public.subscription_plans
FOR SELECT
USING (is_active = true OR public.is_super_admin());

-- Only super admins can manage plans
CREATE POLICY "Super admins can manage plans"
ON public.subscription_plans
FOR ALL
USING (public.is_super_admin());

-- Add plan_id to accounts table
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.subscription_plans(id);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS trial_ends_at timestamp with time zone;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trial';

-- Super admins can view all accounts
CREATE POLICY "Super admins can view all accounts"
ON public.accounts
FOR SELECT
USING (public.is_super_admin());

-- Super admins can update all accounts
CREATE POLICY "Super admins can update all accounts"
ON public.accounts
FOR UPDATE
USING (public.is_super_admin());

-- Super admins can view all users
CREATE POLICY "Super admins can view all users"
ON public.users
FOR SELECT
USING (public.is_super_admin());

-- Super admins can update all users
CREATE POLICY "Super admins can update all users"
ON public.users
FOR UPDATE
USING (public.is_super_admin());

-- Trigger for updated_at on subscription_plans
CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();