-- Fix search_path security issue for get_synced_client_ids function
CREATE OR REPLACE FUNCTION get_synced_client_ids(p_client_id UUID)
RETURNS UUID[] AS $$
DECLARE
  result UUID[];
BEGIN
  -- Get all clients linked with sync_data = true
  SELECT ARRAY_AGG(DISTINCT linked_id) INTO result
  FROM (
    SELECT related_client_id AS linked_id
    FROM public.client_relationships
    WHERE primary_client_id = p_client_id 
      AND sync_data = true 
      AND is_active = true
    UNION
    SELECT primary_client_id AS linked_id
    FROM public.client_relationships
    WHERE related_client_id = p_client_id 
      AND sync_data = true 
      AND is_active = true
  ) sub;
  
  -- Always include the original client, concatenate with linked ones
  RETURN ARRAY[p_client_id] || COALESCE(result, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;