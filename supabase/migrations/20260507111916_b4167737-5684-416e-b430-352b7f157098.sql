
-- =========================================================
-- FASE 2: Contas a Receber (invoices, installments, events)
-- =========================================================

-- invoices
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT,
  deal_id UUID,
  contract_id UUID,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  payer_id UUID NOT NULL REFERENCES public.payers(id) ON DELETE RESTRICT,
  product_id UUID,
  description TEXT,
  total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  service_pct NUMERIC(5,2) NOT NULL DEFAULT 70.00,
  product_pct NUMERIC(5,2) NOT NULL DEFAULT 30.00,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','renegotiated','settled','written_off','judicial')),
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  parent_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invoices_split_check CHECK (service_pct + product_pct = 100)
);
CREATE INDEX idx_invoices_account ON public.invoices(account_id);
CREATE INDEX idx_invoices_company ON public.invoices(company_id);
CREATE INDEX idx_invoices_client ON public.invoices(client_id);
CREATE INDEX idx_invoices_payer ON public.invoices(payer_id);
CREATE INDEX idx_invoices_deal ON public.invoices(deal_id);
CREATE INDEX idx_invoices_parent ON public.invoices(parent_invoice_id);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view invoices in their account" ON public.invoices
  FOR SELECT TO authenticated USING (account_id = public.get_user_account_id());
CREATE POLICY "Users insert invoices in their account" ON public.invoices
  FOR INSERT TO authenticated WITH CHECK (account_id = public.get_user_account_id());
CREATE POLICY "Users update invoices in their account" ON public.invoices
  FOR UPDATE TO authenticated USING (account_id = public.get_user_account_id());
CREATE POLICY "Users delete invoices in their account" ON public.invoices
  FOR DELETE TO authenticated USING (account_id = public.get_user_account_id());

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- installments
CREATE TABLE public.installments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  number INTEGER NOT NULL CHECK (number >= 1),
  due_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  payment_method TEXT NOT NULL
    CHECK (payment_method IN ('cash','pix','boleto','credit_card','check','transfer','platform','other')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','scheduled','paid','overdue','renegotiated','written_off','judicial','refunded','partial')),
  check_status TEXT
    CHECK (check_status IS NULL OR check_status IN ('requested','in_transit','received','deposited','cleared','bounced','renegotiated')),
  card_status TEXT
    CHECK (card_status IS NULL OR card_status IN ('charged','failed','refunded')),
  paid_at TIMESTAMPTZ,
  paid_amount NUMERIC(14,2),
  fees NUMERIC(14,2),
  discount NUMERIC(14,2),
  notes TEXT,
  locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT installments_unique_number UNIQUE (invoice_id, number)
);
CREATE INDEX idx_installments_account ON public.installments(account_id);
CREATE INDEX idx_installments_invoice ON public.installments(invoice_id);
CREATE INDEX idx_installments_due_date ON public.installments(due_date);
CREATE INDEX idx_installments_status ON public.installments(status);

ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view installments in their account" ON public.installments
  FOR SELECT TO authenticated USING (account_id = public.get_user_account_id());
CREATE POLICY "Users insert installments in their account" ON public.installments
  FOR INSERT TO authenticated WITH CHECK (account_id = public.get_user_account_id());
CREATE POLICY "Users update installments in their account" ON public.installments
  FOR UPDATE TO authenticated USING (account_id = public.get_user_account_id());
CREATE POLICY "Users delete installments in their account" ON public.installments
  FOR DELETE TO authenticated USING (account_id = public.get_user_account_id());

