CREATE OR REPLACE FUNCTION public.zapp_mark_group_read_on_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_auth uuid;
BEGIN
  IF NEW.direction <> 'outbound' OR NEW.sender_user_id IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM zapp_conversations c WHERE c.id = NEW.zapp_conversation_id AND c.is_group) THEN RETURN NEW; END IF;
  SELECT auth_user_id INTO v_auth FROM users WHERE id = NEW.sender_user_id;
  IF v_auth IS NULL THEN RETURN NEW; END IF;
  INSERT INTO zapp_conversation_reads(user_id, zapp_conversation_id, last_read_at)
  VALUES (v_auth, NEW.zapp_conversation_id, COALESCE(NEW.created_at, now()))
  ON CONFLICT (user_id, zapp_conversation_id)
  DO UPDATE SET last_read_at = GREATEST(zapp_conversation_reads.last_read_at, EXCLUDED.last_read_at);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_zapp_mark_group_read_on_reply ON public.zapp_messages;
CREATE TRIGGER trg_zapp_mark_group_read_on_reply AFTER INSERT ON public.zapp_messages
FOR EACH ROW EXECUTE FUNCTION public.zapp_mark_group_read_on_reply();

-- Corrige leituras travadas: última resposta de cada pessoa em cada grupo conta como leitura
INSERT INTO public.zapp_conversation_reads(user_id, zapp_conversation_id, last_read_at)
SELECT u.auth_user_id, m.zapp_conversation_id, max(m.created_at)
FROM public.zapp_messages m
JOIN public.zapp_conversations c ON c.id = m.zapp_conversation_id AND c.is_group
JOIN public.users u ON u.id = m.sender_user_id AND u.auth_user_id IS NOT NULL
WHERE m.direction = 'outbound' AND m.created_at > now() - interval '30 days'
GROUP BY u.auth_user_id, m.zapp_conversation_id
ON CONFLICT (user_id, zapp_conversation_id)
DO UPDATE SET last_read_at = GREATEST(zapp_conversation_reads.last_read_at, EXCLUDED.last_read_at);