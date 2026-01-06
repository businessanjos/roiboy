-- 1. Adicionar constraint UNIQUE para evitar duplicatas em client_products
ALTER TABLE client_products 
ADD CONSTRAINT client_products_unique_client_product 
UNIQUE (client_id, product_id);

-- 2. Criar função de sincronização automática contrato -> produto
CREATE OR REPLACE FUNCTION sync_contract_product()
RETURNS TRIGGER AS $$
BEGIN
  -- Se contrato tem product_id e status é 'active', sincroniza para client_products
  IF NEW.product_id IS NOT NULL AND NEW.status = 'active' THEN
    INSERT INTO client_products (account_id, client_id, product_id)
    VALUES (NEW.account_id, NEW.client_id, NEW.product_id)
    ON CONFLICT (client_id, product_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Criar trigger para INSERT em client_contracts
CREATE TRIGGER trigger_sync_contract_product_insert
AFTER INSERT ON client_contracts
FOR EACH ROW EXECUTE FUNCTION sync_contract_product();

-- 4. Criar trigger para UPDATE em client_contracts
CREATE TRIGGER trigger_sync_contract_product_update
AFTER UPDATE ON client_contracts
FOR EACH ROW EXECUTE FUNCTION sync_contract_product();

-- 5. Migrar dados existentes: contratos ativos com produto para client_products
INSERT INTO client_products (account_id, client_id, product_id)
SELECT DISTINCT cc.account_id, cc.client_id, cc.product_id
FROM client_contracts cc
WHERE cc.product_id IS NOT NULL AND cc.status = 'active'
ON CONFLICT (client_id, product_id) DO NOTHING;