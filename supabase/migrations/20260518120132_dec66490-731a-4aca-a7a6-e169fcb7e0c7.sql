
-- Enums
CREATE TYPE public.tax_regime AS ENUM ('mei','simples_nacional','lucro_presumido','lucro_real');
CREATE TYPE public.tax_simples_annex AS ENUM ('I','II','III','IV','V');
CREATE TYPE public.tax_alert_severity AS ENUM ('info','warning','critical');
CREATE TYPE public.tax_alert_status AS ENUM ('open','read','resolved','dismissed');
CREATE TYPE public.tax_alert_origin AS ENUM ('manual','ai');

-- 1. financial_tax_profile (one per omie_settings/CNPJ)
CREATE TABLE public.financial_tax_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  omie_settings_id uuid NOT NULL REFERENCES public.omie_settings(id) ON DELETE CASCADE UNIQUE,
  regime public.tax_regime,
  simples_annex public.tax_simples_annex,
  cnae_principal text,
  cnaes_secundarios text[] DEFAULT '{}',
  inscricao_estadual text,
  inscricao_municipal text,
  atividade text,
  opcao_regime_em date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. financial_accountant
CREATE TABLE public.financial_accountant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  omie_settings_id uuid NOT NULL REFERENCES public.omie_settings(id) ON DELETE CASCADE UNIQUE,
  nome text,
  escritorio text,
  crc text,
  telefone text,
  email text,
  whatsapp text,
  honorario_brl numeric(14,2),
  frequencia text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. interactions
CREATE TABLE public.financial_accountant_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  accountant_id uuid NOT NULL REFERENCES public.financial_accountant(id) ON DELETE CASCADE,
  ocorrido_em timestamptz NOT NULL DEFAULT now(),
  nota text NOT NULL,
  anexo_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. alerts
CREATE TABLE public.financial_tax_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  omie_settings_id uuid NOT NULL REFERENCES public.omie_settings(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  severidade public.tax_alert_severity NOT NULL DEFAULT 'info',
  titulo text NOT NULL,
  descricao text,
  acao_sugerida text,
  status public.tax_alert_status NOT NULL DEFAULT 'open',
  origem public.tax_alert_origin NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);
CREATE INDEX idx_tax_alerts_company_status ON public.financial_tax_alerts(omie_settings_id, status);

-- 5. ai runs log
CREATE TABLE public.financial_tax_ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  omie_settings_id uuid NOT NULL REFERENCES public.omie_settings(id) ON DELETE CASCADE,
  input_summary jsonb,
  output jsonb,
  model text,
  alerts_created integer DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tax_ai_runs_company ON public.financial_tax_ai_runs(omie_settings_id, created_at DESC);

-- updated_at triggers
CREATE TRIGGER trg_tax_profile_updated_at BEFORE UPDATE ON public.financial_tax_profile FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_accountant_updated_at BEFORE UPDATE ON public.financial_accountant FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.financial_tax_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accountant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accountant_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_tax_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_tax_ai_runs ENABLE ROW LEVEL SECURITY;

-- Policies (account-isolated; ALL for authenticated users in the account)
CREATE POLICY tax_profile_all ON public.financial_tax_profile FOR ALL TO authenticated
  USING (account_id = public.get_my_account_id()) WITH CHECK (account_id = public.get_my_account_id());

CREATE POLICY accountant_all ON public.financial_accountant FOR ALL TO authenticated
  USING (account_id = public.get_my_account_id()) WITH CHECK (account_id = public.get_my_account_id());

CREATE POLICY accountant_interactions_all ON public.financial_accountant_interactions FOR ALL TO authenticated
  USING (account_id = public.get_my_account_id()) WITH CHECK (account_id = public.get_my_account_id());

CREATE POLICY tax_alerts_all ON public.financial_tax_alerts FOR ALL TO authenticated
  USING (account_id = public.get_my_account_id()) WITH CHECK (account_id = public.get_my_account_id());

CREATE POLICY tax_ai_runs_all ON public.financial_tax_ai_runs FOR ALL TO authenticated
  USING (account_id = public.get_my_account_id()) WITH CHECK (account_id = public.get_my_account_id());
