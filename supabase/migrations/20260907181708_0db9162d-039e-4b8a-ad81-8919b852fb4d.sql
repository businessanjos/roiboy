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
      WHEN 'choices' THEN CASE
        WHEN jsonb_typeof(a->'choices'->'labels') = 'array' THEN (
          SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(a->'choices'->'labels') x
        )
        WHEN jsonb_typeof(a->'choices') = 'array' THEN (
          SELECT string_agg(coalesce(x->>'label', x#>>'{}'), ', ') FROM jsonb_array_elements(a->'choices') x
        )
        ELSE a->'choices'#>>'{}'
      END
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