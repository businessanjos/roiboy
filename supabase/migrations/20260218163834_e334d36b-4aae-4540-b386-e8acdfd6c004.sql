
-- Must drop first because return type is changing
DROP FUNCTION IF EXISTS public.get_event_by_registration_code(text);

CREATE FUNCTION public.get_event_by_registration_code(p_code text)
 RETURNS TABLE(event_id uuid, event_title text, event_description text, event_scheduled_at timestamp with time zone, event_ends_at timestamp with time zone, event_modality text, event_address text, max_capacity integer, current_confirmed integer, has_capacity boolean, account_id uuid, rsvp_form_fields jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 
    e.id, e.title, e.description, e.scheduled_at, e.ends_at,
    e.modality::text, e.address, e.max_capacity,
    (SELECT COUNT(*)::integer FROM event_participants ep WHERE ep.event_id = e.id AND ep.rsvp_status = 'confirmed'),
    CASE WHEN e.max_capacity IS NULL THEN true
      ELSE (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id AND ep.rsvp_status = 'confirmed') < e.max_capacity
    END,
    e.account_id,
    e.rsvp_form_fields
  FROM events e
  WHERE UPPER(e.public_registration_code) = UPPER(p_code)
    AND e.public_registration_enabled = true
  LIMIT 1;
$$;

DROP FUNCTION IF EXISTS public.register_for_event(TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.register_for_event(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB);

CREATE FUNCTION public.register_for_event(
  p_code TEXT, p_name TEXT, p_phone TEXT,
  p_email TEXT DEFAULT NULL, p_rg TEXT DEFAULT NULL,
  p_custom_fields JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event RECORD; v_client_id UUID; v_participant_id UUID;
  v_current_confirmed INTEGER; v_rsvp_status event_rsvp_status;
  v_waitlist_position INTEGER; v_form_fields JSONB;
BEGIN
  SELECT e.id, e.account_id, e.max_capacity, e.title, e.rsvp_form_fields INTO v_event
  FROM events e WHERE UPPER(e.public_registration_code) = UPPER(p_code) AND e.public_registration_enabled = true;
  IF v_event.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Evento não encontrado ou inscrições não estão habilitadas'); END IF;
  v_form_fields := v_event.rsvp_form_fields;
  IF v_form_fields IS NULL THEN
    IF p_name IS NULL OR trim(p_name) = '' THEN RETURN jsonb_build_object('success', false, 'error', 'Nome é obrigatório'); END IF;
    IF p_phone IS NULL OR trim(p_phone) = '' THEN RETURN jsonb_build_object('success', false, 'error', 'Telefone é obrigatório'); END IF;
    IF p_email IS NULL OR trim(p_email) = '' THEN RETURN jsonb_build_object('success', false, 'error', 'E-mail é obrigatório'); END IF;
    IF p_rg IS NULL OR trim(p_rg) = '' THEN RETURN jsonb_build_object('success', false, 'error', 'RG é obrigatório'); END IF;
  ELSE
    IF p_name IS NULL OR trim(p_name) = '' THEN RETURN jsonb_build_object('success', false, 'error', 'Nome é obrigatório'); END IF;
    IF p_phone IS NULL OR trim(p_phone) = '' THEN RETURN jsonb_build_object('success', false, 'error', 'Telefone é obrigatório'); END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_form_fields) f WHERE f->>'key' = 'email' AND (f->>'enabled')::boolean AND (f->>'required')::boolean) THEN
      IF p_email IS NULL OR trim(p_email) = '' THEN RETURN jsonb_build_object('success', false, 'error', 'E-mail é obrigatório'); END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_form_fields) f WHERE f->>'key' = 'rg' AND (f->>'enabled')::boolean AND (f->>'required')::boolean) THEN
      IF p_rg IS NULL OR trim(p_rg) = '' THEN RETURN jsonb_build_object('success', false, 'error', 'RG é obrigatório'); END IF;
    END IF;
  END IF;
  SELECT ep.id INTO v_participant_id FROM event_participants ep
  WHERE ep.event_id = v_event.id AND (ep.guest_phone = p_phone OR EXISTS (SELECT 1 FROM clients c WHERE c.id = ep.client_id AND c.phone_e164 = p_phone));
  IF v_participant_id IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Este telefone já está inscrito neste evento'); END IF;
  SELECT c.id INTO v_client_id FROM clients c WHERE c.account_id = v_event.account_id AND c.phone_e164 = p_phone;
  SELECT COUNT(*) INTO v_current_confirmed FROM event_participants ep WHERE ep.event_id = v_event.id AND ep.rsvp_status = 'confirmed';
  IF v_event.max_capacity IS NULL OR v_current_confirmed < v_event.max_capacity THEN
    v_rsvp_status := 'confirmed'; v_waitlist_position := NULL;
  ELSE
    v_rsvp_status := 'waitlist';
    SELECT COALESCE(MAX(waitlist_position), 0) + 1 INTO v_waitlist_position FROM event_participants ep WHERE ep.event_id = v_event.id AND ep.rsvp_status = 'waitlist';
  END IF;
  INSERT INTO event_participants (account_id, event_id, client_id, guest_name, guest_phone, guest_email, guest_rg, rsvp_status, rsvp_responded_at, waitlist_position, custom_data)
  VALUES (v_event.account_id, v_event.id, v_client_id,
    CASE WHEN v_client_id IS NULL THEN p_name ELSE NULL END, CASE WHEN v_client_id IS NULL THEN p_phone ELSE NULL END,
    CASE WHEN v_client_id IS NULL THEN p_email ELSE NULL END, CASE WHEN v_client_id IS NULL THEN NULLIF(TRIM(p_rg), '') ELSE NULL END,
    v_rsvp_status, now(), v_waitlist_position,
    CASE WHEN p_custom_fields IS NOT NULL AND p_custom_fields != '{}'::jsonb THEN p_custom_fields ELSE NULL END
  ) RETURNING id INTO v_participant_id;
  RETURN jsonb_build_object('success', true, 'participant_id', v_participant_id, 'status', v_rsvp_status::text, 'waitlist_position', v_waitlist_position, 'is_client', v_client_id IS NOT NULL,
    'message', CASE WHEN v_rsvp_status = 'confirmed' THEN 'Inscrição confirmada! Você está inscrito no evento.' ELSE 'Evento lotado! Você foi adicionado à lista de espera na posição ' || v_waitlist_position END);
END;
$$;
