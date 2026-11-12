CREATE TABLE public.lead_revenue_routing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  revenue_value text NOT NULL,
  pipeline_id uuid REFERENCES public.pipelines(id) ON DELETE SET NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, revenue_value)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_revenue_routing TO authenticated;
GRANT ALL ON public.lead_revenue_routing TO service_role;
ALTER TABLE public.lead_revenue_routing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "account members read lead routing" ON public.lead_revenue_routing
  FOR SELECT TO authenticated USING (account_id = get_current_user_account_id());
CREATE POLICY "managers manage lead routing" ON public.lead_revenue_routing
  FOR ALL TO authenticated
  USING (account_id = get_current_user_account_id() AND can_manage_spiff_payments(auth.uid()))
  WITH CHECK (account_id = get_current_user_account_id() AND can_manage_spiff_payments(auth.uid()));