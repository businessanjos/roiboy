-- Create marketing task subtasks table
CREATE TABLE public.marketing_task_subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.marketing_tasks(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  display_order INTEGER NOT NULL DEFAULT 0,
  due_date DATE,
  assignee_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by task_id
CREATE INDEX idx_marketing_task_subtasks_task_id ON public.marketing_task_subtasks(task_id);
CREATE INDEX idx_marketing_task_subtasks_account_id ON public.marketing_task_subtasks(account_id);

-- Enable RLS
ALTER TABLE public.marketing_task_subtasks ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can access subtasks for tasks in their account
CREATE POLICY "Users can view subtasks in their account" 
ON public.marketing_task_subtasks 
FOR SELECT 
USING (account_id = get_my_account_id());

CREATE POLICY "Users can create subtasks in their account" 
ON public.marketing_task_subtasks 
FOR INSERT 
WITH CHECK (account_id = get_my_account_id());

CREATE POLICY "Users can update subtasks in their account" 
ON public.marketing_task_subtasks 
FOR UPDATE 
USING (account_id = get_my_account_id());

CREATE POLICY "Users can delete subtasks in their account" 
ON public.marketing_task_subtasks 
FOR DELETE 
USING (account_id = get_my_account_id());

-- Trigger for updated_at
CREATE TRIGGER update_marketing_task_subtasks_updated_at
BEFORE UPDATE ON public.marketing_task_subtasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();