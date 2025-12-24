-- Create table for custom task statuses
CREATE TABLE public.task_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT NOT NULL DEFAULT 'circle',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_completed_status BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_statuses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view task statuses in their account"
  ON public.task_statuses FOR SELECT
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert task statuses in their account"
  ON public.task_statuses FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update task statuses in their account"
  ON public.task_statuses FOR UPDATE
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete task statuses in their account"
  ON public.task_statuses FOR DELETE
  USING (account_id = get_user_account_id());

-- Create trigger for updated_at
CREATE TRIGGER update_task_statuses_updated_at
  BEFORE UPDATE ON public.task_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to initialize default task statuses for new accounts
CREATE OR REPLACE FUNCTION public.create_default_task_statuses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.task_statuses (account_id, name, color, icon, display_order, is_default, is_completed_status)
  VALUES
    (NEW.id, 'Pendente', '#6b7280', 'clock', 1, true, false),
    (NEW.id, 'Em andamento', '#3b82f6', 'arrow-right', 2, false, false),
    (NEW.id, 'Concluído', '#22c55e', 'check-circle-2', 3, false, true),
    (NEW.id, 'Cancelado', '#6b7280', 'x-circle', 4, false, true);
  
  RETURN NEW;
END;
$$;

-- Create trigger to add default statuses when account is created
CREATE TRIGGER create_default_task_statuses_trigger
  AFTER INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_task_statuses();

-- Add index for performance
CREATE INDEX idx_task_statuses_account_id ON public.task_statuses(account_id);
CREATE INDEX idx_task_statuses_display_order ON public.task_statuses(account_id, display_order);

-- Modify internal_tasks table to use custom status
ALTER TABLE public.internal_tasks 
  ADD COLUMN IF NOT EXISTS custom_status_id UUID REFERENCES public.task_statuses(id) ON DELETE SET NULL;