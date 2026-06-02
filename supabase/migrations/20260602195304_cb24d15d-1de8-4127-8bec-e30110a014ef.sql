CREATE TABLE public.marketing_project_copilot_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.marketing_projects(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT,
  tool_calls JSONB,
  tool_call_id TEXT,
  tool_name TEXT,
  tool_result JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mpcm_project ON public.marketing_project_copilot_messages(project_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_project_copilot_messages TO authenticated;
GRANT ALL ON public.marketing_project_copilot_messages TO service_role;

ALTER TABLE public.marketing_project_copilot_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mpcm_all" ON public.marketing_project_copilot_messages
FOR ALL TO authenticated
USING (account_id = get_my_account_id() OR is_super_admin() OR is_account_owner())
WITH CHECK (account_id = get_my_account_id() OR is_super_admin() OR is_account_owner());