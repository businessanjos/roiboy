CREATE OR REPLACE FUNCTION public.attach_typeform_ficha_to_deal(_deal_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  d record;
  tr record;
  v_text text;
  v_phone text;
BEGIN
  SELECT id, account_id, lead_id, contact_email, contact_phone, responsible_user_id
    INTO d FROM public.deals WHERE id = _deal_id;
  IF d.id IS NULL THEN RETURN false; END IF;

  v_phone := nullif(right(regexp_replace(coalesce(d.contact_phone,''), '\D', '', 'g'), 9), '');

  SELECT t.form_id, t.response_id, t.answers, t.submitted_at
    INTO tr
  FROM public.typeform_responses t
  WHERE t.account_id = d.account_id
    AND (
      (d.lead_id IS NOT NULL AND t.matched_lead_id = d.lead_id)
      OR (nullif(d.contact_email,'') IS NOT NULL AND lower(coalesce(t.email,'')) = lower(d.contact_email))
      OR (v_phone IS NOT NULL AND nullif(t.phone,'') IS NOT NULL
          AND right(regexp_replace(t.phone, '\D', '', 'g'), 9) = v_phone)
    )
    AND jsonb_array_length(coalesce(t.answers,'[]'::jsonb)) > 0
  ORDER BY t.submitted_at DESC NULLS LAST
  LIMIT 1;

  IF tr.response_id IS NULL THEN RETURN false; END IF;

  IF EXISTS (
    SELECT 1 FROM public.deal_activities a
    WHERE a.deal_id = d.id AND a.type = 'note' AND a.content ILIKE '%' || tr.response_id || '%'
  ) THEN RETURN false; END IF;

  v_text := public.build_typeform_ficha_text(tr.answers, NULL, tr.submitted_at);
  IF v_text IS NULL THEN RETURN false; END IF;

  INSERT INTO public.deal_activities (account_id, deal_id, type, title, content, user_id, completed_at)
  VALUES (d.account_id, d.id, 'note', 'Ficha Typeform',
          v_text || E'\n\nresponse_id: ' || tr.response_id,
          d.responsible_user_id, now());

  UPDATE public.typeform_responses
     SET matched_deal_id = d.id,
         matched_lead_id = coalesce(matched_lead_id, d.lead_id)
   WHERE form_id = tr.form_id AND response_id = tr.response_id;

  RETURN true;
END;
$fn$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT d.id FROM public.deals d
    WHERE d.created_at > now() - interval '90 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.deal_activities a
        WHERE a.deal_id = d.id AND a.type = 'note' AND a.title ILIKE '%Ficha Typeform%'
      )
  LOOP
    PERFORM public.attach_typeform_ficha_to_deal(r.id);
  END LOOP;
END $$;