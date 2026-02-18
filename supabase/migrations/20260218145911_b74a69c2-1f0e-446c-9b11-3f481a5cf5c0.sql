CREATE OR REPLACE FUNCTION public.sync_event_participants_from_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client RECORD;
BEGIN
  FOR v_client IN 
    SELECT DISTINCT cp.client_id
    FROM client_products cp
    INNER JOIN client_contracts cc 
      ON cc.client_id = cp.client_id
      AND cc.product_id = cp.product_id
      AND cc.account_id = cp.account_id
      AND cc.status = 'active'
    WHERE cp.product_id = NEW.product_id
      AND cp.account_id = NEW.account_id
  LOOP
    INSERT INTO event_participants (
      account_id, event_id, client_id, rsvp_status, invited_at
    )
    SELECT 
      NEW.account_id, NEW.event_id, v_client.client_id, 'pending', now()
    WHERE NOT EXISTS (
      SELECT 1 FROM event_participants ep
      WHERE ep.event_id = NEW.event_id
        AND ep.client_id = v_client.client_id
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;