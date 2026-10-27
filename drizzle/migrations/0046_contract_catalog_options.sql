CREATE TABLE public.contract_catalog_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  list_key text NOT NULL,
  value text NOT NULL,
  label text NOT NULL,
  description text,
  color text,
  metric_bucket text,
  is_builtin boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, list_key, value)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_catalog_options TO authenticated;
GRANT ALL ON public.contract_catalog_options TO service_role;
ALTER TABLE public.contract_catalog_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Account members view catalog" ON public.contract_catalog_options FOR SELECT TO authenticated USING (account_id = public.get_current_user_account_id());
CREATE POLICY "Account members manage catalog" ON public.contract_catalog_options FOR ALL TO authenticated USING (account_id = public.get_current_user_account_id()) WITH CHECK (account_id = public.get_current_user_account_id());

CREATE TABLE public.contract_catalog_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  list_key text NOT NULL,
  value text NOT NULL,
  action text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  changed_by uuid,
  changed_by_name text,
  undone_at timestamptz,
  undo_of uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.contract_catalog_history TO authenticated;
GRANT ALL ON public.contract_catalog_history TO service_role;
ALTER TABLE public.contract_catalog_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Account members view catalog history" ON public.contract_catalog_history FOR SELECT TO authenticated USING (account_id = public.get_current_user_account_id());
CREATE POLICY "Account members add catalog history" ON public.contract_catalog_history FOR INSERT TO authenticated WITH CHECK (account_id = public.get_current_user_account_id());
CREATE POLICY "Account members mark catalog undo" ON public.contract_catalog_history FOR UPDATE TO authenticated USING (account_id = public.get_current_user_account_id()) WITH CHECK (account_id = public.get_current_user_account_id());
CREATE INDEX ON public.contract_catalog_history (account_id, created_at DESC);

INSERT INTO public.contract_catalog_options (account_id, list_key, value, label, is_active, display_order, created_at)
SELECT account_id, 'contract_type', value, label, is_active, display_order, created_at FROM public.contract_type_options
ON CONFLICT DO NOTHING;
COMMENT ON TABLE public.contract_type_options IS 'DEPRECATED: replaced by contract_catalog_options (list_key=contract_type)';