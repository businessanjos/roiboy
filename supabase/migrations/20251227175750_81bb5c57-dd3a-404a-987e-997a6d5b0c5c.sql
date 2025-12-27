-- Add business segment and niche fields for PJ clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS business_segment text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS business_niche text;

-- Comments for documentation
COMMENT ON COLUMN public.clients.business_segment IS 'Business segment (e.g., Saúde & Estética, Tecnologia)';
COMMENT ON COLUMN public.clients.business_niche IS 'Business niche within the segment (e.g., Harmonização Facial)';