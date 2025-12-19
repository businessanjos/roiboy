-- Add additional limit columns to subscription_plans
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS max_events integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_products integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_forms integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_storage_mb integer DEFAULT NULL;

-- Create a function to get current account limits with usage
CREATE OR REPLACE FUNCTION public.get_account_limits()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_limits := jsonb_build_object(
    'max_clients', COALESCE(v_plan_record.max_clients, 50), -- Default trial limit
    'max_users', COALESCE(v_plan_record.max_users, 3),
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
    'features', COALESCE(v_plan_record.features, '{}'::jsonb)
  );
END;
$$;