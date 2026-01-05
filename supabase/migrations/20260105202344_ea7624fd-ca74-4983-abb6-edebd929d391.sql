-- Create marketing events table
CREATE TABLE public.marketing_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'campaign',
  start_date DATE NOT NULL,
  end_date DATE,
  budget DECIMAL(12,2),
  status TEXT NOT NULL DEFAULT 'draft',
  color TEXT DEFAULT '#6366f1',
  goals TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_event_type CHECK (event_type IN ('launch', 'campaign', 'webinar', 'content', 'live', 'partnership', 'fair', 'workshop', 'other')),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'planned', 'in_progress', 'completed', 'cancelled'))
);

-- Enable RLS
ALTER TABLE public.marketing_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view marketing events from their account"
ON public.marketing_events FOR SELECT
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can create marketing events for their account"
ON public.marketing_events FOR INSERT
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update marketing events from their account"
ON public.marketing_events FOR UPDATE
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete marketing events from their account"
ON public.marketing_events FOR DELETE
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

-- Indexes
CREATE INDEX idx_marketing_events_account_id ON public.marketing_events(account_id);
CREATE INDEX idx_marketing_events_start_date ON public.marketing_events(start_date);
CREATE INDEX idx_marketing_events_status ON public.marketing_events(status);

-- Trigger for updated_at
CREATE TRIGGER update_marketing_events_updated_at
BEFORE UPDATE ON public.marketing_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();