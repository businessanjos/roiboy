ALTER TABLE public.billing_reminder_rules
  ADD COLUMN IF NOT EXISTS active_since timestamptz;

CREATE OR REPLACE FUNCTION public.set_billing_rule_active_since()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.active IS TRUE AND NEW.active_since IS NULL THEN
      NEW.active_since := now();
    END IF;
  ELSE
    IF NEW.active IS TRUE AND (OLD.active IS DISTINCT FROM TRUE) THEN
      NEW.active_since := now();
    ELSIF NEW.active IS NOT TRUE THEN
      NEW.active_since := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_rule_active_since ON public.billing_reminder_rules;
CREATE TRIGGER trg_billing_rule_active_since
BEFORE INSERT OR UPDATE OF active ON public.billing_reminder_rules
FOR EACH ROW EXECUTE FUNCTION public.set_billing_rule_active_since();

UPDATE public.billing_reminder_rules
SET active_since = NULL
WHERE active IS NOT TRUE;