CREATE TABLE public.contract_type_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  value text NOT NULL,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, value)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_type_options TO authenticated;
GRANT ALL ON public.contract_type_options TO service_role;
ALTER TABLE public.contract_type_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Account members view contract types" ON public.contract_type_options FOR SELECT TO authenticated USING (account_id = get_current_user_account_id());
CREATE POLICY "Account members manage contract types" ON public.contract_type_options FOR ALL TO authenticated USING (account_id = get_current_user_account_id()) WITH CHECK (account_id = get_current_user_account_id());