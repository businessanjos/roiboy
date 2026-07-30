DO $$
DECLARE
  ghost uuid := 'f865659c-b3fa-42d1-a6fc-5bc03ea5b7d4';
  real_id uuid := '65cbf5f6-3479-49d0-9465-3d53d4a76ff9';
  r record;
BEGIN
  FOR r IN SELECT id, phone_e164 FROM public.zapp_conversations WHERE integration_id = ghost LOOP
    IF EXISTS (
      SELECT 1 FROM public.zapp_conversations d
      WHERE d.integration_id = real_id AND d.phone_e164 = r.phone_e164
    ) THEN
      UPDATE public.zapp_conversations SET integration_id = NULL WHERE id = r.id;
    ELSE
      UPDATE public.zapp_conversations SET integration_id = real_id WHERE id = r.id;
    END IF;
  END LOOP;

  UPDATE public.zapp_conversations SET integration_id = NULL WHERE integration_id = ghost;

  DELETE FROM public.integrations WHERE id = ghost;
END $$;

CREATE OR REPLACE FUNCTION public.reject_incomplete_whatsapp_integration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'whatsapp' THEN
    IF coalesce(NEW.config->>'instance_name', '') = ''
       OR coalesce(NEW.config->>'instance_token', '') = '' THEN
      RAISE EXCEPTION 'Conexao de WhatsApp invalida: instance_name e instance_token sao obrigatorios (setor: %)', coalesce(NEW.sector_id, 'global');
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_reject_incomplete_whatsapp_integration ON public.integrations;
CREATE TRIGGER trg_reject_incomplete_whatsapp_integration
BEFORE INSERT OR UPDATE ON public.integrations
FOR EACH ROW EXECUTE FUNCTION public.reject_incomplete_whatsapp_integration();