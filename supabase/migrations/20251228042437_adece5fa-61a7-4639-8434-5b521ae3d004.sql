-- Add deal_id and lead_id columns to internal_tasks for linking tasks to deals and leads
ALTER TABLE public.internal_tasks 
ADD COLUMN deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
ADD COLUMN lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX idx_internal_tasks_deal_id ON public.internal_tasks(deal_id);
CREATE INDEX idx_internal_tasks_lead_id ON public.internal_tasks(lead_id);