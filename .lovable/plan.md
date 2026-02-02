
# Plano: Separar Conversas por Instância WhatsApp

## Problema Identificado

Atualmente o sistema tem um índice único que impede múltiplas conversas por telefone:
```sql
UNIQUE (account_id, phone_e164) WHERE (is_group = false)
```

Isso significa que só pode existir **UMA conversa** por contato, independente da instância WhatsApp usada.

## Solução

### 1. Migração de Banco de Dados

Alterar o índice único para incluir `integration_id`:

```sql
-- Remover índice antigo
DROP INDEX IF EXISTS zapp_conversations_account_phone_unique;

-- Criar novo índice que permite uma conversa por contato POR INSTÂNCIA
CREATE UNIQUE INDEX zapp_conversations_account_phone_integration_unique 
ON zapp_conversations (account_id, phone_e164, integration_id) 
WHERE (is_group = false);
```

### 2. `src/pages/RoyZapp.tsx` - Busca de Conversa Existente

**Arquivo:** `src/pages/RoyZapp.tsx`  
**Local:** Linhas 3165-3171 (busca por telefone)

Adicionar filtro por `integration_id` na busca:

```typescript
// ANTES (encontrava qualquer conversa com o telefone)
const { data: convByPhone } = await supabase
  .from("zapp_conversations")
  .select("id, lead_id, client_id")
  .eq("account_id", currentUser.account_id)
  .eq("phone_e164", normalizedPhone)
  .eq("is_group", false)
  .maybeSingle();

// DEPOIS (encontra apenas conversa da instância atual)
const { data: convByPhone } = await supabase
  .from("zapp_conversations")
  .select("id, lead_id, client_id")
  .eq("account_id", currentUser.account_id)
  .eq("phone_e164", normalizedPhone)
  .eq("integration_id", selectedIntegrationId)  // NOVO: filtrar por instância
  .eq("is_group", false)
  .maybeSingle();
```

### 3. `src/hooks/useZappData.tsx` - Restaurar Filtro de Instância

**Arquivo:** `src/hooks/useZappData.tsx`  
**Local:** Linhas 905-912

Restaurar o filtro de `integration_id` para isolar conversas entre instâncias:

```typescript
// Restaurar filtro de integration_id para isolar conversas entre instâncias
if (integrationId) {
  filtered = filtered.filter(a => {
    const zappConv = a.zapp_conversation as { 
      integration_id?: string; 
      sector_id?: string;
      is_group?: boolean;
    } | null;
    const convIntegrationId = zappConv?.integration_id;
    const convSectorId = zappConv?.sector_id;
    const isGroup = zappConv?.is_group === true;
    
    // Include conversation if:
    // 1. It belongs to this exact integration, OR
    // 2. It has no integration_id (legacy) but belongs to the same sector, OR
    // 3. It's a GROUP (groups are cross-integration)
    const matchesIntegration = convIntegrationId === integrationId;
    const isLegacySameSector = !convIntegrationId && convSectorId === sectorId;
    
    return matchesIntegration || isLegacySameSector || isGroup;
  });
}
```

## Fluxo Após Correção

```text
┌────────────────────────────────────────────────────────────────────────┐
│ CENÁRIO: Mesmo contato, instâncias diferentes                          │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│ Instância "Eternum Club" (Vendas)                                      │
│ ├── Conversa com Ana Paula (+5511999...) → ID: abc123                  │
│ └── Mensagens específicas desta instância                              │
│                                                                        │
│ Instância "Jonathan Marcato" (Vendas)                                  │
│ ├── Conversa com Ana Paula (+5511999...) → ID: xyz789 (DIFERENTE!)     │
│ └── Mensagens específicas desta instância                              │
│                                                                        │
│ Instância "Operações" (Operações)                                      │
│ ├── Conversa com Ana Paula (+5511999...) → ID: def456 (DIFERENTE!)     │
│ └── Mensagens específicas desta instância                              │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## Resumo das Alterações

| Componente | Alteração |
|------------|-----------|
| Banco de Dados | Novo índice único incluindo `integration_id` |
| `RoyZapp.tsx` | Busca de conversa filtra por `integration_id` |
| `useZappData.tsx` | Restaurar filtro de `integration_id` na lista |

## Resultado Esperado

1. Cada instância WhatsApp terá suas próprias conversas isoladas
2. Mensagens de uma instância não aparecem em outra
3. O mesmo contato pode ter conversas diferentes com cada instância
4. Grupos continuam cross-integration (compartilhados)
