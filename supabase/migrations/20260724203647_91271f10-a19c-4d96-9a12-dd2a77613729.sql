
CREATE OR REPLACE FUNCTION public.enforce_unique_uazapi_instance_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_conflict RECORD;
BEGIN
  -- Only applies to UAZAPI whatsapp integrations
  IF NEW.type IS DISTINCT FROM 'whatsapp' THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.config->>'provider', '') <> 'uazapi' THEN
    RETURN NEW;
  END IF;

  v_token := NULLIF(TRIM(NEW.config->>'instance_token'), '');
  IF v_token IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, sector_id, display_name, config->>'instance_name' AS instance_name
    INTO v_conflict
  FROM public.integrations
  WHERE type = 'whatsapp'
    AND account_id = NEW.account_id
    AND id <> NEW.id
    AND config->>'provider' = 'uazapi'
    AND config->>'instance_token' = v_token
    AND COALESCE(sector_id, '') <> COALESCE(NEW.sector_id, '')
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Instance token da UAZAPI já está em uso pela integração "%" (setor %). Cada número/instância WhatsApp precisa ter um instance_token exclusivo por setor. Reconecte via QR Code para gerar um token novo.',
      COALESCE(v_conflict.display_name, v_conflict.instance_name, v_conflict.id::text),
      COALESCE(v_conflict.sector_id, '(sem setor)')
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_unique_uazapi_instance_token_trg ON public.integrations;
CREATE TRIGGER enforce_unique_uazapi_instance_token_trg
BEFORE INSERT OR UPDATE OF config, sector_id ON public.integrations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_unique_uazapi_instance_token();
