-- Add meeting preferences columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS meeting_platform TEXT DEFAULT 'google';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS meeting_email_advance TEXT DEFAULT 'immediate';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS meeting_email_template TEXT;

-- Add meeting columns to internal_tasks table
ALTER TABLE public.internal_tasks ADD COLUMN IF NOT EXISTS meeting_url TEXT;
ALTER TABLE public.internal_tasks ADD COLUMN IF NOT EXISTS meeting_platform TEXT;

-- Create email_queue table for scheduled email dispatch
CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.internal_tasks(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  meeting_url TEXT,
  send_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on email_queue
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for email_queue
CREATE POLICY "Users can view their account emails" 
ON public.email_queue 
FOR SELECT 
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert emails for their account" 
ON public.email_queue 
FOR INSERT 
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update their account emails" 
ON public.email_queue 
FOR UPDATE 
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their account emails" 
ON public.email_queue 
FOR DELETE 
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

-- Create index for efficient email processing
CREATE INDEX IF NOT EXISTS idx_email_queue_pending ON public.email_queue (send_at, status) WHERE status = 'pending';

-- Create updated_at trigger for email_queue
CREATE TRIGGER update_email_queue_updated_at
BEFORE UPDATE ON public.email_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();