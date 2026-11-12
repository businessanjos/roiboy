CREATE TABLE public.lead_revenue_routing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  revenue_value text NOT NULL,
  old_pipeline_id uuid,
  new_pipeline_id uuid,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lead_revenue_routing_history TO authenticated;
GRANT ALL ON public.lead_revenue_routing_history TO service_role;
ALTER TABLE public.lead_revenue_routing_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membros veem historico de roteamento" ON public.lead_revenue_routing_history
FOR SELECT TO authenticated USING (account_id = public.get_current_user_account_id());
CREATE INDEX ON public.lead_revenue_routing_history (account_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.log_lead_revenue_routing_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid;
BEGIN
  SELECT id INTO _uid FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.lead_revenue_routing_history(account_id, revenue_value, old_pipeline_id, new_pipeline_id, changed_by)
    VALUES (OLD.account_id, OLD.revenue_value, OLD.pipeline_id, NULL, _uid);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.pipeline_id IS NOT DISTINCT FROM OLD.pipeline_id THEN RETURN NEW; END IF;
  INSERT INTO public.lead_revenue_routing_history(account_id, revenue_value, old_pipeline_id, new_pipeline_id, changed_by)
  VALUES (NEW.account_id, NEW.revenue_value, CASE WHEN TG_OP='UPDATE' THEN OLD.pipeline_id END, NEW.pipeline_id, COALESCE(_uid, NEW.updated_by));
  RETURN NEW;
END $$;

CREATE TRIGGER trg_lead_revenue_routing_history
AFTER INSERT OR UPDATE OR DELETE ON public.lead_revenue_routing
FOR EACH ROW EXECUTE FUNCTION public.log_lead_revenue_routing_change();