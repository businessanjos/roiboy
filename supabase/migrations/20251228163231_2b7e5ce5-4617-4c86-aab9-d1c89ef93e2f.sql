-- Create table to store classification rules/patterns
CREATE TABLE public.financial_classification_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  pattern_type TEXT NOT NULL DEFAULT 'contains', -- 'contains', 'starts_with', 'exact', 'regex'
  category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  suggested_description TEXT,
  confidence NUMERIC DEFAULT 0.8,
  times_used INTEGER DEFAULT 0,
  times_confirmed INTEGER DEFAULT 0,
  times_rejected INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table to store pending AI classifications for review
CREATE TABLE public.financial_pending_classifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  original_description TEXT NOT NULL,
  suggested_description TEXT,
  amount NUMERIC NOT NULL,
  transaction_date DATE NOT NULL,
  transaction_type TEXT NOT NULL, -- 'credit' or 'debit'
  external_id TEXT,
  suggested_category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  suggested_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ai_confidence NUMERIC,
  ai_reasoning TEXT,
  matched_rule_id UUID REFERENCES public.financial_classification_rules(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'rejected', 'edited'
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.financial_classification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_pending_classifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for classification rules
CREATE POLICY "Users can view their account classification rules" 
ON public.financial_classification_rules 
FOR SELECT 
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can create classification rules for their account" 
ON public.financial_classification_rules 
FOR INSERT 
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update their account classification rules" 
ON public.financial_classification_rules 
FOR UPDATE 
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete their account classification rules" 
ON public.financial_classification_rules 
FOR DELETE 
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

-- RLS policies for pending classifications
CREATE POLICY "Users can view their account pending classifications" 
ON public.financial_pending_classifications 
FOR SELECT 
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can create pending classifications for their account" 
ON public.financial_pending_classifications 
FOR INSERT 
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update their account pending classifications" 
ON public.financial_pending_classifications 
FOR UPDATE 
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete their account pending classifications" 
ON public.financial_pending_classifications 
FOR DELETE 
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

-- Add indexes for performance
CREATE INDEX idx_classification_rules_account ON public.financial_classification_rules(account_id);
CREATE INDEX idx_classification_rules_pattern ON public.financial_classification_rules(pattern);
CREATE INDEX idx_pending_classifications_account_status ON public.financial_pending_classifications(account_id, status);
CREATE INDEX idx_pending_classifications_external_id ON public.financial_pending_classifications(external_id);

-- Function to learn from confirmations
CREATE OR REPLACE FUNCTION public.learn_from_classification()
RETURNS TRIGGER AS $$
BEGIN
  -- When a classification is confirmed, update or create a rule
  IF NEW.status = 'confirmed' AND OLD.status = 'pending' THEN
    -- If matched by an existing rule, increment confirmed count
    IF NEW.matched_rule_id IS NOT NULL THEN
      UPDATE public.financial_classification_rules
      SET times_confirmed = times_confirmed + 1,
          times_used = times_used + 1,
          confidence = LEAST(0.99, confidence + 0.01),
          updated_at = now()
      WHERE id = NEW.matched_rule_id;
    ELSE
      -- Create new rule from confirmed classification
      INSERT INTO public.financial_classification_rules (
        account_id, pattern, pattern_type, category_id, suggested_description, confidence
      ) VALUES (
        NEW.account_id,
        NEW.original_description,
        'contains',
        NEW.suggested_category_id,
        NEW.suggested_description,
        0.7
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  -- When rejected, decrease confidence of the matched rule
  IF NEW.status = 'rejected' AND OLD.status = 'pending' AND NEW.matched_rule_id IS NOT NULL THEN
    UPDATE public.financial_classification_rules
    SET times_rejected = times_rejected + 1,
        confidence = GREATEST(0.1, confidence - 0.05),
        updated_at = now()
    WHERE id = NEW.matched_rule_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for learning
CREATE TRIGGER learn_classification_trigger
AFTER UPDATE ON public.financial_pending_classifications
FOR EACH ROW
EXECUTE FUNCTION public.learn_from_classification();