-- Add cancelled_at column to client_contracts
ALTER TABLE public.client_contracts
ADD COLUMN cancelled_at timestamp with time zone;

-- Create a trigger to auto-set cancelled_at when status changes to cancelled
CREATE OR REPLACE FUNCTION public.set_contract_cancelled_at()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is changing to cancelled and cancelled_at is not set
  IF NEW.status IN ('cancelled', 'dismissed', 'dropout_7d', 'ended') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('cancelled', 'dismissed', 'dropout_7d', 'ended'))
     AND NEW.cancelled_at IS NULL THEN
    NEW.cancelled_at := now();
  END IF;
  
  -- If status is changing away from cancelled statuses, clear cancelled_at
  IF NEW.status NOT IN ('cancelled', 'dismissed', 'dropout_7d', 'ended') 
     AND OLD.status IN ('cancelled', 'dismissed', 'dropout_7d', 'ended') THEN
    NEW.cancelled_at := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_set_contract_cancelled_at ON public.client_contracts;
CREATE TRIGGER trigger_set_contract_cancelled_at
  BEFORE UPDATE ON public.client_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_contract_cancelled_at();

-- Backfill existing cancelled contracts with status_changed_at as cancelled_at
UPDATE public.client_contracts
SET cancelled_at = COALESCE(status_changed_at, updated_at)
WHERE status IN ('cancelled', 'dismissed', 'dropout_7d', 'ended')
  AND cancelled_at IS NULL;