
# Plano: Isolamento de Grupos Privados por Instância WhatsApp

## Problema Identificado

Grupos privados (onde apenas uma instância WhatsApp específica participa, como "Jonathan Marcato") estão aparecendo na busca de outras instâncias (como "Eternum Club") porque:

1. A busca de grupos na dialog "Nova Conversa" filtra apenas por `account_id`, não por `integration_id`
2. Cada grupo no WhatsApp é registrado na tabela `zapp_conversations` com um `integration_id` específico (a instância que recebeu mensagens do grupo)
3. A query atual retorna TODOS os grupos da conta, independente de qual instância está selecionada

### Dados Atuais

| Instância | integration_id | Telefone | Setor |
|-----------|---------------|----------|-------|
| Jonathan Marcato | ac869d1d-... | 554399540408 | vendas |
| [CANAL] Eternum Club | dbb6109c-... | 554388346806 | operacoes |
| [COMERCIAL] Eternum Club | c3baa312-... | 554388382681 | vendas |

## Comportamento Desejado

- **Grupos com apenas 1 instância**: Devem aparecer SOMENTE para essa instância
- **Grupos com múltiplas instâncias**: Podem aparecer para todas as instâncias que participam

Como cada instância que participa de um grupo terá seu próprio registro `zapp_conversations` (com seu `integration_id`), basta filtrar pela instância selecionada.

## Solução

Modificar a query de busca de grupos para filtrar pelo `integration_id` da instância atualmente selecionada. Isso garante que apenas grupos onde a instância selecionada participa apareçam nos resultados.

## Arquivos a Modificar

### 1. `src/pages/RoyZapp.tsx`

**Localização**: Função `searchContacts` (linhas ~2953-2962)

**Modificação**: Adicionar filtro `integration_id` na query de grupos

**Antes**:
```tsx
// 4. Search groups by name (cross-sector: no sector filter)
supabase
  .from("zapp_conversations")
  .select("id, contact_name, avatar_url, group_jid, sector_id")
  .eq("account_id", currentUser.account_id)
  .eq("is_group", true)
  .ilike("contact_name", `%${textSearch}%`)
  .order("last_message_at", { ascending: false })
  .limit(25),
```

**Depois**:
```tsx
// 4. Search groups by name - FILTER BY INTEGRATION for private groups
supabase
  .from("zapp_conversations")
  .select("id, contact_name, avatar_url, group_jid, sector_id, integration_id")
  .eq("account_id", currentUser.account_id)
  .eq("is_group", true)
  .eq("integration_id", selectedIntegrationId)  // NOVO: Isola grupos por instância
  .ilike("contact_name", `%${textSearch}%`)
  .order("last_message_at", { ascending: false })
  .limit(25),
```

## Considerações Técnicas

### Por que filtrar por `integration_id`?

1. **Isolamento Nativo**: Cada conversa de grupo já está vinculada à instância que a recebeu via `integration_id`
2. **Simplicidade**: Não requer cache de participantes (tabela `whatsapp_group_participants` está vazia)
3. **Performance**: Usa índice existente na query

### Cenários de Uso

| Cenário | Comportamento |
|---------|---------------|
| Grupo privado "Cliente + Jonathan Marcato" | Aparece só em "Jonathan Marcato" |
| Grupo com múltiplas instâncias | Cada instância tem seu próprio registro, aparece corretamente para cada uma |
| Buscar grupo de outro setor | Só aparece se a instância selecionada participa desse grupo |

### Edge Case: Grupos Legados

Grupos criados antes do sistema multi-instância podem não ter `integration_id`. Para manter compatibilidade, a query pode incluir fallback para `sector_id` se `integration_id` não estiver definido.

**Versão com Fallback**:
```tsx
// Build group query with integration filtering
let groupQuery = supabase
  .from("zapp_conversations")
  .select("id, contact_name, avatar_url, group_jid, sector_id, integration_id")
  .eq("account_id", currentUser.account_id)
  .eq("is_group", true)
  .ilike("contact_name", `%${textSearch}%`)
  .order("last_message_at", { ascending: false })
  .limit(25);

// Filter by integration if available (isolates private groups)
if (selectedIntegrationId) {
  groupQuery = groupQuery.eq("integration_id", selectedIntegrationId);
} else if (selectedSectorId) {
  // Fallback to sector for legacy groups without integration_id
  groupQuery = groupQuery.eq("sector_id", selectedSectorId);
}
```

## Impacto

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Grupos de "Jonathan Marcato" | Visíveis para todas as instâncias | Visíveis só para "Jonathan Marcato" |
| Busca cross-sector de grupos | Permitida sem restrição | Restrita à instância selecionada |
| Performance | Retorna muitos grupos | Retorna apenas grupos relevantes |

## Arquivos Modificados

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/RoyZapp.tsx` | Adicionar filtro `integration_id` na função `searchContacts` |

## Resultado Esperado

Ao buscar grupos na instância "Eternum Club", apenas grupos onde essa instância participa serão exibidos. Grupos privados da instância "Jonathan Marcato" não aparecerão mais na busca.
