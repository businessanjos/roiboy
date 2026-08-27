
CREATE TABLE public.zapp_ruler_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  sector_id text,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  default_auto_send boolean NOT NULL DEFAULT false,
  send_window_start integer NOT NULL DEFAULT 9,
  send_window_end integer NOT NULL DEFAULT 20,
  stop_on_reply boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.zapp_ruler_template_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.zapp_ruler_templates(id) ON DELETE CASCADE,
  offset_days integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.zapp_ruler_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  sector_id text,
  template_id uuid REFERENCES public.zapp_ruler_templates(id) ON DELETE SET NULL,
  template_name text,
  conversation_id uuid REFERENCES public.zapp_conversations(id) ON DELETE SET NULL,
  client_id uuid,
  lead_id uuid,
  deal_id uuid,
  integration_id uuid,
  contact_name text,
  contact_phone text NOT NULL,
  assigned_to uuid,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  due_time time NOT NULL DEFAULT '09:00',
  auto_send boolean NOT NULL DEFAULT false,
  send_window_start integer NOT NULL DEFAULT 9,
  send_window_end integer NOT NULL DEFAULT 20,
  stop_on_reply boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active',
  cancel_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.zapp_ruler_touches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  enrollment_id uuid NOT NULL REFERENCES public.zapp_ruler_enrollments(id) ON DELETE CASCADE,
  offset_days integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  scheduled_at timestamptz NOT NULL,
  auto_send boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  sent_by uuid,
  external_message_id text,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_zapp_ruler_templates_account ON public.zapp_ruler_templates(account_id, sector_id);
CREATE INDEX idx_zapp_ruler_template_steps_tpl ON public.zapp_ruler_template_steps(template_id, sort_order);
CREATE INDEX idx_zapp_ruler_enrollments_account ON public.zapp_ruler_enrollments(account_id, sector_id, status);
CREATE INDEX idx_zapp_ruler_enrollments_conv ON public.zapp_ruler_enrollments(conversation_id);
CREATE INDEX idx_zapp_ruler_touches_due ON public.zapp_ruler_touches(status, scheduled_at);
CREATE INDEX idx_zapp_ruler_touches_enrollment ON public.zapp_ruler_touches(enrollment_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zapp_ruler_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zapp_ruler_template_steps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zapp_ruler_enrollments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zapp_ruler_touches TO authenticated;
GRANT ALL ON public.zapp_ruler_templates TO service_role;
GRANT ALL ON public.zapp_ruler_template_steps TO service_role;
GRANT ALL ON public.zapp_ruler_enrollments TO service_role;
GRANT ALL ON public.zapp_ruler_touches TO service_role;

ALTER TABLE public.zapp_ruler_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapp_ruler_template_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapp_ruler_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapp_ruler_touches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account users manage ruler templates"
ON public.zapp_ruler_templates FOR ALL TO authenticated
USING (account_id = public.get_current_user_account_id()
  AND (sector_id IS NULL OR public.user_has_sector_access(auth.uid(), sector_id)))
WITH CHECK (account_id = public.get_current_user_account_id()
  AND (sector_id IS NULL OR public.user_has_sector_access(auth.uid(), sector_id)));

CREATE POLICY "Account users manage ruler template steps"
ON public.zapp_ruler_template_steps FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.zapp_ruler_templates t
  WHERE t.id = template_id AND t.account_id = public.get_current_user_account_id()))
WITH CHECK (EXISTS (SELECT 1 FROM public.zapp_ruler_templates t
  WHERE t.id = template_id AND t.account_id = public.get_current_user_account_id()));

CREATE POLICY "Account users manage ruler enrollments"
ON public.zapp_ruler_enrollments FOR ALL TO authenticated
USING (account_id = public.get_current_user_account_id()
  AND (sector_id IS NULL OR public.user_has_sector_access(auth.uid(), sector_id)))
WITH CHECK (account_id = public.get_current_user_account_id()
  AND (sector_id IS NULL OR public.user_has_sector_access(auth.uid(), sector_id)));

CREATE POLICY "Account users manage ruler touches"
ON public.zapp_ruler_touches FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.zapp_ruler_enrollments e
  WHERE e.id = enrollment_id
    AND e.account_id = public.get_current_user_account_id()
    AND (e.sector_id IS NULL OR public.user_has_sector_access(auth.uid(), e.sector_id))))
WITH CHECK (EXISTS (SELECT 1 FROM public.zapp_ruler_enrollments e
  WHERE e.id = enrollment_id
    AND e.account_id = public.get_current_user_account_id()
    AND (e.sector_id IS NULL OR public.user_has_sector_access(auth.uid(), e.sector_id))));

CREATE TRIGGER trg_zapp_ruler_templates_updated BEFORE UPDATE ON public.zapp_ruler_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_zapp_ruler_template_steps_updated BEFORE UPDATE ON public.zapp_ruler_template_steps
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_zapp_ruler_enrollments_updated BEFORE UPDATE ON public.zapp_ruler_enrollments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_zapp_ruler_touches_updated BEFORE UPDATE ON public.zapp_ruler_touches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reserva atômica dos toques prontos para envio automático
CREATE OR REPLACE FUNCTION public.claim_zapp_ruler_touches(p_limit integer DEFAULT 50)
RETURNS SETOF public.zapp_ruler_touches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.zapp_ruler_touches t
     SET claimed_at = now(),
         attempts = t.attempts + 1,
         updated_at = now()
   WHERE t.id IN (
     SELECT tt.id
       FROM public.zapp_ruler_touches tt
       JOIN public.zapp_ruler_enrollments e ON e.id = tt.enrollment_id
      WHERE tt.status = 'pending'
        AND tt.auto_send = true
        AND tt.scheduled_at <= now()
        AND tt.attempts < 5
        AND e.status = 'active'
      ORDER BY tt.scheduled_at
      LIMIT p_limit
      FOR UPDATE OF tt SKIP LOCKED
   )
  RETURNING t.*;
END;
$$;

-- Encerra a régua quando todos os toques saíram da fila
CREATE OR REPLACE FUNCTION public.complete_zapp_ruler_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'pending' AND NOT EXISTS (
    SELECT 1 FROM public.zapp_ruler_touches
     WHERE enrollment_id = NEW.enrollment_id AND status = 'pending'
  ) THEN
    UPDATE public.zapp_ruler_enrollments
       SET status = 'completed', updated_at = now()
     WHERE id = NEW.enrollment_id AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_complete_zapp_ruler_enrollment
AFTER UPDATE OF status ON public.zapp_ruler_touches
FOR EACH ROW EXECUTE FUNCTION public.complete_zapp_ruler_enrollment();
