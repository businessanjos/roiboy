-- Create deal stages table (similar to client_stages)
CREATE TABLE public.deal_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  probability INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create deals/opportunities table
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  stage_id UUID REFERENCES public.deal_stages(id) ON DELETE SET NULL,
  value NUMERIC(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  expected_close_date DATE,
  probability INTEGER DEFAULT 0,
  source TEXT,
  responsible_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
  won_at TIMESTAMP WITH TIME ZONE,
  lost_at TIMESTAMP WITH TIME ZONE,
  lost_reason TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create deal activities table for history
CREATE TABLE public.deal_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'note' CHECK (type IN ('note', 'call', 'email', 'meeting', 'task', 'stage_change', 'status_change')),
  title TEXT,
  content TEXT,
  old_value TEXT,
  new_value TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deal_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for deal_stages
CREATE POLICY "Users can view deal stages from their account" 
ON public.deal_stages FOR SELECT 
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can create deal stages in their account" 
ON public.deal_stages FOR INSERT 
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update deal stages in their account" 
ON public.deal_stages FOR UPDATE 
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete deal stages in their account" 
ON public.deal_stages FOR DELETE 
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

-- RLS Policies for deals
CREATE POLICY "Users can view deals from their account" 
ON public.deals FOR SELECT 
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can create deals in their account" 
ON public.deals FOR INSERT 
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update deals in their account" 
ON public.deals FOR UPDATE 
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete deals in their account" 
ON public.deals FOR DELETE 
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

-- RLS Policies for deal_activities
CREATE POLICY "Users can view deal activities from their account" 
ON public.deal_activities FOR SELECT 
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can create deal activities in their account" 
ON public.deal_activities FOR INSERT 
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update deal activities in their account" 
ON public.deal_activities FOR UPDATE 
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete deal activities in their account" 
ON public.deal_activities FOR DELETE 
USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_deal_stages_account ON public.deal_stages(account_id);
CREATE INDEX idx_deals_account ON public.deals(account_id);
CREATE INDEX idx_deals_stage ON public.deals(stage_id);
CREATE INDEX idx_deals_client ON public.deals(client_id);
CREATE INDEX idx_deals_responsible ON public.deals(responsible_user_id);
CREATE INDEX idx_deals_status ON public.deals(status);
CREATE INDEX idx_deal_activities_deal ON public.deal_activities(deal_id);
CREATE INDEX idx_deal_activities_account ON public.deal_activities(account_id);

-- Trigger for updated_at on deal_stages
CREATE TRIGGER update_deal_stages_updated_at
BEFORE UPDATE ON public.deal_stages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on deals
CREATE TRIGGER update_deals_updated_at
BEFORE UPDATE ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();