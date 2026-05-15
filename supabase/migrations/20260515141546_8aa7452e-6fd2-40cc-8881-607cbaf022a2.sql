
-- ─── client_milestones ───
CREATE TABLE public.client_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  milestone_type text NOT NULL CHECK (milestone_type IN (
    'first_million','record_month','expansion','hundred_patients_month','two_years','custom'
  )),
  title text NOT NULL,
  achieved_at date NOT NULL,
  value numeric,
  value_label text,
  notes text,
  cover_url text,
  done_recognition boolean NOT NULL DEFAULT false,
  done_symbol boolean NOT NULL DEFAULT false,
  done_prize boolean NOT NULL DEFAULT false,
  done_experience boolean NOT NULL DEFAULT false,
  done_post boolean NOT NULL DEFAULT false,
  done_status boolean NOT NULL DEFAULT false,
  auto_detected boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_milestones_client ON public.client_milestones(client_id, achieved_at DESC);
CREATE INDEX idx_client_milestones_account ON public.client_milestones(account_id);
-- Evita duplicar marcos automáticos do mesmo tipo no mesmo dia
CREATE UNIQUE INDEX uq_client_milestone_auto
  ON public.client_milestones(client_id, milestone_type, achieved_at)
  WHERE auto_detected = true;

ALTER TABLE public.client_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milestones_select_same_account" ON public.client_milestones
  FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "milestones_insert_same_account" ON public.client_milestones
  FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "milestones_update_same_account" ON public.client_milestones
  FOR UPDATE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "milestones_delete_same_account" ON public.client_milestones
  FOR DELETE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE TRIGGER trg_client_milestones_updated_at
  BEFORE UPDATE ON public.client_milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── client_ryka_stats ───
CREATE TABLE public.client_ryka_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  period_month date NOT NULL, -- sempre dia 01 do mês
  revenue_brl numeric NOT NULL DEFAULT 0,
  patients_count integer NOT NULL DEFAULT 0,
  raw_payload jsonb,
  source text NOT NULL DEFAULT 'clinica_ryka',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, period_month)
);

CREATE INDEX idx_ryka_stats_client ON public.client_ryka_stats(client_id, period_month DESC);

ALTER TABLE public.client_ryka_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ryka_stats_select_same_account" ON public.client_ryka_stats
  FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE TRIGGER trg_ryka_stats_updated_at
  BEFORE UPDATE ON public.client_ryka_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Função de detecção automática de marcos ───
CREATE OR REPLACE FUNCTION public.detect_client_milestones()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cumulative numeric;
  v_max_prev numeric;
  v_first_contract_date date;
  v_years int;
BEGIN
  -- 1º milhão acumulado
  SELECT COALESCE(SUM(revenue_brl), 0) INTO v_cumulative
  FROM public.client_ryka_stats
  WHERE client_id = NEW.client_id AND period_month <= NEW.period_month;

  IF v_cumulative >= 1000000 THEN
    INSERT INTO public.client_milestones
      (account_id, client_id, milestone_type, title, achieved_at, value, value_label, auto_detected)
    VALUES (
      NEW.account_id, NEW.client_id, 'first_million',
      'Primeiro milhão faturado',
      NEW.period_month,
      v_cumulative,
      'R$ ' || to_char(v_cumulative, 'FM999G999G999D00'),
      true
    )
    ON CONFLICT (client_id, milestone_type, achieved_at) WHERE auto_detected = true DO NOTHING;
  END IF;

  -- Mês recorde de faturamento
  SELECT COALESCE(MAX(revenue_brl), 0) INTO v_max_prev
  FROM public.client_ryka_stats
  WHERE client_id = NEW.client_id AND period_month < NEW.period_month;

  IF NEW.revenue_brl > v_max_prev AND v_max_prev > 0 THEN
    INSERT INTO public.client_milestones
      (account_id, client_id, milestone_type, title, achieved_at, value, value_label, auto_detected)
    VALUES (
      NEW.account_id, NEW.client_id, 'record_month',
      'Mês recorde de faturamento',
      NEW.period_month,
      NEW.revenue_brl,
      'R$ ' || to_char(NEW.revenue_brl, 'FM999G999G999D00'),
      true
    )
    ON CONFLICT (client_id, milestone_type, achieved_at) WHERE auto_detected = true DO NOTHING;
  END IF;

  -- 100 pacientes/mês
  IF NEW.patients_count >= 100 THEN
    INSERT INTO public.client_milestones
      (account_id, client_id, milestone_type, title, achieved_at, value, value_label, auto_detected)
    VALUES (
      NEW.account_id, NEW.client_id, 'hundred_patients_month',
      '100 pacientes em um mês',
      NEW.period_month,
      NEW.patients_count,
      NEW.patients_count || ' pacientes',
      true
    )
    ON CONFLICT (client_id, milestone_type, achieved_at) WHERE auto_detected = true DO NOTHING;
  END IF;

  -- 2 anos de permanência (a partir do primeiro contrato ativo)
  SELECT MIN(start_date) INTO v_first_contract_date
  FROM public.client_contracts
  WHERE client_id = NEW.client_id AND status IN ('active','paused','suspended');

  IF v_first_contract_date IS NOT NULL THEN
    v_years := EXTRACT(YEAR FROM AGE(NEW.period_month, v_first_contract_date));
    IF v_years >= 2 THEN
      INSERT INTO public.client_milestones
        (account_id, client_id, milestone_type, title, achieved_at, value, value_label, auto_detected)
      VALUES (
        NEW.account_id, NEW.client_id, 'two_years',
        v_years || ' anos de permanência',
        v_first_contract_date + (v_years || ' years')::interval,
        v_years,
        v_years || ' anos',
        true
      )
      ON CONFLICT (client_id, milestone_type, achieved_at) WHERE auto_detected = true DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_detect_client_milestones
  AFTER INSERT OR UPDATE ON public.client_ryka_stats
  FOR EACH ROW EXECUTE FUNCTION public.detect_client_milestones();
