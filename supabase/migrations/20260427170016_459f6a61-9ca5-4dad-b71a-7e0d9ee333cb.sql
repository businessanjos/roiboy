CREATE OR REPLACE FUNCTION public.get_clients_without_contracts(p_account_id uuid)
RETURNS TABLE(client_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.clients c
  WHERE c.account_id = p_account_id
    AND NOT EXISTS (
      SELECT 1 FROM public.client_contracts cc
      WHERE cc.client_id = c.id AND cc.account_id = p_account_id
    );
$$;