CREATE TABLE public.event_content_deliverables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'custom',
  title TEXT NOT NULL,
  description TEXT,
  due_offset_days INTEGER,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'todo',
  assigned_to UUID,
  marketing_task_id UUID,
  content_piece_id UUID,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ecd_event ON public.event_content_deliverables(event_id);
CREATE INDEX idx_ecd_account ON public.event_content_deliverables(account_id);
CREATE INDEX idx_ecd_due_date ON public.event_content_deliverables(due_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_content_deliverables TO authenticated;
GRANT ALL ON public.event_content_deliverables TO service_role;

ALTER TABLE public.event_content_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ecd_select_same_account" ON public.event_content_deliverables
  FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "ecd_insert_same_account" ON public.event_content_deliverables
  FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "ecd_update_same_account" ON public.event_content_deliverables
  FOR UPDATE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "ecd_delete_same_account" ON public.event_content_deliverables
  FOR DELETE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE TRIGGER trg_ecd_updated_at
  BEFORE UPDATE ON public.event_content_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();