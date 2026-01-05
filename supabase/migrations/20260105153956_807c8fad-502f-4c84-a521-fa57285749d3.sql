-- Create sector settings table for sector-level configurations
CREATE TABLE public.sector_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  sector_id TEXT NOT NULL,
  royzapp_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(account_id, sector_id)
);

-- Enable RLS
ALTER TABLE public.sector_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view sector settings in their account"
ON public.sector_settings FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert sector settings in their account"
ON public.sector_settings FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update sector settings in their account"
ON public.sector_settings FOR UPDATE
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete sector settings in their account"
ON public.sector_settings FOR DELETE
USING (account_id = get_user_account_id());

-- Add index
CREATE INDEX idx_sector_settings_account ON public.sector_settings(account_id);

-- Add trigger for updated_at
CREATE TRIGGER update_sector_settings_updated_at
BEFORE UPDATE ON public.sector_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();