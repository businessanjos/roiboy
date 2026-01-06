-- ============================================================
-- Trigger: Auto-link client_id to zapp_conversations
-- ============================================================

-- Function to sync client_id when a client is created/updated with a phone
CREATE OR REPLACE FUNCTION public.sync_zapp_conversation_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only proceed if phone_e164 is not null
  IF NEW.phone_e164 IS NOT NULL THEN
    UPDATE zapp_conversations
    SET 
      client_id = NEW.id,
      updated_at = now()
    WHERE phone_e164 = NEW.phone_e164
      AND account_id = NEW.account_id
      AND client_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on clients table
DROP TRIGGER IF EXISTS trigger_sync_zapp_client ON clients;
CREATE TRIGGER trigger_sync_zapp_client
AFTER INSERT OR UPDATE OF phone_e164 ON clients
FOR EACH ROW
EXECUTE FUNCTION sync_zapp_conversation_client();

-- ============================================================
-- One-time reconciliation: Link existing conversations to clients
-- ============================================================
UPDATE zapp_conversations zc
SET 
  client_id = c.id,
  updated_at = now()
FROM clients c
WHERE zc.phone_e164 = c.phone_e164
  AND zc.account_id = c.account_id
  AND zc.client_id IS NULL
  AND c.phone_e164 IS NOT NULL
  AND c.status = 'active';