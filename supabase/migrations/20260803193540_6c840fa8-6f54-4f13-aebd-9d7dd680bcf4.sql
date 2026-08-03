CREATE TABLE public.content_checklist_format_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  format text NOT NULL,
  section_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, format, section_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_checklist_format_rules TO authenticated;
GRANT ALL ON public.content_checklist_format_rules TO service_role;

ALTER TABLE public.content_checklist_format_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members manage checklist format rules"
ON public.content_checklist_format_rules FOR ALL TO authenticated
USING (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()))
WITH CHECK (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

CREATE TRIGGER update_content_checklist_format_rules_updated_at
BEFORE UPDATE ON public.content_checklist_format_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();