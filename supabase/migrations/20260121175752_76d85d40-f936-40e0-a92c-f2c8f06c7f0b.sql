-- Add sync_data column to client_relationships table
ALTER TABLE client_relationships 
ADD COLUMN IF NOT EXISTS sync_data BOOLEAN NOT NULL DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN client_relationships.sync_data IS 'When true, data from both clients will be shown in each other profiles (timeline, deals, contracts, events, etc.)';

-- Create helper function to get all synced client IDs for a given client
CREATE OR REPLACE FUNCTION get_synced_client_ids(p_client_id UUID)
RETURNS UUID[] AS $$
DECLARE
  result UUID[];
BEGIN
  -- Get all clients linked with sync_data = true
  SELECT ARRAY_AGG(DISTINCT linked_id) INTO result
  FROM (
    SELECT related_client_id AS linked_id
    FROM client_relationships
    WHERE primary_client_id = p_client_id 
      AND sync_data = true 
      AND is_active = true
    UNION
    SELECT primary_client_id AS linked_id
    FROM client_relationships
    WHERE related_client_id = p_client_id 
      AND sync_data = true 
      AND is_active = true
  ) sub;
  
  -- Always include the original client, concatenate with linked ones
  RETURN ARRAY[p_client_id] || COALESCE(result, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_synced_client_ids(UUID) TO authenticated;