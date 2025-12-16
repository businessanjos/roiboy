-- Create the update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create account_settings table for storing score weights and risk thresholds
CREATE TABLE public.account_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- ROI Source Weights
  weight_whatsapp_text NUMERIC(3,1) NOT NULL DEFAULT 1.0,
  weight_whatsapp_audio NUMERIC(3,1) NOT NULL DEFAULT 1.5,
  weight_live_interaction NUMERIC(3,1) NOT NULL DEFAULT 2.0,
  
  -- E-Score Composition (should sum to 100)
  escore_whatsapp_engagement INTEGER NOT NULL DEFAULT 40,
  escore_live_presence INTEGER NOT NULL DEFAULT 30,
  escore_live_participation INTEGER NOT NULL DEFAULT 30,
  
  -- Risk Thresholds
  threshold_silence_days INTEGER NOT NULL DEFAULT 7,
  threshold_engagement_drop_percent INTEGER NOT NULL DEFAULT 30,
  threshold_low_escore INTEGER NOT NULL DEFAULT 30,
  threshold_low_roizometer INTEGER NOT NULL DEFAULT 30,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(account_id)
);

-- Enable RLS
ALTER TABLE public.account_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their account settings"
ON public.account_settings
FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert their account settings"
ON public.account_settings
FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update their account settings"
ON public.account_settings
FOR UPDATE
USING (account_id = get_user_account_id());

-- Trigger for updated_at
CREATE TRIGGER update_account_settings_updated_at
BEFORE UPDATE ON public.account_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();