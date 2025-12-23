-- Create reminders table
CREATE TABLE public.reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('event', 'checkin', 'contract', 'life_event', 'custom')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timing configuration
  days_before INTEGER NOT NULL DEFAULT 1,
  time_of_day TIME NOT NULL DEFAULT '09:00:00',
  
  -- Channels
  send_whatsapp BOOLEAN NOT NULL DEFAULT true,
  send_email BOOLEAN NOT NULL DEFAULT true,
  send_notification BOOLEAN NOT NULL DEFAULT true,
  
  -- Message templates
  whatsapp_template TEXT,
  email_subject TEXT,
  email_template TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reminder logs table to track sent reminders
CREATE TABLE public.reminder_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  reminder_id UUID NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.client_contracts(id) ON DELETE SET NULL,
  life_event_id UUID REFERENCES public.client_life_events(id) ON DELETE SET NULL,
  
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'notification')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reminders
CREATE POLICY "Users can view reminders in their account" 
ON public.reminders FOR SELECT 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert reminders in their account" 
ON public.reminders FOR INSERT 
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update reminders in their account" 
ON public.reminders FOR UPDATE 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete reminders in their account" 
ON public.reminders FOR DELETE 
USING (account_id = get_user_account_id());

-- RLS Policies for reminder_logs
CREATE POLICY "Users can view reminder_logs in their account" 
ON public.reminder_logs FOR SELECT 
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert reminder_logs in their account" 
ON public.reminder_logs FOR INSERT 
WITH CHECK (account_id = get_user_account_id());

-- Create indexes for performance
CREATE INDEX idx_reminders_account ON public.reminders(account_id);
CREATE INDEX idx_reminders_type ON public.reminders(reminder_type);
CREATE INDEX idx_reminder_logs_reminder ON public.reminder_logs(reminder_id);
CREATE INDEX idx_reminder_logs_status ON public.reminder_logs(status);
CREATE INDEX idx_reminder_logs_created ON public.reminder_logs(created_at);

-- Create updated_at trigger
CREATE TRIGGER update_reminders_updated_at
BEFORE UPDATE ON public.reminders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();