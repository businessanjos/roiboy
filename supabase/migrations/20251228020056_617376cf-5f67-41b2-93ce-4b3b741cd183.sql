-- Create table for lead timeline events (purchase journey)
CREATE TABLE public.lead_timeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'note', 'status_change', 'contact', 'call', 'meeting', 'email', 'whatsapp'
  title TEXT NOT NULL,
  description TEXT,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_timeline ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view lead timeline from their account"
ON public.lead_timeline
FOR SELECT
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can create lead timeline events"
ON public.lead_timeline
FOR INSERT
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update lead timeline events"
ON public.lead_timeline
FOR UPDATE
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete lead timeline events"
ON public.lead_timeline
FOR DELETE
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_lead_timeline_lead_id ON public.lead_timeline(lead_id);
CREATE INDEX idx_lead_timeline_account_id ON public.lead_timeline(account_id);
CREATE INDEX idx_lead_timeline_created_at ON public.lead_timeline(created_at DESC);