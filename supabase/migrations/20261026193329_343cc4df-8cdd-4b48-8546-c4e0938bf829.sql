CREATE TABLE public.sales_transfer_whatsapp_settings (
  account_id uuid PRIMARY KEY,
  notify_private boolean NOT NULL DEFAULT false,
  notify_group boolean NOT NULL DEFAULT false,
  group_jid text,
  group_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sales_transfer_whatsapp_settings TO authenticated;
GRANT ALL ON public.sales_transfer_whatsapp_settings TO service_role;
ALTER TABLE public.sales_transfer_whatsapp_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers manage transfer whatsapp settings" ON public.sales_transfer_whatsapp_settings
  FOR ALL TO authenticated
  USING (account_id = public.get_current_user_account_id() AND public.can_manage_spiff_payments(auth.uid()))
  WITH CHECK (account_id = public.get_current_user_account_id() AND public.can_manage_spiff_payments(auth.uid()));

CREATE TABLE public.sales_user_whatsapp_phones (
  user_id uuid PRIMARY KEY,
  account_id uuid NOT NULL,
  phone_e164 text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_user_whatsapp_phones TO authenticated;
GRANT ALL ON public.sales_user_whatsapp_phones TO service_role;
ALTER TABLE public.sales_user_whatsapp_phones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers manage seller phones" ON public.sales_user_whatsapp_phones
  FOR ALL TO authenticated
  USING (account_id = public.get_current_user_account_id() AND public.can_manage_spiff_payments(auth.uid()))
  WITH CHECK (account_id = public.get_current_user_account_id() AND public.can_manage_spiff_payments(auth.uid()));

CREATE TABLE public.transfer_whatsapp_sends (
  notification_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  result jsonb
);
GRANT ALL ON public.transfer_whatsapp_sends TO service_role;
ALTER TABLE public.transfer_whatsapp_sends ENABLE ROW LEVEL SECURITY;

-- Aviso no sistema quando o lead muda de responsável
CREATE OR REPLACE FUNCTION public.notify_lead_owner_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_actor uuid; v_actor_name text;
BEGIN
  IF NEW.responsible_user_id IS NULL OR NEW.responsible_user_id IS NOT DISTINCT FROM OLD.responsible_user_id THEN RETURN NEW; END IF;
  SELECT id, name INTO v_actor, v_actor_name FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_actor IS NOT NULL AND v_actor = NEW.responsible_user_id THEN RETURN NEW; END IF;
  INSERT INTO public.notifications(account_id,user_id,type,title,content,link,source_type,source_id,triggered_by_user_id,sector_id)
  VALUES (NEW.account_id, NEW.responsible_user_id, 'lead_transferred', 'Lead transferido para você',
    '"' || COALESCE(NEW.full_name,'Lead') || '" foi transferido para você' || COALESCE(' por ' || v_actor_name, ''),
    '/leads?lead=' || NEW.id, 'lead', NEW.id, v_actor, 'vendas');
  RETURN NEW;
EXCEPTION WHEN others THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_lead_owner_change ON public.leads;
CREATE TRIGGER trg_notify_lead_owner_change AFTER UPDATE OF responsible_user_id ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.notify_lead_owner_change();

-- Dispara o aviso no WhatsApp a partir da notificação
CREATE OR REPLACE FUNCTION public.dispatch_transfer_whatsapp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.type NOT IN ('deal_transferred','lead_transferred') THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sales_transfer_whatsapp_settings s
                 WHERE s.account_id = NEW.account_id AND (s.notify_private OR s.notify_group)) THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url := 'https://mtzoavtbtqflufyccern.supabase.co/functions/v1/transfer-whatsapp-notify',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10em9hdnRidHFmbHVmeWNjZXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDQ2MDYsImV4cCI6MjA4MTQyMDYwNn0.aFVdVFXwpE7iU7G_u-Ehh-FBFxH32fHiZVo8-RzRGUA'),
    body := jsonb_build_object('notification_id', NEW.id));
  RETURN NEW;
EXCEPTION WHEN others THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_dispatch_transfer_whatsapp ON public.notifications;
CREATE TRIGGER trg_dispatch_transfer_whatsapp AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_transfer_whatsapp();