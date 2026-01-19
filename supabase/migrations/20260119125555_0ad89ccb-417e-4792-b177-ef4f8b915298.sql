-- Fix security warning: Set search_path for the refresh function
CREATE OR REPLACE FUNCTION public.refresh_client_latest_metrics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY client_latest_metrics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix security warning: Revoke public API access to materialized view
-- The view should only be accessed via edge functions with service role key
REVOKE SELECT ON client_latest_metrics FROM anon;

-- Keep access for authenticated users through edge functions
REVOKE SELECT ON client_latest_metrics FROM authenticated;