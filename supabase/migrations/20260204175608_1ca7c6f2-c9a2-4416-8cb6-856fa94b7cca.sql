-- Função para obter contagens de status de contratos por account_id
CREATE OR REPLACE FUNCTION get_dashboard_contract_counts(p_account_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'active', COUNT(*) FILTER (WHERE status = 'active'),
    'cancelled', COUNT(*) FILTER (WHERE status = 'cancelled'),
    'ended', COUNT(*) FILTER (WHERE status = 'ended'),
    'suspended', COUNT(*) FILTER (WHERE status = 'suspended'),
    'paused', COUNT(*) FILTER (WHERE status = 'paused'),
    'total_clients', COUNT(DISTINCT client_id)
  ) INTO result
  FROM public.client_contracts
  WHERE account_id = p_account_id;
  
  RETURN result;
END;
$$;