CREATE TRIGGER update_installments_updated_at BEFORE UPDATE ON public.installments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- installment_events (histórico imutável)
CREATE TABLE public.installment_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  installment_id UUID NOT NULL REFERENCES public.installments(id) ON DELETE RESTRICT,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'note','charge_attempt','message_sent','promise','renegotiation','dispute',
      'judicial','bounce','partial_payment','full_payment','discount','write_off',
      'status_change','check_status_change','card_status_change','lock','unlock','system'
    )),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  visible_to TEXT NOT NULL DEFAULT 'all'
    CHECK (visible_to IN ('sales','ops','finance','all')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inst_events_account ON public.installment_events(account_id);
CREATE INDEX idx_inst_events_installment ON public.installment_events(installment_id);
CREATE INDEX idx_inst_events_invoice ON public.installment_events(invoice_id);
CREATE INDEX idx_inst_events_type ON public.installment_events(event_type);
CREATE INDEX idx_inst_events_created ON public.installment_events(created_at DESC);

ALTER TABLE public.installment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view installment events in their account" ON public.installment_events
  FOR SELECT TO authenticated USING (account_id = public.get_user_account_id());
CREATE POLICY "Users insert installment events in their account" ON public.installment_events
  FOR INSERT TO authenticated WITH CHECK (account_id = public.get_user_account_id());
-- Sem políticas de UPDATE/DELETE → eventos são imutáveis.

-- =========================================================
-- IMUTABILIDADE: triggers de proteção
-- =========================================================

-- 1) Bloquear UPDATE de campos críticos quando locked=true em invoices
CREATE OR REPLACE FUNCTION public.invoices_enforce_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Permite destravar explicitamente (locked false → true ou true → false vem de função admin)
  IF OLD.locked = true THEN
    -- Campos imutáveis após lock
    IF (NEW.total_amount IS DISTINCT FROM OLD.total_amount) THEN
      RAISE EXCEPTION 'Não é permitido alterar total_amount em fatura travada (id=%). Crie uma renegociação.', OLD.id;
    END IF;
    IF (NEW.client_id IS DISTINCT FROM OLD.client_id) THEN
      RAISE EXCEPTION 'Não é permitido alterar client_id em fatura travada (id=%).', OLD.id;
    END IF;
    IF (NEW.payer_id IS DISTINCT FROM OLD.payer_id) THEN
      RAISE EXCEPTION 'Não é permitido alterar payer_id em fatura travada (id=%).', OLD.id;
    END IF;
    IF (NEW.opened_at IS DISTINCT FROM OLD.opened_at) THEN
      RAISE EXCEPTION 'Não é permitido alterar opened_at em fatura travada (id=%).', OLD.id;
    END IF;
    IF (NEW.service_pct IS DISTINCT FROM OLD.service_pct
        OR NEW.product_pct IS DISTINCT FROM OLD.product_pct) THEN
      RAISE EXCEPTION 'Não é permitido alterar split serviço/produto em fatura travada (id=%).', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER invoices_immutability_check
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoices_enforce_immutability();

-- 2) Bloquear DELETE em invoices travadas
CREATE OR REPLACE FUNCTION public.invoices_block_delete_locked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.locked = true THEN
    RAISE EXCEPTION 'Fatura travada não pode ser deletada (id=%). Use status=written_off ou renegotiated.', OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER invoices_block_delete_locked
  BEFORE DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoices_block_delete_locked();

-- 3) Bloquear UPDATE de campos críticos em installments travadas
CREATE OR REPLACE FUNCTION public.installments_enforce_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.locked = true THEN
    IF (NEW.amount IS DISTINCT FROM OLD.amount) THEN
      RAISE EXCEPTION 'Não é permitido alterar valor (amount) em parcela travada (id=%).', OLD.id;
    END IF;
    IF (NEW.due_date IS DISTINCT FROM OLD.due_date) THEN
      RAISE EXCEPTION 'Não é permitido alterar due_date em parcela travada (id=%).', OLD.id;
    END IF;
    IF (NEW.number IS DISTINCT FROM OLD.number) THEN
      RAISE EXCEPTION 'Não é permitido alterar número em parcela travada (id=%).', OLD.id;
    END IF;
    IF (NEW.payment_method IS DISTINCT FROM OLD.payment_method) THEN
      RAISE EXCEPTION 'Não é permitido alterar payment_method em parcela travada (id=%).', OLD.id;
    END IF;
    IF (NEW.invoice_id IS DISTINCT FROM OLD.invoice_id) THEN
      RAISE EXCEPTION 'Não é permitido alterar invoice_id em parcela travada (id=%).', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER installments_immutability_check
  BEFORE UPDATE ON public.installments
  FOR EACH ROW EXECUTE FUNCTION public.installments_enforce_immutability();

