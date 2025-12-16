-- Create client_life_events table for CX moments
CREATE TABLE public.client_life_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'birthday',
    'child_birth', 
    'pregnancy',
    'wedding',
    'anniversary',
    'graduation',
    'new_job',
    'promotion',
    'retirement',
    'health_issue',
    'loss',
    'travel',
    'achievement',
    'other'
  )),
  event_date DATE,
  title TEXT NOT NULL,
  description TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  reminder_days_before INTEGER DEFAULT 7,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'conversation')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.client_life_events ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view life events in their account" 
ON public.client_life_events 
FOR SELECT 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert life events in their account" 
ON public.client_life_events 
FOR INSERT 
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update life events in their account" 
ON public.client_life_events 
FOR UPDATE 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete life events in their account" 
ON public.client_life_events 
FOR DELETE 
USING (account_id = get_user_account_id());

-- Create indexes
CREATE INDEX idx_client_life_events_client_id ON public.client_life_events(client_id);
CREATE INDEX idx_client_life_events_event_date ON public.client_life_events(event_date);
CREATE INDEX idx_client_life_events_event_type ON public.client_life_events(event_type);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_client_life_events_updated_at
BEFORE UPDATE ON public.client_life_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();