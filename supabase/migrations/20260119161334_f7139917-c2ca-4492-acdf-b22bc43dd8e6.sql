-- Adicionar coluna RG para participantes convidados
ALTER TABLE public.event_participants 
ADD COLUMN IF NOT EXISTS guest_rg TEXT;

-- Comentário explicativo
COMMENT ON COLUMN public.event_participants.guest_rg IS 'RG do participante (para convidados não-clientes)';

-- Atualizar função register_for_event com email obrigatório e parâmetro RG
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
  v_current_count INTEGER;
  v_is_waitlist BOOLEAN := FALSE;
BEGIN
  -- Validar email obrigatório
  IF p_email IS NULL OR TRIM(p_email) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'E-mail é obrigatório'
    );
  END IF;

  -- Buscar evento pelo código
  SELECT e.id, e.account_id, e.capacity, e.status
  INTO v_event
  FROM events e
  WHERE e.registration_code = p_code
    AND e.status IN ('scheduled', 'confirmed');
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Evento não encontrado ou não está disponível para inscrições'
    );
  END IF;

  -- Verificar se já existe um cliente com esse telefone
  SELECT id INTO v_client_id
  FROM clients
  WHERE account_id = v_event.account_id
    AND phone_e164 = p_phone
  LIMIT 1;

  -- Verificar se já está inscrito
  IF EXISTS (
    SELECT 1 FROM event_participants ep
    WHERE ep.event_id = v_event.id
      AND (
        (ep.client_id IS NOT NULL AND ep.client_id = v_client_id)
        OR (ep.client_id IS NULL AND ep.guest_phone = p_phone)
      )
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Você já está inscrito neste evento'
    );
  END IF;

  -- Contar participantes confirmados
  SELECT COUNT(*) INTO v_current_count
  FROM event_participants
  WHERE event_id = v_event.id
    AND status = 'confirmed';

  -- Verificar se vai para lista de espera
  IF v_event.capacity IS NOT NULL AND v_current_count >= v_event.capacity THEN
    v_is_waitlist := TRUE;
  END IF;

  -- Inserir participante
  INSERT INTO event_participants (
    event_id,
    account_id,
    client_id,
    guest_name,
    guest_phone,
    guest_email,
    guest_rg,
    status,
    registration_source
  ) VALUES (
    v_event.id,
    v_event.account_id,
    v_client_id,
    CASE WHEN v_client_id IS NULL THEN p_name ELSE NULL END,
    CASE WHEN v_client_id IS NULL THEN p_phone ELSE NULL END,
    CASE WHEN v_client_id IS NULL THEN TRIM(p_email) ELSE NULL END,
    CASE WHEN v_client_id IS NULL THEN NULLIF(TRIM(p_rg), '') ELSE NULL END,
    CASE WHEN v_is_waitlist THEN 'waitlist' ELSE 'confirmed' END,
    'public_link'
  )
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'success', true,
    'participant_id', v_participant_id,
    'status', CASE WHEN v_is_waitlist THEN 'waitlist' ELSE 'confirmed' END,
    'is_existing_client', v_client_id IS NOT NULL
  );
END;
$$;