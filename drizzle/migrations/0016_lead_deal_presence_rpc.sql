CREATE OR REPLACE FUNCTION public.get_lead_deal_presence(p_lead_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  stage_name text,
  responsible_name text,
  can_view boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id,
    d.title,
    d.status,
    s.name AS stage_name,
    u.name AS responsible_name,
    can_view_deal(d.status, d.responsible_user_id, d.sdr_user_id, d.renewal_responsible_user_id, d.created_by, d.pipeline_id) AS can_view
  FROM deals d
  LEFT JOIN deal_stages s ON s.id = d.stage_id
  LEFT JOIN users u ON u.id = d.responsible_user_id
  WHERE d.lead_id = p_lead_id
    AND d.deleted_at IS NULL
    AND d.account_id = get_user_account_id()
    AND user_has_sector_access(auth.uid(), 'vendas')
  ORDER BY d.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_lead_deal_presence(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_lead_deal_presence(uuid) TO authenticated;