-- Adicionar coluna public_registration_enabled na tabela events
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS public_registration_enabled BOOLEAN DEFAULT true;

-- Comentário explicativo
COMMENT ON COLUMN events.public_registration_enabled IS 
  'Indica se o evento aceita inscrições públicas. TRUE por padrão quando existe public_registration_code';

-- Atualizar eventos existentes com código de inscrição
-- para terem inscrições habilitadas por padrão
UPDATE events 
SET public_registration_enabled = true 
WHERE public_registration_code IS NOT NULL;

-- Atualizar get_event_by_registration_code para verificar
-- se inscrições estão habilitadas
CREATE OR REPLACE FUNCTION public.get_event_by_registration_code(p_code TEXT)
RETURNS TABLE (
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
SECURITY DEFINER
LANGUAGE sql
STABLE
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
    AND e.public_registration_enabled = true
  LIMIT 1;
$$;