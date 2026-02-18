
## Filtrar convites automáticos para incluir apenas clientes com contratos ativos

### Problema

Quando um produto é vinculado a um evento, o trigger `sync_event_participants_from_product` no banco de dados convida automaticamente **todos** os clientes que possuem aquele produto na tabela `client_products`, independentemente do status do contrato. Isso faz com que clientes com contratos inativos, cancelados ou encerrados também recebam convites.

### Causa raiz

O trigger atual consulta apenas a tabela `client_products` sem verificar a tabela `client_contracts`. A logica precisa cruzar com `client_contracts` para garantir que o cliente tenha um contrato com status ativo para aquele produto.

### Solucao

Alterar a funcao `sync_event_participants_from_product()` no banco de dados para adicionar um JOIN com `client_contracts`, filtrando apenas clientes que tenham pelo menos um contrato ativo (`status = 'active'`) vinculado ao produto em questao.

### Detalhes tecnicos

**Migracao SQL**: Recriar a funcao com a seguinte logica atualizada:

```sql
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
```

A diferenca principal e o `INNER JOIN client_contracts` que exige que o cliente tenha um contrato com status `'active'` para o mesmo produto e conta. Clientes sem contrato ativo nao serao convidados.

### Nenhuma mudanca no frontend

A logica de convite automatico e inteiramente no banco de dados (trigger). Nenhum arquivo do frontend precisa ser alterado.
