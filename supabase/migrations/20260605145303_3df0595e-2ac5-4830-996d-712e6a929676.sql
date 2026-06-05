
-- 1. Tabela de colunas (etapas) customizáveis do kanban de marketing
CREATE TABLE public.marketing_task_columns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title text NOT NULL,
  color text NOT NULL DEFAULT '#94a3b8',
  display_order integer NOT NULL DEFAULT 0,
  is_done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_task_columns_account ON public.marketing_task_columns(account_id, display_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_task_columns TO authenticated;
GRANT ALL ON public.marketing_task_columns TO service_role;

ALTER TABLE public.marketing_task_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view columns of their account"
  ON public.marketing_task_columns FOR SELECT TO authenticated
  USING (account_id = get_my_account_id() OR is_super_admin() OR is_account_owner());

CREATE POLICY "Users can create columns for their account"
  ON public.marketing_task_columns FOR INSERT TO authenticated
  WITH CHECK (account_id = get_my_account_id() OR is_super_admin() OR is_account_owner());

CREATE POLICY "Users can update columns of their account"
  ON public.marketing_task_columns FOR UPDATE TO authenticated
  USING (account_id = get_my_account_id() OR is_super_admin() OR is_account_owner());

CREATE POLICY "Users can delete columns of their account"
  ON public.marketing_task_columns FOR DELETE TO authenticated
  USING (account_id = get_my_account_id() OR is_super_admin() OR is_account_owner());

CREATE TRIGGER update_marketing_task_columns_updated_at
  BEFORE UPDATE ON public.marketing_task_columns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Adicionar column_id em marketing_tasks
ALTER TABLE public.marketing_tasks
  ADD COLUMN column_id uuid REFERENCES public.marketing_task_columns(id) ON DELETE SET NULL;

CREATE INDEX idx_marketing_tasks_column_id ON public.marketing_tasks(column_id);

-- 3. Seed: criar 3 colunas padrão por conta que tenha tarefas e backfill
DO $$
DECLARE
  acc_id uuid;
  c_pending uuid;
  c_inprogress uuid;
  c_done uuid;
BEGIN
  FOR acc_id IN SELECT DISTINCT account_id FROM public.marketing_tasks LOOP
    INSERT INTO public.marketing_task_columns (account_id, title, color, display_order, is_done)
    VALUES (acc_id, 'A Fazer', '#94a3b8', 0, false)
    RETURNING id INTO c_pending;

    INSERT INTO public.marketing_task_columns (account_id, title, color, display_order, is_done)
    VALUES (acc_id, 'Fazendo', '#3b82f6', 1, false)
    RETURNING id INTO c_inprogress;

    INSERT INTO public.marketing_task_columns (account_id, title, color, display_order, is_done)
    VALUES (acc_id, 'Concluído', '#22c55e', 2, true)
    RETURNING id INTO c_done;

    UPDATE public.marketing_tasks SET column_id = c_pending     WHERE account_id = acc_id AND status = 'pending'     AND column_id IS NULL;
    UPDATE public.marketing_tasks SET column_id = c_inprogress  WHERE account_id = acc_id AND status = 'in_progress' AND column_id IS NULL;
    UPDATE public.marketing_tasks SET column_id = c_done        WHERE account_id = acc_id AND status = 'done'        AND column_id IS NULL;
  END LOOP;
END $$;
