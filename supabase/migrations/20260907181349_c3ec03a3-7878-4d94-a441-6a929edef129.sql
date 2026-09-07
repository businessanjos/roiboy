CREATE OR REPLACE FUNCTION public.build_typeform_ficha_text(_answers jsonb, _form_title text, _submitted_at timestamptz)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $fn$
DECLARE
  a jsonb;
  v_label text;
  v_value text;
  v_lines text := '';
BEGIN
  FOR a IN SELECT * FROM jsonb_array_elements(coalesce(_answers, '[]'::jsonb)) LOOP
    v_label := coalesce(a->'field'->>'title', a->'field'->>'ref', '');
    v_label := regexp_replace(v_label, '\{\{[^}]+\}\}', '', 'g');
    v_label := regexp_replace(v_label, '\s*,\s*\?', '?', 'g');
    v_label := btrim(regexp_replace(v_label, '[\s,:]+$', '', 'g'));
    IF v_label ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN
      CONTINUE;
    END IF;

    v_value := CASE coalesce(a->>'type','')
      WHEN 'email' THEN a->>'email'
      WHEN 'phone_number' THEN a->>'phone_number'
      WHEN 'number' THEN a->>'number'
      WHEN 'boolean' THEN CASE WHEN (a->>'boolean')::boolean THEN 'Sim' ELSE 'Não' END
      WHEN 'date' THEN a->>'date'
      WHEN 'url' THEN a->>'url'
      WHEN 'file_url' THEN a->>'file_url'
      WHEN 'choice' THEN coalesce(a->'choice'->>'label', a->'choice'->>'other')
      WHEN 'choices' THEN (
        SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(coalesce(a->'choices'->'labels','[]'::jsonb)) x
      )
      ELSE a->>'text'
    END;

    v_value := btrim(coalesce(v_value, ''));
    IF v_label = '' OR v_value = '' THEN CONTINUE; END IF;
    v_lines := v_lines || E'\n' || '• ' || v_label || ': ' || v_value;
  END LOOP;

  IF v_lines = '' THEN RETURN NULL; END IF;

  RETURN '📋 Ficha Typeform' || CASE WHEN coalesce(_form_title,'') <> '' THEN ' — ' || _form_title ELSE '' END
    || CASE WHEN _submitted_at IS NOT NULL
         THEN E'\n' || 'Recebida em: ' || to_char(_submitted_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
         ELSE '' END
    || E'\n' || v_lines;
END;
$fn$;

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
BEGIN
  SELECT id, account_id, lead_id, contact_email, responsible_user_id
    INTO d FROM public.deals WHERE id = _deal_id;
  IF d.id IS NULL THEN RETURN false; END IF;

  SELECT t.form_id, t.response_id, t.answers, t.submitted_at
    INTO tr
  FROM public.typeform_responses t
  WHERE (
      (d.lead_id IS NOT NULL AND t.matched_lead_id = d.lead_id)
      OR (d.contact_email IS NOT NULL AND lower(coalesce(t.email,'')) = lower(d.contact_email))
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

CREATE OR REPLACE FUNCTION public.trg_attach_typeform_ficha()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  BEGIN
    PERFORM public.attach_typeform_ficha_to_deal(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_deals_attach_typeform_ficha ON public.deals;
CREATE TRIGGER trg_deals_attach_typeform_ficha
AFTER INSERT ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.trg_attach_typeform_ficha();