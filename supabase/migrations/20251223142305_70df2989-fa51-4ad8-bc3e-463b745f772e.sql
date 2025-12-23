-- Enum for reminder campaign types
CREATE TYPE reminder_campaign_type AS ENUM ('notice', 'rsvp', 'checkin', 'feedback');

-- Enum for campaign status
CREATE TYPE reminder_campaign_status AS ENUM ('draft', 'scheduled', 'sending', 'completed', 'cancelled');

-- Enum for recipient send status
CREATE TYPE reminder_recipient_status AS ENUM ('pending', 'queued', 'sending', 'sent', 'failed', 'responded');

-- Table for reminder campaigns
CREATE TABLE public.reminder_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  campaign_type reminder_campaign_type NOT NULL DEFAULT 'notice',
  name TEXT NOT NULL,
  message_template TEXT NOT NULL,
  email_subject TEXT,
  send_whatsapp BOOLEAN NOT NULL DEFAULT true,
  send_email BOOLEAN NOT NULL DEFAULT false,
  status reminder_campaign_status NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  responded_count INTEGER NOT NULL DEFAULT 0,
  delay_min_seconds INTEGER NOT NULL DEFAULT 3,
  delay_max_seconds INTEGER NOT NULL DEFAULT 10,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for individual recipients in a campaign
CREATE TABLE public.reminder_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.reminder_campaigns(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES public.event_participants(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT,
  recipient_email TEXT,
  whatsapp_status reminder_recipient_status NOT NULL DEFAULT 'pending',
  email_status reminder_recipient_status NOT NULL DEFAULT 'pending',
  whatsapp_sent_at TIMESTAMP WITH TIME ZONE,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  whatsapp_error TEXT,
  email_error TEXT,
  responded_at TIMESTAMP WITH TIME ZONE,
  response_data JSONB,
  send_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reminder_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_recipients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reminder_campaigns
CREATE POLICY "Users can view campaigns in their account"
  ON public.reminder_campaigns FOR SELECT
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert campaigns in their account"
  ON public.reminder_campaigns FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update campaigns in their account"
  ON public.reminder_campaigns FOR UPDATE
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete campaigns in their account"
  ON public.reminder_campaigns FOR DELETE
  USING (account_id = get_user_account_id());

-- RLS Policies for reminder_recipients
CREATE POLICY "Users can view recipients in their account"
  ON public.reminder_recipients FOR SELECT
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert recipients in their account"
  ON public.reminder_recipients FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update recipients in their account"
  ON public.reminder_recipients FOR UPDATE
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete recipients in their account"
  ON public.reminder_recipients FOR DELETE
  USING (account_id = get_user_account_id());

-- Create indexes
CREATE INDEX idx_reminder_campaigns_event ON public.reminder_campaigns(event_id);
CREATE INDEX idx_reminder_campaigns_account ON public.reminder_campaigns(account_id);
CREATE INDEX idx_reminder_campaigns_status ON public.reminder_campaigns(status);
CREATE INDEX idx_reminder_recipients_campaign ON public.reminder_recipients(campaign_id);
CREATE INDEX idx_reminder_recipients_status ON public.reminder_recipients(whatsapp_status, email_status);

-- Trigger for updated_at
CREATE TRIGGER update_reminder_campaigns_updated_at
  BEFORE UPDATE ON public.reminder_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reminder_recipients_updated_at
  BEFORE UPDATE ON public.reminder_recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();