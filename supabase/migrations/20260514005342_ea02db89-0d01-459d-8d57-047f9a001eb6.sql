
ALTER TABLE public.client_stages
  ADD COLUMN IF NOT EXISTS sla_hours INTEGER,
  ADD COLUMN IF NOT EXISTS description TEXT;

UPDATE public.client_stages SET sla_hours = 24,  description = 'Consultor faz contato inicial e apresenta a metodologia.' WHERE display_order = 0;
UPDATE public.client_stages SET sla_hours = 48,  description = 'Cliente completa cadastro empresarial (CNPJ, dados, contatos).' WHERE display_order = 1;
UPDATE public.client_stages SET sla_hours = 48,  description = 'Coletar relatório de vendas dos últimos 12 meses.' WHERE display_order = 2;
UPDATE public.client_stages SET sla_hours = 72,  description = 'Onboarding agendado no calendário.' WHERE display_order = 3;
UPDATE public.client_stages SET sla_hours = 120, description = 'Reunião de onboarding com consultor realizada.' WHERE display_order = 4;
UPDATE public.client_stages SET sla_hours = 24,  description = 'Cliente adicionado ao grupo do WhatsApp e recebeu boas-vindas.' WHERE display_order = 5;
UPDATE public.client_stages SET sla_hours = 48,  description = 'Acesso à plataforma de metodologia liberado.' WHERE display_order = 6;
UPDATE public.client_stages SET sla_hours = 72,  description = 'Onboarding de ferramentas agendado.' WHERE display_order = 7;
UPDATE public.client_stages SET sla_hours = 120, description = 'Treinamento de ferramentas concluído.' WHERE display_order = 8;
UPDATE public.client_stages SET sla_hours = NULL, description = 'Plano de Ação 1 entregue ao cliente.' WHERE display_order = 9;
UPDATE public.client_stages SET sla_hours = NULL, description = 'Plano de Ação 3 entregue ao cliente.' WHERE display_order = 10;
UPDATE public.client_stages SET sla_hours = 24,  description = 'CX cadastrado e responsável pelo acompanhamento contínuo.' WHERE display_order = 11;
UPDATE public.client_stages SET sla_hours = NULL, description = 'Plano de Ação 2 entregue ao cliente.' WHERE display_order = 12;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS onboarding_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_next_step TEXT,
  ADD COLUMN IF NOT EXISTS ai_next_step_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.update_client_stage_changed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.stage_id IS NOT NULL AND NEW.stage_changed_at IS NULL THEN
      NEW.stage_changed_at := now();
    END IF;
    IF NEW.stage_id IS NOT NULL AND NEW.onboarding_started_at IS NULL THEN
      NEW.onboarding_started_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
      NEW.stage_changed_at := now();
      IF NEW.onboarding_started_at IS NULL AND NEW.stage_id IS NOT NULL THEN
        NEW.onboarding_started_at := now();
      END IF;
      NEW.ai_next_step := NULL;
      NEW.ai_next_step_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clients_stage_changed_at ON public.clients;
CREATE TRIGGER trg_clients_stage_changed_at
  BEFORE INSERT OR UPDATE OF stage_id ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_client_stage_changed_at();

UPDATE public.clients
SET stage_changed_at = created_at
WHERE stage_changed_at IS NULL AND stage_id IS NOT NULL;

UPDATE public.clients
SET onboarding_started_at = created_at
WHERE onboarding_started_at IS NULL AND stage_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_stage_id_account ON public.clients(account_id, stage_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_clients_stage_changed_at ON public.clients(stage_changed_at) WHERE status = 'active';
