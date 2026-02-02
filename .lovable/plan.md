
# Plano: Correção Definitiva do Isolamento por Instância WhatsApp

## Problemas Identificados

### Problema 1: Fallback de Busca no Frontend Ignora Instância
**Arquivo:** `src/pages/RoyZapp.tsx` (Linhas 3190-3203)

Quando o usuário seleciona "Tathiana Marinho" no dialog "Nova Conversa":
1. A busca primária por `phone_e164 + integration_id` não encontra (correto - não existe para esta instância)
2. O fallback busca por `lead_id` ou `client_id` **SEM filtrar por `integration_id`**
3. Encontra a conversa de OUTRA instância
4. Tenta abrir essa conversa, mas ela é filtrada da lista lateral
5. O validador detecta e mostra "Conversa pertence a outro setor"

### Problema 2: Webhook LAYER 1 Rouba Conversas
**Arquivo:** `supabase/functions/uazapi-webhook/index.ts` (Linhas 856-911)

Quando chega uma mensagem de um número que tem conversa em outra instância:
1. Busca primária por `phone + integration_id` falha
2. LAYER 1 busca cross-integration e encontra conversa de outro setor
3. **ATUALIZA a conversa para a instância que recebeu a mensagem** (linhas 879-890)
4. Isso "rouba" a conversa de um setor para outro

### Problema 3: Webhook LAYER 2 Mescla Conversas
**Arquivo:** `supabase/functions/uazapi-webhook/index.ts` (Linhas 913-1005)

Se existem múltiplas conversas com o mesmo número:
1. Move todas as mensagens para uma única conversa
2. Atualiza todos os assignments
3. **Deleta as conversas "duplicatas"** (linha 968-971)
4. Isso destrói o isolamento por instância

## Solução

### Correção 1: Frontend - Adicionar `integration_id` ao Fallback

```typescript
// Linha 3197 - Adicionar filtro de integration_id
const { data: convById } = await supabase
  .from("zapp_conversations")
  .select("id")
  .eq("account_id", currentUser.account_id)
  .eq(idField, contact.id)
  .eq("integration_id", selectedIntegrationId)  // ADICIONAR
  .maybeSingle();
```

### Correção 2: Webhook - Remover LAYER 1 Cross-Integration

Remover completamente as linhas 856-911 que buscam cross-integration e atualizam a conversa para outra instância.

O correto é: se não encontrou conversa para ESTA instância específica, **criar uma nova** (já acontece depois).

### Correção 3: Webhook - Remover LAYER 2 AUTO-UNIFY

Remover completamente as linhas 913-1005 que:
- Buscam TODAS as conversas do mesmo telefone
- Mesclam duplicatas
- Atualizam integration_id e sector_id

Cada instância DEVE ter sua própria conversa separada.

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/RoyZapp.tsx` | Adicionar `.eq("integration_id", selectedIntegrationId)` no fallback (linha 3197) |
| `supabase/functions/uazapi-webhook/index.ts` | Remover LAYER 1 cross-integration (linhas 856-911) |
| `supabase/functions/uazapi-webhook/index.ts` | Remover LAYER 2 AUTO-UNIFY (linhas 913-1005) |

## Fluxo Após Correção

```
CENÁRIO: Tathiana Marinho conversa com Vendas e Operações

┌─────────────────────────────────────────────────────────────┐
│ INSTÂNCIA "Eternum Club" (Vendas)                           │
├─────────────────────────────────────────────────────────────┤
│ • Conversa ID: abc123                                       │
│ • phone_e164: +5511999887766                                │
│ • integration_id: eternum-vendas                            │
│ • Mensagens: Histórico exclusivo de Vendas                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ INSTÂNCIA "Operações" (Operações)                           │
├─────────────────────────────────────────────────────────────┤
│ • Conversa ID: xyz789 (DIFERENTE!)                          │
│ • phone_e164: +5511999887766 (MESMO TELEFONE)               │
│ • integration_id: operacoes                                 │
│ • Mensagens: Histórico exclusivo de Operações               │
└─────────────────────────────────────────────────────────────┘
```

## Resultado Esperado

1. Cada instância WhatsApp terá sua própria conversa isolada com cada contato
2. Mensagens não "vazam" entre instâncias
3. Usuário pode criar nova conversa em qualquer instância, mesmo que o contato já tenha conversa em outra
4. O erro "Conversa pertence a outro setor" não ocorrerá mais
