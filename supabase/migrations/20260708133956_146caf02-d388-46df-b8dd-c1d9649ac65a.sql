CREATE OR REPLACE FUNCTION public.get_dashboard_contract_counts(p_account_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'active', COUNT(DISTINCT client_id) FILTER (WHERE status = 'active'),
    'cancelled', COUNT(DISTINCT client_id) FILTER (WHERE status = 'cancelled'),
    'ended', COUNT(DISTINCT client_id) FILTER (WHERE status = 'ended'),
    'suspended', COUNT(DISTINCT client_id) FILTER (WHERE status = 'suspended'),
    'paused', COUNT(DISTINCT client_id) FILTER (WHERE status = 'paused'),
    'expired', COUNT(DISTINCT client_id) FILTER (WHERE status = 'active' AND end_date IS NOT NULL AND end_date < CURRENT_DATE),
    'total_clients', COUNT(DISTINCT client_id)
  ) INTO result
  FROM public.client_contracts
  WHERE account_id = p_account_id;

  RETURN result;
END;
$function$;