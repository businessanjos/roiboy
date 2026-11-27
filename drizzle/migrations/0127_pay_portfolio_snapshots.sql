CREATE OR REPLACE FUNCTION public.pay_portfolio_snapshot_scope()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN COALESCE(public.can_manage_spiff_payments(auth.uid()), false) THEN 'all'
    WHEN public.can_view_pay_portfolio() THEN public.get_current_user_id()::text
    ELSE NULL
  END;
$$;
REVOKE EXECUTE ON FUNCTION public.pay_portfolio_snapshot_scope() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_portfolio_snapshot_scope() TO authenticated, service_role;

CREATE TABLE public.pay_portfolio_snapshots (
  account_id uuid NOT NULL,
  scope_key text NOT NULL,
  data jsonb NOT NULL,
  generated_at timestamptz NOT NULL,
  refreshed_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, scope_key)
);

GRANT SELECT ON public.pay_portfolio_snapshots TO authenticated;
GRANT ALL ON public.pay_portfolio_snapshots TO service_role;

ALTER TABLE public.pay_portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own portfolio snapshot scope"
ON public.pay_portfolio_snapshots FOR SELECT TO authenticated
USING (
  account_id = (SELECT public.get_current_user_account_id())
  AND scope_key = (SELECT public.pay_portfolio_snapshot_scope())
);