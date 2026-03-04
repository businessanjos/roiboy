

## Correção: Erro "record 'new' has no field 'sector_id'"

### Causa raiz

A função `notify_task_assignment()` (trigger na tabela `internal_tasks`) tenta acessar `NEW.sector_id` na linha 112, mas a tabela `internal_tasks` **não possui** a coluna `sector_id`. Isso causa o erro toda vez que o `assigned_to` é alterado.

### Solução

Criar uma migration que atualiza a função `notify_task_assignment()`, substituindo `COALESCE(NEW.sector_id, 'operacoes')` por simplesmente `'operacoes'` (ou determinando o setor via `deal_id` se disponível).

Lógica corrigida para determinar o setor:
- Se `client_id` está presente → `'operacoes'`
- Se `deal_id` está presente → `'vendas'`
- Caso contrário → `'operacoes'` (fallback seguro)

### Alteração

Uma migration SQL que faz `CREATE OR REPLACE FUNCTION public.notify_task_assignment()` com a linha 112 corrigida de:
```sql
v_sector_id := COALESCE(NEW.sector_id, 'operacoes');
```
para:
```sql
v_sector_id := CASE WHEN NEW.deal_id IS NOT NULL THEN 'vendas' ELSE 'operacoes' END;
```

### Arquivos afetados
- Nova migration SQL (via ferramenta de migração)

