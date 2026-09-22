ALTER TABLE public.spiff_spins DROP CONSTRAINT IF EXISTS spiff_spins_payment_status_check;
ALTER TABLE public.spiff_spins ADD CONSTRAINT spiff_spins_payment_status_check CHECK (payment_status IN ('pending','paid','cancelled'));

GRANT EXECUTE ON FUNCTION public.client_last_live_activity() TO authenticated;

UPDATE public.billing_reminder_rules SET active_since = COALESCE(active_since, now()) WHERE active IS TRUE AND active_since IS NULL;