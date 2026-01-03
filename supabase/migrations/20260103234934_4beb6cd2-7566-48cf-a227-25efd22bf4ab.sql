
-- Function to activate scheduled contracts when start date arrives
CREATE OR REPLACE FUNCTION public.activate_scheduled_contracts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.client_contracts
  SET 
    status = 'active',
    status_changed_at = now(),
    updated_at = now()
  WHERE status = 'scheduled'
    AND start_date <= CURRENT_DATE;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.activate_scheduled_contracts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_scheduled_contracts() TO service_role;
