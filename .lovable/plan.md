
# Plano: Corrigir Erro "Erro ao buscar grupos" na Busca de Nova Conversa

## Problema Identificado

A mensagem "Erro ao buscar grupos" aparece repetidamente porque a query de busca de grupos usa `.eq("integration_id", selectedIntegrationId)` mas `selectedIntegrationId` pode ser `undefined` em algumas situações:

1. Componente carrega inicialmente sem `integrationId` na URL
2. A busca assíncrona de preferências/integrações ainda não terminou
3. Não existem integrações conectadas para o setor

Quando `selectedIntegrationId` é `undefined`, o Supabase tenta comparar com valor nulo, causando erro na query ou resultados incorretos.

## Código Atual com Problema

```tsx
// Linha 2953-2962 em RoyZapp.tsx
supabase
  .from("zapp_conversations")
  .select("id, contact_name, avatar_url, group_jid, sector_id, integration_id")
  .eq("account_id", currentUser.account_id)
  .eq("is_group", true)
  .eq("integration_id", selectedIntegrationId)  // PROBLEMA: Falha se undefined
  .ilike("contact_name", `%${textSearch}%`)
```

## Solução

Aplicar filtro condicional: usar `integration_id` se disponível, senão fazer fallback para `sector_id`, mantendo compatibilidade com grupos legados e evitando erros.

## Modificação Proposta

### Arquivo: `src/pages/RoyZapp.tsx`

**Localização**: Função `searchContacts`, linhas ~2953-2962

**De**:
```tsx
// 4. Search groups by name - FILTER BY INTEGRATION for private groups
supabase
  .from("zapp_conversations")
  .select("id, contact_name, avatar_url, group_jid, sector_id, integration_id")
  .eq("account_id", currentUser.account_id)
  .eq("is_group", true)
  .eq("integration_id", selectedIntegrationId)
  .ilike("contact_name", `%${textSearch}%`)
  .order("last_message_at", { ascending: false })
  .limit(25),
```

**Para**:
```tsx
// 4. Search groups by name - FILTER BY INTEGRATION for private groups
// Apply integration filter only if available, otherwise fallback to sector
(async () => {
  let query = supabase
    .from("zapp_conversations")
    .select("id, contact_name, avatar_url, group_jid, sector_id, integration_id")
    .eq("account_id", currentUser.account_id)
    .eq("is_group", true)
    .ilike("contact_name", `%${textSearch}%`)
    .order("last_message_at", { ascending: false })
    .limit(25);
  
  // Apply isolation filter only when integration is selected
  if (selectedIntegrationId) {
    query = query.eq("integration_id", selectedIntegrationId);
  } else if (selectedSectorId) {
    // Fallback to sector for legacy groups or when no integration selected
    query = query.eq("sector_id", selectedSectorId);
  }
  
  return query;
})(),
```

## Lógica do Filtro Condicional

| Cenário | Filtro Aplicado | Comportamento |
|---------|-----------------|---------------|
| `selectedIntegrationId` definido | `integration_id = X` | Mostra apenas grupos da instância selecionada |
| Apenas `selectedSectorId` definido | `sector_id = X` | Mostra grupos do setor (fallback para legados) |
| Nenhum definido | Sem filtro adicional | Mostra todos os grupos da conta |

## Por que Essa Solução Funciona

1. **Evita erro de query**: Não passa `undefined` para `.eq()`
2. **Mantém isolamento de grupos privados**: Quando integração está selecionada, filtra corretamente
3. **Compatibilidade com legados**: Grupos antigos sem `integration_id` ainda aparecem via fallback de setor
4. **Graceful degradation**: Se nada estiver selecionado, a busca ainda funciona

## Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/RoyZapp.tsx` | Adicionar verificação condicional antes de aplicar filtro `integration_id` na busca de grupos |
