-- Function to automatically add clients as participants when a product is linked to an event
CREATE OR REPLACE FUNCTION public.sync_event_participants_from_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client RECORD;
BEGIN
  -- For each client that has the product being added
  FOR v_client IN 
    SELECT cp.client_id
    FROM client_products cp
    WHERE cp.product_id = NEW.product_id
      AND cp.account_id = NEW.account_id
  LOOP
    -- Insert as participant if not already exists
    INSERT INTO event_participants (
      account_id,
      event_id,
      client_id,
      rsvp_status,
      invited_at
    )
    SELECT 
      NEW.account_id,
      NEW.event_id,
      v_client.client_id,
      'pending',
      now()
    WHERE NOT EXISTS (
      SELECT 1 FROM event_participants ep
      WHERE ep.event_id = NEW.event_id
        AND ep.client_id = v_client.client_id
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger to sync participants when product is added to event
DROP TRIGGER IF EXISTS on_event_product_added ON public.event_products;
CREATE TRIGGER on_event_product_added
  AFTER INSERT ON public.event_products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_event_participants_from_product();