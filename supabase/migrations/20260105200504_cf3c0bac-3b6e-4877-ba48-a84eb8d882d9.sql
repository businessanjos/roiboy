-- Create activity types table for sales activities
CREATE TABLE public.activity_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'circle',
  color TEXT DEFAULT '#6366f1',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_types ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view activity types from their account"
ON public.activity_types
FOR SELECT
USING (
  account_id IN (
    SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create activity types for their account"
ON public.activity_types
FOR INSERT
WITH CHECK (
  account_id IN (
    SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Users can update activity types from their account"
ON public.activity_types
FOR UPDATE
USING (
  account_id IN (
    SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete activity types from their account"
ON public.activity_types
FOR DELETE
USING (
  account_id IN (
    SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()
  )
);

-- Add activity_type_id column to internal_tasks
ALTER TABLE public.internal_tasks 
ADD COLUMN activity_type_id UUID REFERENCES public.activity_types(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_internal_tasks_activity_type_id ON public.internal_tasks(activity_type_id);
CREATE INDEX idx_activity_types_account_id ON public.activity_types(account_id);

-- Trigger for updated_at
CREATE TRIGGER update_activity_types_updated_at
BEFORE UPDATE ON public.activity_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();