-- 4) Bloquear DELETE em installments travadas
CREATE OR REPLACE FUNCTION public.installments_block_delete_locked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.locked = true THEN
    RAISE EXCEPTION 'Parcela travada não pode ser deletada (id=%). Use status=written_off, renegotiated ou refunded.', OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER installments_block_delete_locked
  BEFORE DELETE ON public.installments
  FOR EACH ROW EXECUTE FUNCTION public.installments_block_delete_locked();

-- 5) Auto-lock no primeiro recebimento + auto-evento de status
CREATE OR REPLACE FUNCTION public.installments_auto_lock_and_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_locked BOOLEAN;
BEGIN
  -- Auto-lock quando vira paid pela primeira vez
  IF (TG_OP = 'UPDATE' AND OLD.status <> 'paid' AND NEW.status = 'paid' AND NEW.locked = false) THEN
    NEW.locked := true;
    NEW.locked_at := now();
    IF NEW.paid_at IS NULL THEN
      NEW.paid_at := now();
    END IF;

    -- Trava a fatura também se ainda não estava travada
    SELECT locked INTO v_invoice_locked FROM public.invoices WHERE id = NEW.invoice_id;
    IF v_invoice_locked = false THEN
      UPDATE public.invoices
        SET locked = true, locked_at = now(), status = 'active'
        WHERE id = NEW.invoice_id AND locked = false;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER installments_auto_lock
  BEFORE UPDATE ON public.installments
  FOR EACH ROW EXECUTE FUNCTION public.installments_auto_lock_and_event();

-- 6) Após mudança de status/cheque/cartão → registra evento automático (AFTER trigger)
CREATE OR REPLACE FUNCTION public.installments_log_change_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();

  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.installment_events (account_id, installment_id, invoice_id, event_type, payload, created_by)
    VALUES (NEW.account_id, NEW.id, NEW.invoice_id, 'system',
      jsonb_build_object('action','created','status',NEW.status,'amount',NEW.amount,'due_date',NEW.due_date), v_uid);
    RETURN NEW;
  END IF;

  IF (NEW.status IS DISTINCT FROM OLD.status) THEN
    INSERT INTO public.installment_events (account_id, installment_id, invoice_id, event_type, payload, created_by)
    VALUES (NEW.account_id, NEW.id, NEW.invoice_id, 'status_change',
      jsonb_build_object('from',OLD.status,'to',NEW.status), v_uid);
  END IF;
  IF (NEW.check_status IS DISTINCT FROM OLD.check_status) THEN
    INSERT INTO public.installment_events (account_id, installment_id, invoice_id, event_type, payload, created_by)
    VALUES (NEW.account_id, NEW.id, NEW.invoice_id, 'check_status_change',
      jsonb_build_object('from',OLD.check_status,'to',NEW.check_status), v_uid);
  END IF;
  IF (NEW.card_status IS DISTINCT FROM OLD.card_status) THEN
    INSERT INTO public.installment_events (account_id, installment_id, invoice_id, event_type, payload, created_by)
    VALUES (NEW.account_id, NEW.id, NEW.invoice_id, 'card_status_change',
      jsonb_build_object('from',OLD.card_status,'to',NEW.card_status), v_uid);
  END IF;
  IF (NEW.locked IS DISTINCT FROM OLD.locked) THEN
    INSERT INTO public.installment_events (account_id, installment_id, invoice_id, event_type, payload, created_by)
    VALUES (NEW.account_id, NEW.id, NEW.invoice_id,
      CASE WHEN NEW.locked THEN 'lock' ELSE 'unlock' END,
      jsonb_build_object('locked_at',NEW.locked_at), v_uid);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER installments_log_event_insert
  AFTER INSERT ON public.installments
  FOR EACH ROW EXECUTE FUNCTION public.installments_log_change_event();

CREATE TRIGGER installments_log_event_update
  AFTER UPDATE ON public.installments
  FOR EACH ROW EXECUTE FUNCTION public.installments_log_change_event();
