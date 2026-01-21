-- =====================================================
-- Corrigir vinculação de clientes no ROY zAPP
-- =====================================================

-- 1. Atualizar trigger para considerar additional_phones
CREATE OR REPLACE FUNCTION public.sync_zapp_conversation_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only proceed if phone_e164 is not null and not empty
  IF NEW.phone_e164 IS NOT NULL AND NEW.phone_e164 != '' THEN
    -- Update conversations where phone matches primary OR additional phones
    UPDATE zapp_conversations
    SET 
      client_id = NEW.id,
      updated_at = now()
    WHERE phone_e164 IS NOT NULL
      AND phone_e164 != ''
      AND (
        phone_e164 = NEW.phone_e164
        OR (NEW.additional_phones IS NOT NULL AND NEW.additional_phones ? phone_e164)
      )
      AND account_id = NEW.account_id
      AND client_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Desvincular conversas onde o telefone NÃO corresponde ao cliente vinculado
UPDATE zapp_conversations zc
SET client_id = NULL, updated_at = now()
FROM clients c
WHERE zc.client_id = c.id
  AND zc.phone_e164 IS NOT NULL
  AND zc.phone_e164 != ''
  AND zc.phone_e164 != c.phone_e164
  AND (c.additional_phones IS NULL OR NOT c.additional_phones ? zc.phone_e164);

-- 3. Revincular conversas órfãs ao cliente correto baseado no telefone
UPDATE zapp_conversations zc
SET client_id = c.id, updated_at = now()
FROM clients c
WHERE zc.client_id IS NULL
  AND zc.phone_e164 IS NOT NULL
  AND zc.phone_e164 != ''
  AND zc.account_id = c.account_id
  AND (
    zc.phone_e164 = c.phone_e164
    OR (c.additional_phones IS NOT NULL AND c.additional_phones ? zc.phone_e164)
  );