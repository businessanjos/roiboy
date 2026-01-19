-- Create materialized view for pre-aggregated client metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS client_latest_metrics AS
SELECT 
  c.id as client_id,
  c.account_id,
  -- Latest V-NPS
  (SELECT jsonb_build_object(
    'vnps_score', vs.vnps_score, 
    'vnps_class', vs.vnps_class, 
    'trend', vs.trend,
    'computed_at', vs.computed_at
  )
   FROM vnps_snapshots vs 
   WHERE vs.client_id = c.id 
   ORDER BY vs.computed_at DESC 
   LIMIT 1) as vnps,
  -- Latest Score
  (SELECT jsonb_build_object(
    'escore', ss.escore, 
    'roizometer', ss.roizometer, 
    'quadrant', ss.quadrant, 
    'trend', ss.trend,
    'computed_at', ss.computed_at
  )
   FROM score_snapshots ss 
   WHERE ss.client_id = c.id 
   ORDER BY ss.computed_at DESC 
   LIMIT 1) as score,
  -- Priority contract (active > pending > others)
  (SELECT jsonb_build_object(
    'id', cc.id,
    'status', cc.status, 
    'start_date', cc.start_date, 
    'end_date', cc.end_date,
    'product_id', cc.product_id
  )
   FROM client_contracts cc 
   WHERE cc.client_id = c.id 
   ORDER BY 
     CASE cc.status 
       WHEN 'active' THEN 1 
       WHEN 'pending' THEN 2 
       ELSE 3 
     END, 
     cc.end_date DESC NULLS LAST
   LIMIT 1) as contract,
  -- WhatsApp conversation exists
  EXISTS(SELECT 1 FROM conversations conv WHERE conv.client_id = c.id) as has_conversation,
  -- Message count (limit to recent for performance)
  COALESCE((SELECT COUNT(*) FROM message_events me WHERE me.client_id = c.id), 0) as message_count
FROM clients c;

-- Create indexes for efficient querying
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_latest_metrics_client_id ON client_latest_metrics(client_id);
CREATE INDEX IF NOT EXISTS idx_client_latest_metrics_account_id ON client_latest_metrics(account_id);

-- Create a function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_client_latest_metrics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY client_latest_metrics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access
GRANT SELECT ON client_latest_metrics TO anon, authenticated;