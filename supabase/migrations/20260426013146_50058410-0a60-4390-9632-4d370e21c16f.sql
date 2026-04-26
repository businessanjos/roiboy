-- Briefing operacional estruturado (preenchido pelo comercial, consumido pela operação)
CREATE TABLE public.deal_operation_briefings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,

  -- Campos exatos do print
  tempo_atuacao TEXT,
  ja_fez_mentoria TEXT,
  conhece_cliente_nossa TEXT,
  ultimos_faturamentos TEXT,
  ticket_medio NUMERIC,
  margem_lucro TEXT,
  horas_atende_dia TEXT,
  foco_atuacao TEXT,
  objetivo_mentoria TEXT,
  cidade TEXT,
  estrutura_clinica TEXT,
  numero_funcionarios TEXT,
  meta_faturamento NUMERIC,
  especialidade TEXT,
  da_aulas BOOLEAN,
  dias_atende_semana TEXT,
  trafego_investimento TEXT,
  da_cursos BOOLEAN,
  tem_caixa TEXT,
  equipamentos TEXT,
  observacoes TEXT,

  is_complete BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.users(id),

  CONSTRAINT briefing_has_target CHECK (deal_id IS NOT NULL OR client_id IS NOT NULL)
);

CREATE UNIQUE INDEX deal_operation_briefings_deal_unique
  ON public.deal_operation_briefings(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX deal_operation_briefings_client_idx
  ON public.deal_operation_briefings(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX deal_operation_briefings_account_idx
  ON public.deal_operation_briefings(account_id);

ALTER TABLE public.deal_operation_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view briefings of their account"
  ON public.deal_operation_briefings FOR SELECT
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert briefings of their account"
  ON public.deal_operation_briefings FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update briefings of their account"
  ON public.deal_operation_briefings FOR UPDATE
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete briefings of their account"
  ON public.deal_operation_briefings FOR DELETE
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE TRIGGER update_deal_operation_briefings_updated_at
  BEFORE UPDATE ON public.deal_operation_briefings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();