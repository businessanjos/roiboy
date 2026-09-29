DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.vcs_autofill_deal_product()'::regprocedure);
  d := replace(d, 'IF NEW.product_id IS NULL THEN', 'IF NEW.product_id IS NULL AND (TG_OP = ''INSERT'' OR OLD.product_id IS NULL) THEN');
  EXECUTE d;
END $do$;