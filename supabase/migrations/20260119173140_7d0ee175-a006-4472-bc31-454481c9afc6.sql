-- Remover versões duplicadas da função
DROP FUNCTION IF EXISTS public.register_for_event(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.register_for_event(TEXT, TEXT, TEXT, TEXT, TEXT);

-- Recriar função corrigida com suporte a RG
CREATE OR REPLACE FUNCTION public.register_for_event(
  p_code TEXT,
  p_name TEXT,
  p_phone TEXT,
  p_email TEXT DEFAULT NULL,
  p_rg TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_client_id UUID;
  v_participant_id UUID;
  v_current_confirmed INTEGER;
  v_rsvp_status event_rsvp_status;
  v_waitlist_position INTEGER;
BEGIN
  -- Validar inputs obrigatórios
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome é obrigatório');
  END IF;
  
  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Telefone é obrigatório');
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'E-mail é obrigatório');
  END IF;

  IF p_rg IS NULL OR trim(p_rg) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'RG é obrigatório');
  END IF;

  -- Buscar evento pelo código (usando public_registration_code - nome correto da coluna)
  SELECT e.id, e.account_id, e.max_capacity, e.title
  INTO v_event
  FROM events e
  WHERE UPPER(e.public_registration_code) = UPPER(p_code)
    AND e.public_registration_enabled = true;
  
  IF v_event.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Evento não encontrado ou inscrições não estão habilitadas');
  END IF;
  
  -- Verificar se telefone já está inscrito neste evento
  SELECT ep.id INTO v_participant_id
  FROM event_participants ep
  WHERE ep.event_id = v_event.id
    AND (ep.guest_phone = p_phone OR EXISTS (
      SELECT 1 FROM clients c WHERE c.id = ep.client_id AND c.phone_e164 = p_phone
    ));
  
  IF v_participant_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este telefone já está inscrito neste evento');
  END IF;
  
  -- Tentar encontrar cliente existente pelo telefone
  SELECT c.id INTO v_client_id
  FROM clients c
  WHERE c.account_id = v_event.account_id
    AND c.phone_e164 = p_phone;
  
  -- Contar participantes confirmados (usando rsvp_status - nome correto da coluna)
  SELECT COUNT(*) INTO v_current_confirmed
  FROM event_participants ep
  WHERE ep.event_id = v_event.id
    AND ep.rsvp_status = 'confirmed';
  
  -- Determinar status baseado na capacidade (usando max_capacity - nome correto da coluna)
  IF v_event.max_capacity IS NULL OR v_current_confirmed < v_event.max_capacity THEN
    v_rsvp_status := 'confirmed';
    v_waitlist_position := NULL;
  ELSE
    v_rsvp_status := 'waitlist';
    SELECT COALESCE(MAX(waitlist_position), 0) + 1 INTO v_waitlist_position
    FROM event_participants ep
    WHERE ep.event_id = v_event.id
      AND ep.rsvp_status = 'waitlist';
  END IF;
  
  -- Criar participante (usando colunas corretas: rsvp_status, guest_rg, sem registration_source)
  INSERT INTO event_participants (
    account_id,
    event_id,
    client_id,
    guest_name,
    guest_phone,
    guest_email,
    guest_rg,
    rsvp_status,
    rsvp_responded_at,
    waitlist_position
  ) VALUES (
    v_event.account_id,
    v_event.id,
    v_client_id,
    CASE WHEN v_client_id IS NULL THEN p_name ELSE NULL END,
    CASE WHEN v_client_id IS NULL THEN p_phone ELSE NULL END,
    CASE WHEN v_client_id IS NULL THEN p_email ELSE NULL END,
    CASE WHEN v_client_id IS NULL THEN NULLIF(TRIM(p_rg), '') ELSE NULL END,
    v_rsvp_status,
    now(),
    v_waitlist_position
  )
  RETURNING id INTO v_participant_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'participant_id', v_participant_id,
    'status', v_rsvp_status::text,
    'waitlist_position', v_waitlist_position,
    'is_client', v_client_id IS NOT NULL,
    'message', CASE 
      WHEN v_rsvp_status = 'confirmed' THEN 'Inscrição confirmada! Você está inscrito no evento.'
      ELSE 'Evento lotado! Você foi adicionado à lista de espera na posição ' || v_waitlist_position
    END
  );
END;
$$;