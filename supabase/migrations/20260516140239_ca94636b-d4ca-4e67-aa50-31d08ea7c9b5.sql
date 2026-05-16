
CREATE TABLE IF NOT EXISTS public.dunning_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  installment_id uuid NOT NULL REFERENCES public.installments(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  stage text NOT NULL DEFAULT 'a_vencer'
    CHECK (stage IN ('a_vencer','vencida','negociando','promessa','quebrou','judicial','recuperada','perdida')),
  assigned_to uuid,
  sla_due_at timestamptz,
  promise_date date,
  promise_amount numeric(14,2),
  last_contact_at timestamptz,
  notes text,
  closed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (installment_id)
);

CREATE INDEX IF NOT EXISTS idx_dunning_cases_account ON public.dunning_cases(account_id);
CREATE INDEX IF NOT EXISTS idx_dunning_cases_stage ON public.dunning_cases(account_id, stage);
CREATE INDEX IF NOT EXISTS idx_dunning_cases_assigned ON public.dunning_cases(assigned_to);
CREATE INDEX IF NOT EXISTS idx_dunning_cases_sla ON public.dunning_cases(sla_due_at);

ALTER TABLE public.dunning_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view dunning cases in their account"
  ON public.dunning_cases FOR SELECT
  USING (account_id = get_user_account_id());
CREATE POLICY "Users insert dunning cases in their account"
  ON public.dunning_cases FOR INSERT
  WITH CHECK (account_id = get_user_account_id());
CREATE POLICY "Users update dunning cases in their account"
  ON public.dunning_cases FOR UPDATE
  USING (account_id = get_user_account_id());
CREATE POLICY "Users delete dunning cases in their account"
  ON public.dunning_cases FOR DELETE
  USING (account_id = get_user_account_id());

CREATE TABLE IF NOT EXISTS public.dunning_case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.dunning_cases(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  event_type text NOT NULL
    CHECK (event_type IN ('stage_change','contact','promise','note','assigned','sla_set','auto')),
  from_stage text,
  to_stage text,
  description text,
  metadata jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dunning_events_case ON public.dunning_case_events(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dunning_events_account ON public.dunning_case_events(account_id);

ALTER TABLE public.dunning_case_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view dunning events in their account"
  ON public.dunning_case_events FOR SELECT
  USING (account_id = get_user_account_id());
CREATE POLICY "Users insert dunning events in their account"
  ON public.dunning_case_events FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

-- Default SLA per stage (in days from "now")
CREATE OR REPLACE FUNCTION public.dunning_default_sla(p_stage text)
RETURNS interval
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_stage
    WHEN 'a_vencer'  THEN interval '7 days'
    WHEN 'vencida'   THEN interval '1 day'
    WHEN 'negociando'THEN interval '2 days'
    WHEN 'promessa'  THEN interval '3 days'
    WHEN 'quebrou'   THEN interval '1 day'
    WHEN 'judicial'  THEN interval '15 days'
    ELSE NULL
  END;
$$;

-- Log stage changes and auto-set SLA / closed_at
CREATE OR REPLACE FUNCTION public.handle_dunning_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.sla_due_at IS NULL AND public.dunning_default_sla(NEW.stage) IS NOT NULL THEN
      NEW.sla_due_at := now() + public.dunning_default_sla(NEW.stage);
    END IF;
    IF NEW.stage IN ('recuperada','perdida') AND NEW.closed_at IS NULL THEN
      NEW.closed_at := now();
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    IF public.dunning_default_sla(NEW.stage) IS NOT NULL THEN
      NEW.sla_due_at := now() + public.dunning_default_sla(NEW.stage);
    ELSE
      NEW.sla_due_at := NULL;
    END IF;
    IF NEW.stage IN ('recuperada','perdida') THEN
      NEW.closed_at := COALESCE(NEW.closed_at, now());
    ELSE
      NEW.closed_at := NULL;
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dunning_stage_change ON public.dunning_cases;
CREATE TRIGGER trg_dunning_stage_change
BEFORE INSERT OR UPDATE OF stage ON public.dunning_cases
FOR EACH ROW EXECUTE FUNCTION public.handle_dunning_stage_change();

-- Log events after stage change
CREATE OR REPLACE FUNCTION public.log_dunning_stage_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.dunning_case_events(case_id, account_id, event_type, to_stage, description, created_by)
    VALUES (NEW.id, NEW.account_id, 'stage_change', NEW.stage, 'Caso criado', NEW.created_by);
  ELSIF TG_OP = 'UPDATE' AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO public.dunning_case_events(case_id, account_id, event_type, from_stage, to_stage, description)
    VALUES (NEW.id, NEW.account_id, 'stage_change', OLD.stage, NEW.stage, 'Etapa alterada');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_dunning_stage_event ON public.dunning_cases;
CREATE TRIGGER trg_log_dunning_stage_event
AFTER INSERT OR UPDATE OF stage ON public.dunning_cases
FOR EACH ROW EXECUTE FUNCTION public.log_dunning_stage_event();

-- When installment is paid → close case as recuperada
CREATE OR REPLACE FUNCTION public.close_dunning_on_installment_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.dunning_cases
    SET stage = 'recuperada'
    WHERE installment_id = NEW.id
      AND stage NOT IN ('recuperada','perdida');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_dunning_on_installment_paid ON public.installments;
CREATE TRIGGER trg_close_dunning_on_installment_paid
AFTER UPDATE OF status ON public.installments
FOR EACH ROW EXECUTE FUNCTION public.close_dunning_on_installment_paid();

CREATE OR REPLACE FUNCTION public.update_dunning_cases_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_dunning_updated_at ON public.dunning_cases;
CREATE TRIGGER trg_dunning_updated_at
BEFORE UPDATE ON public.dunning_cases
FOR EACH ROW EXECUTE FUNCTION public.update_dunning_cases_updated_at();

-- RPC: generate cases for overdue / about-to-expire installments
CREATE OR REPLACE FUNCTION public.generate_dunning_cases(p_account_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_account_id IS NULL OR p_account_id <> get_user_account_id() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  WITH candidates AS (
    SELECT i.id AS installment_id,
           inv.client_id,
           CASE
             WHEN i.due_date < CURRENT_DATE THEN 'vencida'
             ELSE 'a_vencer'
           END AS stage
    FROM public.installments i
    JOIN public.invoices inv ON inv.id = i.invoice_id
    WHERE i.account_id = p_account_id
      AND i.status NOT IN ('paid','cancelled','renegotiated')
      AND i.due_date <= CURRENT_DATE + interval '7 days'
      AND NOT EXISTS (SELECT 1 FROM public.dunning_cases dc WHERE dc.installment_id = i.id)
  )
  INSERT INTO public.dunning_cases (account_id, installment_id, client_id, stage)
  SELECT p_account_id, c.installment_id, c.client_id, c.stage FROM candidates c;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
