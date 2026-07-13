
-- 1) Remove Omie-sourced financial entries (keep contract/manual)
DELETE FROM public.financial_entries WHERE source = 'omie' OR omie_id IS NOT NULL;

-- 2) Drop tax/accountant module (depends on omie_settings_id)
DROP TABLE IF EXISTS public.financial_tax_ai_runs CASCADE;
DROP TABLE IF EXISTS public.financial_tax_alerts CASCADE;
DROP TABLE IF EXISTS public.financial_accountant_interactions CASCADE;
DROP TABLE IF EXISTS public.financial_accountant CASCADE;
DROP TABLE IF EXISTS public.financial_tax_profile CASCADE;

-- 3) Drop Omie tables
DROP TABLE IF EXISTS public.omie_integration_logs CASCADE;
DROP TABLE IF EXISTS public.omie_settings CASCADE;

-- 4) Drop Omie columns from financial_entries
ALTER TABLE public.financial_entries
  DROP COLUMN IF EXISTS omie_id,
  DROP COLUMN IF EXISTS omie_sync_at,
  DROP COLUMN IF EXISTS omie_payload,
  DROP COLUMN IF EXISTS last_omie_sync_at;

-- 5) Drop related enums if unused (tax_regime etc.)
DROP TYPE IF EXISTS public.tax_alert_severity CASCADE;
DROP TYPE IF EXISTS public.tax_alert_status CASCADE;
DROP TYPE IF EXISTS public.tax_alert_origin CASCADE;
DROP TYPE IF EXISTS public.tax_regime CASCADE;
DROP TYPE IF EXISTS public.tax_simples_annex CASCADE;
