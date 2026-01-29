
# Análise: Discrepância na Contagem de Clientes Ativos da Michele Santos

## Problema Identificado

A consultora Michele Santos tem **86 alunas** segundo ela, mas o filtro "Ativo" retorna apenas **61 clientes**.

### Causa Raiz

Existem **23 clientes com contratos que têm status "Encerrado" (ended) mas data de término FUTURA** - como o caso da Andréia Forcione mostrada no print (contrato encerra em 04/12/2026).

O filtro "Ativo" atual verifica apenas `contract.status === "active"`, ignorando contratos que:
- Têm status diferente de "active" (ex: "ended", "suspended")
- Mas ainda estão vigentes pela data de término

### Dados Reais da Michele Santos

| Status do Contrato | Com Data Futura | Total |
|-------------------|-----------------|-------|
| **active** | 83-85 | 85 |
| **ended** (encerrado) | **23** | 93 |
| suspended | 10 | 10 |
| dropout_7d | 11 | 12 |
| cancelled | 13 | 31 |
| dismissed | 8 | 9 |

**84 (ativos) + 23 (encerrados com data futura) = 107 clientes** que poderiam ser considerados "ativos" dependendo da interpretação.

O número **86** que a Michele menciona provavelmente se refere aos **84 contratos status=active + alguns poucos com outros status mas data futura**.

## O Que Está Acontecendo

A view materializada `client_latest_metrics` retorna o contrato com prioridade:
1. Primeiro: contratos com `status = 'active'`
2. Segundo: contratos com `status = 'pending'`
3. Terceiro: outros status

Por isso, quando o cliente tem um contrato "ended" (encerrado), ele aparece na listagem com esse status, mesmo que a data de término seja futura.

## Duas Opções de Solução

### Opção A: Problema de Dados (Recomendado)
Os 23 contratos com status "ended" mas data futura são **dados incorretos**. Um contrato não deveria ter status "encerrado" se ainda não terminou.

**Ação:** Corrigir os dados no banco, alterando o status desses contratos de "ended" para "active".

### Opção B: Ajustar a Lógica do Filtro
Modificar o filtro "Ativo" para considerar **tanto o status quanto a data de término**:

```typescript
// Em list-clients/index.ts, linha 276-278
if (contractFilter === "active") {
  filteredClients = filteredClients.filter(c => {
    if (!c.contract) return false;
    // Considerar ativo se:
    // 1. Status é "active" OU
    // 2. Data de término é futura (independente do status)
    const endDate = c.contract.end_date;
    if (c.contract.status === "active") return true;
    if (endDate && new Date(endDate) >= new Date()) return true;
    return false;
  });
}
```

## Arquivos a Modificar (se Opção B)

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/list-clients/index.ts` | Alterar lógica do filtro "active" para incluir contratos com data futura |

## Recomendação

**Antes de implementar mudanças no código**, sugiro verificar:

1. Por que esses 23 contratos têm status "ended" mas data futura?
2. Isso foi um erro de entrada de dados ou uma regra de negócio?
3. Se for erro, o correto seria corrigir os dados

Se a Michele confirmar que essas 23 alunas realmente deveriam aparecer como "ativas", então implementamos a Opção B.
