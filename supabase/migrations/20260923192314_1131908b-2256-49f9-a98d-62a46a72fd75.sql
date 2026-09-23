CREATE OR REPLACE FUNCTION public.vcs_autofill_deal_product()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_deal uuid; v_lead uuid; v_raw text; v_digits text;
BEGIN
  v_deal := NEW.deal_id;
  IF v_deal IS NULL AND NEW.lead_id IS NOT NULL THEN
    SELECT id INTO v_deal FROM deals WHERE lead_id = NEW.lead_id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF v_deal IS NULL AND NEW.participant_phone IS NOT NULL THEN
    v_digits := right(regexp_replace(NEW.participant_phone, '\D', '', 'g'), 8);
    IF length(v_digits) = 8 THEN
      SELECT id INTO v_deal FROM deals WHERE deleted_at IS NULL
        AND right(regexp_replace(coalesce(contact_phone,''), '\D', '', 'g'), 8) = v_digits
        AND (NEW.account_id IS NULL OR account_id = NEW.account_id)
      ORDER BY created_at DESC LIMIT 1;
    END IF;
  END IF;
  IF v_deal IS NULL THEN RETURN NEW; END IF;
  NEW.deal_id := v_deal;
  IF NEW.lead_id IS NULL THEN
    SELECT lead_id INTO v_lead FROM deals WHERE id = v_deal; NEW.lead_id := v_lead;
  END IF;
  IF NEW.product_id IS NULL THEN
    SELECT value_text INTO v_raw FROM deal_field_values
      WHERE deal_id = v_deal AND field_id = '033b91fb-3add-4c96-aec9-567fefbd0fb2' LIMIT 1;
    v_raw := lower(trim(coalesce(v_raw,'')));
    NEW.product_id := CASE
      WHEN v_raw ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN v_raw::uuid
      WHEN v_raw IN ('eternum_mentoring','em','rykas_mentoring','rykas') THEN 'f48e141b-e3da-4547-9b4a-70548fcdfe2c'::uuid
      WHEN v_raw IN ('eternum_mentoring_low','eml') THEN '311124ee-a8ee-4695-b26d-972742eb751b'::uuid
      WHEN v_raw = 'rm' THEN '8d3e9bb6-054b-44b3-952f-5920e0ed8775'::uuid
      WHEN v_raw IN ('eternum_club','ec') THEN 'b8c50eca-6fd9-41ac-a1d3-f78086daaea7'::uuid
      WHEN v_raw IN ('eternum_private','ep') THEN 'ab609e84-9c61-4e0b-9559-212010d9be83'::uuid
      WHEN v_raw IN ('eternum_mvp','mvp') THEN '8e8b0cc7-6965-4241-9aab-b959e7fc7893'::uuid
      WHEN v_raw = 'daily_mvp' THEN '9893ec8f-db35-46b4-be9e-6ed2d96f4450'::uuid
      WHEN v_raw IN ('conselho','conselho_de_anjo','conselho_anjo','ca') THEN 'abf8cd6f-3399-4af4-92c6-50fc1a966243'::uuid
      WHEN v_raw IN ('rykas_pass','eternum_pass','e_pass') THEN '51f88404-c59f-41bf-a3f5-b71ad209b94d'::uuid
      WHEN v_raw = 'clinica_ryka' THEN 'feb34040-ba60-417a-a5d3-66dbdf1cfc02'::uuid
      WHEN v_raw = 'consultoria_premium' THEN '2a8a4b0e-59f1-46f0-bb60-5b60fb092f81'::uuid
      WHEN v_raw IN ('ren_eternum_mentoring','ren_rykas_mentoring') THEN '27d83762-7ce0-49d5-a12b-b51571303096'::uuid
      WHEN v_raw = 'ren_eternum_club' THEN '6f74bb43-a1be-410f-a708-6abab066bb38'::uuid
      WHEN v_raw = 'ren_eternum_private' THEN 'b7ba9aa5-42fd-4419-b813-5de646d6711c'::uuid
      ELSE NULL END;
    IF NEW.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products WHERE id = NEW.product_id) THEN
      NEW.product_id := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_vcs_autofill_deal_product ON public.video_call_sessions;
CREATE TRIGGER trg_vcs_autofill_deal_product
BEFORE INSERT OR UPDATE OF lead_id, deal_id, participant_phone ON public.video_call_sessions
FOR EACH ROW EXECUTE FUNCTION public.vcs_autofill_deal_product();

UPDATE public.video_call_sessions SET participant_phone = participant_phone
WHERE product_id IS NULL OR deal_id IS NULL;