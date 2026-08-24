CREATE TABLE public.client_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NULL,
  happened_at timestamptz NOT NULL DEFAULT now(),
  initiated_by text NOT NULL DEFAULT 'consultor' CHECK (initiated_by IN ('consultor','cliente')),
  channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','ligacao','reuniao','presencial','email','outro')),
  kind text NOT NULL DEFAULT 'contato' CHECK (kind IN ('checkpoint','contato')),
  summary text NOT NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','ai_whatsapp')),
  message_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_checkins TO authenticated;
GRANT ALL ON public.client_checkins TO service_role;

ALTER TABLE public.client_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkins_select_account" ON public.client_checkins
  FOR SELECT TO authenticated
  USING (account_id = public.get_current_user_account_id());

CREATE POLICY "checkins_insert_account" ON public.client_checkins
  FOR INSERT TO authenticated
  WITH CHECK (account_id = public.get_current_user_account_id());

CREATE POLICY "checkins_update_own" ON public.client_checkins
  FOR UPDATE TO authenticated
  USING (account_id = public.get_current_user_account_id() AND user_id = public.get_current_user_id())
  WITH CHECK (account_id = public.get_current_user_account_id());

CREATE POLICY "checkins_delete_own" ON public.client_checkins
  FOR DELETE TO authenticated
  USING (account_id = public.get_current_user_account_id() AND user_id = public.get_current_user_id());

CREATE INDEX idx_client_checkins_client_date ON public.client_checkins (client_id, happened_at DESC);
CREATE INDEX idx_client_checkins_account_date ON public.client_checkins (account_id, happened_at DESC);
CREATE UNIQUE INDEX uniq_client_checkins_ai_daily
  ON public.client_checkins (client_id, (((happened_at AT TIME ZONE 'America/Sao_Paulo'))::date))
  WHERE source = 'ai_whatsapp';

CREATE TRIGGER trg_client_checkins_updated_at
  BEFORE UPDATE ON public.client_checkins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();