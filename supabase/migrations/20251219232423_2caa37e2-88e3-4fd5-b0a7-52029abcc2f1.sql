-- Create table to track add-ons per account
CREATE TABLE public.account_addons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  addon_plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quantity_positive CHECK (quantity > 0)
);

-- Create unique constraint for account + addon combination
CREATE UNIQUE INDEX account_addons_unique ON public.account_addons(account_id, addon_plan_id) WHERE status = 'active';

-- Enable RLS
ALTER TABLE public.account_addons ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Super admins can manage account_addons"
ON public.account_addons FOR ALL
USING (is_super_admin());

CREATE POLICY "Users can view their account addons"
ON public.account_addons FOR SELECT
USING (account_id = get_user_account_id());

-- Trigger for updated_at
CREATE TRIGGER update_account_addons_updated_at
BEFORE UPDATE ON public.account_addons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update get_account_limits function to include add-ons
CREATE OR REPLACE FUNCTION public.get_account_limits()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_account_id uuid;
  v_plan_id uuid;
  v_limits jsonb;
  v_usage jsonb;
  v_plan_record record;
  v_clients_count integer;
  v_users_count integer;
  v_events_count integer;
  v_products_count integer;
  v_forms_count integer;
  v_ai_analyses_count integer;
  v_additional_users integer;
BEGIN
  -- Get account_id from current user
  SELECT account_id INTO v_account_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
  
  IF v_account_id IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;
  
  -- Get plan_id from account
  SELECT plan_id INTO v_plan_id FROM public.accounts WHERE id = v_account_id;
  
  -- Get plan limits
  IF v_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan_record FROM public.subscription_plans WHERE id = v_plan_id;
  END IF;
  
  -- Calculate additional users from add-ons
  SELECT COALESCE(SUM(aa.quantity * sp.max_users), 0) INTO v_additional_users
  FROM public.account_addons aa
  JOIN public.subscription_plans sp ON sp.id = aa.addon_plan_id
  WHERE aa.account_id = v_account_id 
    AND aa.status = 'active'
    AND sp.plan_type = 'addon';
  
  -- Count current usage
  SELECT COUNT(*) INTO v_clients_count FROM public.clients WHERE account_id = v_account_id;
  SELECT COUNT(*) INTO v_users_count FROM public.users WHERE account_id = v_account_id;
  SELECT COUNT(*) INTO v_events_count FROM public.events WHERE account_id = v_account_id;
  SELECT COUNT(*) INTO v_products_count FROM public.products WHERE account_id = v_account_id;
  SELECT COUNT(*) INTO v_forms_count FROM public.forms WHERE account_id = v_account_id;
  
  -- Count AI analyses this month
  SELECT COUNT(*) INTO v_ai_analyses_count 
  FROM public.ai_usage_logs 
  WHERE account_id = v_account_id 
    AND created_at >= date_trunc('month', now());
  
  -- Build limits object (null means unlimited for trial)
  -- max_users now includes base plan + additional users from add-ons
  v_limits := jsonb_build_object(
    'max_clients', COALESCE(v_plan_record.max_clients, 50),
    'max_users', COALESCE(v_plan_record.max_users, 3) + v_additional_users,
    'max_events', COALESCE(v_plan_record.max_events, 10),
    'max_products', COALESCE(v_plan_record.max_products, 20),
    'max_forms', COALESCE(v_plan_record.max_forms, 5),
    'max_ai_analyses', COALESCE(v_plan_record.max_ai_analyses, 100),
    'max_storage_mb', COALESCE(v_plan_record.max_storage_mb, 500)
  );
  
  -- Build usage object
  v_usage := jsonb_build_object(
    'clients', v_clients_count,
    'users', v_users_count,
    'events', v_events_count,
    'products', v_products_count,
    'forms', v_forms_count,
    'ai_analyses', v_ai_analyses_count
  );
  
  RETURN jsonb_build_object(
    'account_id', v_account_id,
    'plan_id', v_plan_id,
    'plan_name', COALESCE(v_plan_record.name, 'Trial'),
    'limits', v_limits,
    'usage', v_usage,
    'features', COALESCE(v_plan_record.features, '{}'::jsonb),
    'additional_users', v_additional_users
  );
END;
$function$;