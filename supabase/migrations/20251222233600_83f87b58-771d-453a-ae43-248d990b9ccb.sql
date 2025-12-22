-- Add public registration code to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS public_registration_code TEXT UNIQUE;

-- Create function to generate unique registration code
CREATE OR REPLACE FUNCTION public.generate_registration_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 6 character alphanumeric code
    new_code := upper(substr(md5(random()::text), 1, 6));
    
    -- Check if code already exists
    SELECT EXISTS (SELECT 1 FROM public.events WHERE public_registration_code = new_code) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;

-- Create function to get event by registration code (public access)
CREATE OR REPLACE FUNCTION public.get_event_by_registration_code(p_code TEXT)
RETURNS TABLE(
  event_id UUID,
  event_title TEXT,
  event_description TEXT,
  event_scheduled_at TIMESTAMPTZ,
  event_ends_at TIMESTAMPTZ,
  event_modality TEXT,
  event_address TEXT,
  max_capacity INTEGER,
  current_confirmed INTEGER,
  has_capacity BOOLEAN,
  account_id UUID
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    e.id as event_id,
    e.title as event_title,
    e.description as event_description,
    e.scheduled_at as event_scheduled_at,
    e.ends_at as event_ends_at,
    e.modality::text as event_modality,
    e.address as event_address,
    e.max_capacity,
    (SELECT COUNT(*)::integer FROM event_participants ep WHERE ep.event_id = e.id AND ep.rsvp_status = 'confirmed') as current_confirmed,
    CASE 
      WHEN e.max_capacity IS NULL THEN true
      ELSE (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id AND ep.rsvp_status = 'confirmed') < e.max_capacity
    END as has_capacity,
    e.account_id
  FROM events e
  WHERE UPPER(e.public_registration_code) = UPPER(p_code)
  LIMIT 1;
$$;

-- Create function to register for event publicly
CREATE OR REPLACE FUNCTION public.register_for_event(
  p_code TEXT,
  p_name TEXT,
  p_phone TEXT,
  p_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event RECORD;
  v_client_id UUID;
  v_participant_id UUID;
  v_current_confirmed INTEGER;
  v_rsvp_status event_rsvp_status;
  v_waitlist_position INTEGER;
BEGIN
  -- Validate inputs
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome é obrigatório');
  END IF;
  
  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Telefone é obrigatório');
  END IF;

  -- Find event
  SELECT e.id, e.account_id, e.max_capacity, e.title
  INTO v_event
  FROM events e
  WHERE UPPER(e.public_registration_code) = UPPER(p_code);
  
  IF v_event.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Evento não encontrado');
  END IF;
  
  -- Check if phone already registered for this event
  SELECT ep.id INTO v_participant_id
  FROM event_participants ep
  WHERE ep.event_id = v_event.id
    AND (ep.guest_phone = p_phone OR EXISTS (
      SELECT 1 FROM clients c WHERE c.id = ep.client_id AND c.phone_e164 = p_phone
    ));
  
  IF v_participant_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este telefone já está inscrito neste evento');
  END IF;
  
  -- Try to find existing client by phone
  SELECT c.id INTO v_client_id
  FROM clients c
  WHERE c.account_id = v_event.account_id
    AND c.phone_e164 = p_phone;
  
  -- Count current confirmed participants
  SELECT COUNT(*) INTO v_current_confirmed
  FROM event_participants ep
  WHERE ep.event_id = v_event.id
    AND ep.rsvp_status = 'confirmed';
  
  -- Determine status based on capacity
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
  
  -- Create participant
  INSERT INTO event_participants (
    account_id,
    event_id,
    client_id,
    guest_name,
    guest_phone,
    guest_email,
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