CREATE TABLE public.content_approval_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  created_by uuid,
  post_title text NOT NULL DEFAULT '',
  responsible text,
  post_date date,
  format text,
  pilar text,
  objetivo text,
  ideia_central text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_approval_checklists TO authenticated;
GRANT ALL ON public.content_approval_checklists TO service_role;

ALTER TABLE public.content_approval_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members manage content checklists"
ON public.content_approval_checklists FOR ALL TO authenticated
USING (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()))
WITH CHECK (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

CREATE TRIGGER update_content_approval_checklists_updated_at
BEFORE UPDATE ON public.content_approval_checklists
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_content_checklists_account ON public.content_approval_checklists(account_id, created_at DESC);