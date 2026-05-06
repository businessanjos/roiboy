
CREATE TABLE public.typeform_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  form_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  webhook_tag TEXT,
  webhook_installed BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  campaign_tag TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_id, form_id)
);

CREATE TABLE public.typeform_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  form_id TEXT NOT NULL,
  response_id TEXT NOT NULL,
  landed_at TIMESTAMP WITH TIME ZONE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  is_completed BOOLEAN DEFAULT false,
  email TEXT,
  phone TEXT,
  full_name TEXT,
  hidden_fields JSONB DEFAULT '{}'::jsonb,
  answers JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  matched_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  matched_deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  match_method TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(form_id, response_id)
);

CREATE TABLE public.typeform_form_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  form_id TEXT NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_visits INTEGER DEFAULT 0,
  total_starts INTEGER DEFAULT 0,
  total_submissions INTEGER DEFAULT 0,
  completion_rate NUMERIC(6,2) DEFAULT 0,
  average_time_seconds INTEGER DEFAULT 0,
  raw JSONB,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_id, form_id, snapshot_date)
);

ALTER TABLE public.typeform_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typeform_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typeform_form_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "typeform_forms account access" ON public.typeform_forms
  FOR ALL USING (account_id = public.get_current_user_account_id())
  WITH CHECK (account_id = public.get_current_user_account_id());

CREATE POLICY "typeform_responses account access" ON public.typeform_responses
  FOR ALL USING (account_id = public.get_current_user_account_id())
  WITH CHECK (account_id = public.get_current_user_account_id());

CREATE POLICY "typeform_form_stats account access" ON public.typeform_form_stats
  FOR ALL USING (account_id = public.get_current_user_account_id())
  WITH CHECK (account_id = public.get_current_user_account_id());

CREATE INDEX idx_typeform_responses_form ON public.typeform_responses(account_id, form_id, submitted_at DESC);
CREATE INDEX idx_typeform_responses_email ON public.typeform_responses(account_id, email);
CREATE INDEX idx_typeform_responses_phone ON public.typeform_responses(account_id, phone);

CREATE TRIGGER trg_typeform_forms_updated BEFORE UPDATE ON public.typeform_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_typeform_responses_updated BEFORE UPDATE ON public.typeform_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
