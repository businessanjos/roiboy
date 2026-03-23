
-- Function to get latest score snapshot per client (avoids fetching 158K+ rows)
CREATE OR REPLACE FUNCTION public.get_latest_scores_for_clients(p_client_ids uuid[])
RETURNS TABLE(
  client_id uuid,
  roizometer numeric,
  escore numeric,
  quadrant text,
  trend text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (ss.client_id)
    ss.client_id,
    ss.roizometer,
    ss.escore,
    ss.quadrant,
    ss.trend
  FROM score_snapshots ss
  WHERE ss.client_id = ANY(p_client_ids)
  ORDER BY ss.client_id, ss.computed_at DESC;
$$;

-- Function to get latest vnps snapshot per client (avoids fetching 158K+ rows)
CREATE OR REPLACE FUNCTION public.get_latest_vnps_for_clients(p_client_ids uuid[])
RETURNS TABLE(
  client_id uuid,
  vnps_score numeric,
  vnps_class text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (vs.client_id)
    vs.client_id,
    vs.vnps_score,
    vs.vnps_class
  FROM vnps_snapshots vs
  WHERE vs.client_id = ANY(p_client_ids)
  ORDER BY vs.client_id, vs.computed_at DESC;
$$;

-- Function to get latest risk reason per client
CREATE OR REPLACE FUNCTION public.get_latest_risks_for_clients(p_client_ids uuid[])
RETURNS TABLE(
  client_id uuid,
  reason text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (re.client_id)
    re.client_id,
    re.reason
  FROM risk_events re
  WHERE re.client_id = ANY(p_client_ids)
  ORDER BY re.client_id, re.happened_at DESC;
$$;

-- Function to get latest open recommendation per client
CREATE OR REPLACE FUNCTION public.get_latest_recommendations_for_clients(p_client_ids uuid[])
RETURNS TABLE(
  client_id uuid,
  action_text text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (r.client_id)
    r.client_id,
    r.action_text
  FROM recommendations r
  WHERE r.client_id = ANY(p_client_ids)
    AND r.status = 'open'
  ORDER BY r.client_id, r.created_at DESC;
$$;
