
# Plano: Corrigir Duplicação de Conversas no ROY zAPP

## Problema Identificado

### Situação Atual
O usuário Jonathan Marcato está enfrentando duplicação de conversas quando envia mensagens para contatos que já possuem histórico. Ao investigar o banco de dados, encontrei:

**Exemplo concreto - Monick Oliveira Nunes (telefone: +5575991258078):**
- **Conversa antiga (29/01):** Criada sem `integration_id` (legado), com todo o histórico de mensagens
- **Conversa nova (03/02):** Criada COM `integration_id`, duplicando o contato

**Dados do banco:**
- Setor Vendas: **116 conversas sem integration_id** (conversas legadas)
- O sistema está filtrando por `integration_id` mas não encontra as conversas antigas

### Causa Raiz
Quando o sistema de multi-instância foi implementado, o campo `integration_id` foi adicionado para isolar conversas por instância WhatsApp. Porém, as **conversas criadas antes dessa mudança não têm `integration_id`**.

O código atual em `createConversationWithContact`:
```typescript
// Busca estrita por integration_id
const { data: convByPhone } = await supabase
  .from("zapp_conversations")
  .eq("phone_e164", normalizedPhone)
  .eq("integration_id", selectedIntegrationId)  // ← Não encontra conversas sem integration_id!
  .maybeSingle();
```

Quando a busca não encontra nada (porque a conversa existe mas não tem integration_id), o sistema cria uma nova conversa, gerando a duplicação.

---

## Solução Proposta

### 1. Adicionar Busca de Fallback para Conversas Legadas

Modificar a lógica de busca para incluir um fallback que:
1. Primeiro busca com `integration_id` (comportamento atual)
2. Se não encontrar, busca no mesmo setor **sem filtro de integration_id**
3. Se encontrar conversa legada, atualiza o `integration_id` para o valor correto

### 2. Migração de Dados (Opcional mas Recomendado)

Criar uma migração que atualiza as conversas legadas sem `integration_id` com o integration_id do setor correspondente.

---

## Modificações Técnicas

### Arquivo 1: `src/pages/RoyZapp.tsx`

**Função `createConversationWithContact` (linhas 3214-3256):**

Alterar a lógica de busca para incluir fallback:

```typescript
// PASSO 1: Busca exata por telefone + integration_id
let convByPhone = await supabase
  .from("zapp_conversations")
  .select("id, lead_id, client_id, integration_id")
  .eq("account_id", currentUser.account_id)
  .eq("phone_e164", normalizedPhone)
  .eq("integration_id", selectedIntegrationId)
  .eq("is_group", false)
  .maybeSingle();

// PASSO 2: FALLBACK - Se não encontrou, buscar conversa LEGADA (mesmo telefone, mesmo setor, sem integration_id)
if (!convByPhone?.data) {
  const { data: legacyConv } = await supabase
    .from("zapp_conversations")
    .select("id, lead_id, client_id, integration_id")
    .eq("account_id", currentUser.account_id)
    .eq("phone_e164", normalizedPhone)
    .eq("sector_id", selectedSectorId)
    .is("integration_id", null)  // Busca conversas sem integration_id
    .eq("is_group", false)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (legacyConv) {
    // Encontrou conversa legada! Atualizar com integration_id correto
    await supabase
      .from("zapp_conversations")
      .update({ integration_id: selectedIntegrationId })
      .eq("id", legacyConv.id);
    
    convByPhone = { data: legacyConv };
    console.log("[RoyZapp] Conversa legada encontrada e migrada:", legacyConv.id);
  }
}
```

**Função `createConversationFromUrl` (linhas 347-382):**

Aplicar a mesma lógica de fallback para manter consistência.

### Arquivo 2: `supabase/functions/uazapi-webhook/index.ts`

O webhook já tem lógica de fallback para formato de telefone (12 vs 13 dígitos), mas precisa adicionar fallback para conversas sem integration_id:

**Após a busca principal (linha ~848), adicionar:**

```typescript
// FALLBACK: Buscar conversa legada (mesmo telefone, mesmo setor, sem integration_id)
if (!existingZappConvo && phone && sectorId) {
  const { data: legacyData } = await supabase
    .from("zapp_conversations")
    .select("id, unread_count, integration_id, contact_name, client_id, lead_id, phone_e164, sector_id")
    .eq("account_id", accountId)
    .eq("phone_e164", phone)
    .eq("sector_id", sectorId)
    .is("integration_id", null)
    .eq("is_group", false)
    .maybeSingle();
  
  if (legacyData) {
    existingZappConvo = legacyData;
    console.log(`[LEGACY] Found legacy conversation ${legacyData.id}, updating integration_id to ${integrationId}`);
    
    // Migrar para novo formato
    await supabase
      .from("zapp_conversations")
      .update({ integration_id: integrationId })
      .eq("id", legacyData.id);
  }
}
```

---

## Fluxo Após Correção

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ USUÁRIO ENVIA MENSAGEM PARA CONTATO EXISTENTE                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ 1. Buscar conversa por: phone + integration_id                          │
│    └── Encontrou? → Usar essa conversa ✓                               │
│                                                                         │
│ 2. [NOVO] Se não encontrou, buscar por: phone + sector_id + integration_id IS NULL │
│    └── Encontrou conversa legada?                                       │
│        ├── SIM: Atualizar integration_id + Usar essa conversa ✓        │
│        └── NÃO: Criar nova conversa                                     │
│                                                                         │
│ RESULTADO: Sem duplicação! Conversas legadas são migradas on-demand     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/RoyZapp.tsx` | Adicionar fallback na busca de `createConversationWithContact` e `createConversationFromUrl` para encontrar conversas legadas sem integration_id |
| `supabase/functions/uazapi-webhook/index.ts` | Adicionar fallback similar no webhook para mensagens recebidas |

---

## Benefícios

1. **Elimina duplicação** - Conversas legadas são encontradas e reutilizadas
2. **Migração on-demand** - Cada conversa legada é atualizada com integration_id quando acessada
3. **Preserva histórico** - Todas as mensagens antigas permanecem na mesma conversa
4. **Zero breaking changes** - Não afeta conversas que já têm integration_id
5. **Auto-healing** - Com o tempo, todas as 116 conversas legadas serão migradas automaticamente

---

## Estimativa

- **Complexidade**: Baixa
- **Arquivos afetados**: 2
- **Risco**: Baixo (apenas adiciona fallback, não altera lógica existente)
