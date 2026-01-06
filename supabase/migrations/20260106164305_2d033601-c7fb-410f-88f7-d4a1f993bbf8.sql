-- Corrigir o search_path da função sync_contract_product
CREATE OR REPLACE FUNCTION sync_contract_product()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.product_id IS NOT NULL AND NEW.status = 'active' THEN
    INSERT INTO client_products (account_id, client_id, product_id)
    VALUES (NEW.account_id, NEW.client_id, NEW.product_id)
    ON CONFLICT (client_id, product_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;