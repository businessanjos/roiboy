CREATE TABLE public.zapp_group_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES public.zapp_conversations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'auto',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, client_id)
);
CREATE INDEX idx_zapp_group_clients_client ON public.zapp_group_clients(client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zapp_group_clients TO authenticated;
GRANT ALL ON public.zapp_group_clients TO service_role;
ALTER TABLE public.zapp_group_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zgc_select" ON public.zapp_group_clients FOR SELECT TO authenticated USING (account_id = public.get_user_account_id());
CREATE POLICY "zgc_insert" ON public.zapp_group_clients FOR INSERT TO authenticated WITH CHECK (account_id = public.get_user_account_id());
CREATE POLICY "zgc_delete" ON public.zapp_group_clients FOR DELETE TO authenticated USING (account_id = public.get_user_account_id());

CREATE OR REPLACE FUNCTION public.zapp_norm_phone(p text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN d LIKE '55%' AND length(d) = 13 THEN substr(d,1,4) || substr(d,6) ELSE d END
  FROM (SELECT regexp_replace(coalesce(p,''), '\D', '', 'g') AS d) x
$$;

CREATE OR REPLACE FUNCTION public.zapp_link_group_sender() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_acc uuid; v_group boolean; v_norm text;
BEGIN
  IF NEW.sender_phone IS NULL OR NEW.sender_phone = '' THEN RETURN NEW; END IF;
  SELECT account_id, is_group INTO v_acc, v_group FROM zapp_conversations WHERE id = NEW.zapp_conversation_id;
  IF NOT coalesce(v_group,false) THEN RETURN NEW; END IF;
  v_norm := zapp_norm_phone(NEW.sender_phone);
  IF length(v_norm) < 10 THEN RETURN NEW; END IF;
  INSERT INTO zapp_group_clients(account_id, conversation_id, client_id, source)
  SELECT v_acc, NEW.zapp_conversation_id, c.id, 'auto' FROM clients c
  WHERE c.account_id = v_acc AND (zapp_norm_phone(c.phone_e164) = v_norm
     OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(c.additional_phones)='array' THEN c.additional_phones ELSE '[]'::jsonb END) ap WHERE zapp_norm_phone(ap) = v_norm))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

CREATE TRIGGER trg_zapp_link_group_sender AFTER INSERT ON public.zapp_messages FOR EACH ROW EXECUTE FUNCTION public.zapp_link_group_sender();

INSERT INTO public.zapp_group_clients(account_id, conversation_id, client_id, source)
SELECT DISTINCT zc.account_id, zc.id, c.id, 'auto'
FROM (SELECT DISTINCT m.zapp_conversation_id, public.zapp_norm_phone(m.sender_phone) np
      FROM public.zapp_messages m JOIN public.zapp_conversations g ON g.id = m.zapp_conversation_id AND g.is_group
      WHERE coalesce(m.sender_phone,'') <> '') s
JOIN public.zapp_conversations zc ON zc.id = s.zapp_conversation_id
JOIN public.clients c ON c.account_id = zc.account_id AND length(s.np) >= 10 AND (public.zapp_norm_phone(c.phone_e164) = s.np
  OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(c.additional_phones)='array' THEN c.additional_phones ELSE '[]'::jsonb END) ap WHERE public.zapp_norm_phone(ap) = s.np))
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.client_last_live_activity()
 RETURNS TABLE(client_id uuid, last_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.id AS client_id,
         GREATEST(
           COALESCE(msg.last_at, 'epoch'::timestamptz),
           COALESCE(grp.last_at, 'epoch'::timestamptz),
           COALESCE(ck.last_at, 'epoch'::timestamptz),
           COALESCE(c.recent_activity_at, 'epoch'::timestamptz)
         ) AS last_at
  FROM public.clients c
  LEFT JOIN LATERAL (
    SELECT max(m.sent_at) AS last_at FROM public.zapp_conversations zc
    JOIN public.zapp_messages m ON m.zapp_conversation_id = zc.id WHERE zc.client_id = c.id
  ) msg ON true
  LEFT JOIN LATERAL (
    SELECT max(zc.last_message_at) AS last_at FROM public.zapp_group_clients g
    JOIN public.zapp_conversations zc ON zc.id = g.conversation_id WHERE g.client_id = c.id
  ) grp ON true
  LEFT JOIN LATERAL (
    SELECT max(k.happened_at) AS last_at FROM public.client_checkins k WHERE k.client_id = c.id
  ) ck ON true
  WHERE c.status IN ('active','churn_risk','paused');
$function$;