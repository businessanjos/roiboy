-- Create enum for task status
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'done', 'overdue', 'cancelled');

-- Create enum for task priority
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Create internal tasks table
CREATE TABLE public.internal_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'pending',
  priority task_priority NOT NULL DEFAULT 'medium',
  due_date DATE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.internal_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view tasks in their account"
ON public.internal_tasks
FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert tasks in their account"
ON public.internal_tasks
FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update tasks in their account"
ON public.internal_tasks
FOR UPDATE
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete tasks in their account"
ON public.internal_tasks
FOR DELETE
USING (account_id = get_user_account_id());

-- Trigger for updated_at
CREATE TRIGGER update_internal_tasks_updated_at
BEFORE UPDATE ON public.internal_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_tasks;