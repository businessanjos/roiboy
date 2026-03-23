
-- Add composite indexes for DISTINCT ON queries used by dashboard RPCs
-- These dramatically speed up the "latest per client" pattern

CREATE INDEX IF NOT EXISTS idx_score_snapshots_client_computed
ON score_snapshots (client_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_vnps_snapshots_client_computed
ON vnps_snapshots (client_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_risk_events_client_happened
ON risk_events (client_id, happened_at DESC);

CREATE INDEX IF NOT EXISTS idx_recommendations_client_status_created
ON recommendations (client_id, created_at DESC)
WHERE status = 'open';

-- Index for client_contracts status filter (used by dashboard)
CREATE INDEX IF NOT EXISTS idx_client_contracts_status
ON client_contracts (status)
WHERE status IN ('active', 'pending');
