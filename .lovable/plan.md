
# Plano: Corrigir Atualização da View Materializada de Métricas

## Problema Identificado

A view materializada `client_latest_metrics` não está sendo atualizada quando contratos são criados ou modificados. Isso causa dados desatualizados no filtro de clientes.

### Evidências Encontradas

| Cliente | Status na View | Status Real |
|---------|---------------|-------------|
| Andréia Forcione | ended | active |
| Fabiola Korin | paused | active |
| Nathália Martins Ribas | paused | active |

A Michele tem **84 clientes com contrato active** no banco, mas o filtro mostra apenas **61** porque a view está desatualizada.

## Solução Proposta

### Ação 1: Criar Trigger para Refresh Automático

Criar um trigger na tabela `client_contracts` que atualiza a view materializada quando contratos são criados ou modificados.

```sql
-- Função que agenda o refresh da view
CREATE OR REPLACE FUNCTION trigger_refresh_client_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Usar pg_notify para agendar refresh assíncrono
  -- Evita bloquear a transação
  PERFORM pg_notify('refresh_client_metrics', 'refresh');
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger após INSERT
CREATE TRIGGER trigger_refresh_metrics_on_contract_insert
AFTER INSERT ON client_contracts
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_refresh_client_metrics();

-- Trigger após UPDATE
CREATE TRIGGER trigger_refresh_metrics_on_contract_update
AFTER UPDATE ON client_contracts
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_refresh_client_metrics();
```

### Ação 2: Criar Edge Function para Escutar Notificações

Ou, alternativamente, criar um refresh periódico via cron job:

```sql
-- Usar pg_cron para refresh a cada 5 minutos
SELECT cron.schedule(
  'refresh-client-metrics',
  '*/5 * * * *',
  'SELECT refresh_client_latest_metrics()'
);
```

### Ação 3: Refresh Manual Imediato

Executar o refresh manualmente agora para corrigir os dados existentes.

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Nova migration SQL | Criar trigger de refresh ou configurar pg_cron |

## Alternativa Mais Simples (Recomendada)

Como o refresh de materialized view pode ser custoso, a melhor solução é **não usar materialized view** para dados críticos de contrato e sim fazer a consulta em tempo real:

1. Modificar a edge function `list-clients` para buscar o contrato mais recente diretamente da tabela `client_contracts` ao invés da view materializada
2. Manter a view apenas para dados menos críticos (vnps, score)

Isso garante dados sempre atualizados sem depender de triggers.

## Resultado Esperado

Após implementação, o filtro "Ativo" retornará os **84 clientes** da Michele que realmente têm contrato com status `active`.
