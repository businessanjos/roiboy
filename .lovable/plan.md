
# Plano: Reverter Contrato e Cliente ao Reabrir Negócio

## Contexto

Quando um negócio é reaberto, o contrato criado e o cliente convertido devem ser "desfeitos" automaticamente, retornando o cliente para a triagem se o negócio for ganho novamente.

## Solução

### 1. Adicionar Campo `deal_id` na Tabela `client_contracts`

Criar uma coluna para vincular diretamente o contrato ao negócio que o originou:

```sql
ALTER TABLE client_contracts 
ADD COLUMN deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;
```

### 2. Modificar Criação de Contrato (SalesPipeline.tsx)

Ao criar o contrato quando o deal é ganho, salvar o `deal_id`:

```typescript
const contractData = {
  // ... campos existentes
  deal_id: dealId, // NOVO: vincular ao deal
};
```

### 3. Modificar `reopenDeal` (useDeals.tsx)

Quando reabrir um negócio **que estava GANHO**, executar:

1. **Deletar o contrato** vinculado ao deal (via `deal_id`)
2. **Limpar `responsible_user_id`** do cliente (volta para triagem)
3. Manter o cliente convertido (não deletar o cliente)

```typescript
const reopenDeal = async (dealId: string): Promise<boolean> => {
  const currentDeal = deals.find(d => d.id === dealId);
  
  // Só reverter se estava GANHO
  if (currentDeal?.status === 'won') {
    // 1. Deletar contrato vinculado a este deal
    await supabase
      .from('client_contracts')
      .delete()
      .eq('deal_id', dealId);
    
    // 2. Remover responsável do cliente (volta para triagem)
    if (currentDeal.client_id) {
      await supabase
        .from('clients')
        .update({ responsible_user_id: null })
        .eq('id', currentDeal.client_id);
    }
  }
  
  // 3. Reabrir o deal normalmente
  await supabase
    .from('deals')
    .update({ status: 'open', won_at: null, ... })
    .eq('id', dealId);
};
```

### 4. Limpeza dos Dados Atuais

Deletar o contrato duplicado mais antigo da Camila:

```sql
DELETE FROM client_contracts 
WHERE id = 'a2c13116-322d-4840-820a-5deb277ae0d0';
```

Atualizar o contrato restante para incluir o `deal_id`:

```sql
UPDATE client_contracts 
SET deal_id = '079510a1-c19a-451b-a3fc-e881faa7ef26'
WHERE id = 'b9dddbb4-d5d6-4f91-abf7-5597b2baf496';
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| **Database** | Adicionar coluna `deal_id` em `client_contracts` |
| `src/hooks/useDeals.tsx` | Modificar `reopenDeal` para deletar contrato e limpar cliente |
| `src/pages/SalesPipeline.tsx` | Passar `deal_id` ao criar contrato |

## Fluxo Final

```text
NEGÓCIO GANHO:
  Lead → Cliente (sem responsible_user_id) → Contrato (deal_id)
  
NEGÓCIO REABERTO:
  ❌ Contrato deletado
  Cliente.responsible_user_id → null
  Cliente permanece na base
  Deal → status: open
  
NEGÓCIO GANHO NOVAMENTE:
  Novo Contrato (deal_id)
  Cliente continua sem responsible_user_id
  → Aparece na Triagem normalmente
```

## Resultado Esperado

- Camila aparecerá **1 vez** na Conciliação (contrato mantido)
- Camila aparecerá **1 vez** na Triagem (cliente sem responsável)
- Futuros "reabrir" de negócios ganhos não criarão duplicações
- O sistema mantém rastreabilidade completa (deal_id no contrato)
