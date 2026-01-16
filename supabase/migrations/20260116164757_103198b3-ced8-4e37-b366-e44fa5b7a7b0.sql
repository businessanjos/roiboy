-- Create enum for marketing task priority
CREATE TYPE marketing_task_priority AS ENUM ('low', 'medium', 'high');

-- Create enum for marketing task status
CREATE TYPE marketing_task_status AS ENUM ('pending', 'in_progress', 'done');

-- Create marketing task sections table
CREATE TABLE public.marketing_task_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_collapsed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create marketing tasks table
CREATE TABLE public.marketing_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.marketing_task_sections(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  due_date DATE,
  priority marketing_task_priority NOT NULL DEFAULT 'medium',
  status marketing_task_status NOT NULL DEFAULT 'pending',
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketing_task_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies for marketing_task_sections
CREATE POLICY "Users can view their account sections"
  ON public.marketing_task_sections FOR SELECT
  USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can create sections for their account"
  ON public.marketing_task_sections FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update their account sections"
  ON public.marketing_task_sections FOR UPDATE
  USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their account sections"
  ON public.marketing_task_sections FOR DELETE
  USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

-- RLS policies for marketing_tasks
CREATE POLICY "Users can view their account tasks"
  ON public.marketing_tasks FOR SELECT
  USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can create tasks for their account"
  ON public.marketing_tasks FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update their account tasks"
  ON public.marketing_tasks FOR UPDATE
  USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their account tasks"
  ON public.marketing_tasks FOR DELETE
  USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_marketing_tasks_account_id ON public.marketing_tasks(account_id);
CREATE INDEX idx_marketing_tasks_section_id ON public.marketing_tasks(section_id);
CREATE INDEX idx_marketing_tasks_assignee_id ON public.marketing_tasks(assignee_id);
CREATE INDEX idx_marketing_tasks_status ON public.marketing_tasks(status);
CREATE INDEX idx_marketing_task_sections_account_id ON public.marketing_task_sections(account_id);

-- Create triggers for updated_at
CREATE TRIGGER update_marketing_tasks_updated_at
  BEFORE UPDATE ON public.marketing_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_marketing_task_sections_updated_at
  BEFORE UPDATE ON public.marketing_task_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();