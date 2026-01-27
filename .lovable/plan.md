

# Plano: Garantir Acesso Cross-Setor a Contatos e Grupos

## Resumo do Problema

Usuários do setor de Operações relatam não conseguir encontrar o grupo "Henrique & Letícia - Eternum Club" na busca "Nova Conversa", embora o grupo exista no banco de dados (no setor Diretoria).

## Diagnóstico Detalhado

### O que já funciona corretamente

| Aspecto | Status | Detalhes |
|---------|--------|----------|
| Query SQL | OK | Busca por "Henrique" retorna o grupo corretamente |
| RLS Policy | OK | Usa apenas `account_id`, não filtra por setor |
| Código de busca | OK | `searchContacts()` não filtra por setor |
| Limite de resultados | OK | Há apenas 1 grupo com "Henrique", dentro do limite 10 |

### Possíveis Causas do Problema

1. **Erro silencioso no frontend** - A query pode falhar sem mostrar erro
2. **Cache do navegador** - Dados antigos podem estar sendo exibidos
3. **Problema de timing** - Busca pode estar sendo cancelada antes de completar
4. **Termo de busca diferente** - Usuário pode estar buscando por termo que não retorna resultados

## Modificações Propostas

### 1. Adicionar Logs de Debug na Busca (`src/pages/RoyZapp.tsx`)

Adicionar logging detalhado para identificar se:
- A query está sendo executada
- Os resultados estão chegando
- Há erros silenciosos

```typescript
// Após a linha 2647 (resultado das queries)
console.log("[SearchContacts] Query completed:", {
  term: textSearch,
  groupsFound: groupsResult.data?.length || 0,
  groupsError: groupsResult.error,
  groups: groupsResult.data?.map(g => ({ name: g.contact_name, id: g.id }))
});
```

### 2. Aumentar Limite de Grupos para 25 (Preventivo)

Embora o limite atual não seja o problema neste caso específico, aumentá-lo previne problemas futuros:

**Linha 2646:** Alterar `.limit(10)` para `.limit(25)`

### 3. Adicionar Tratamento de Erro Explícito

Garantir que erros na busca de grupos sejam exibidos:

```typescript
if (groupsResult.error) {
  console.error("[SearchContacts] Groups query error:", groupsResult.error);
  toast.error("Erro ao buscar grupos");
}
```

### 4. Verificar e Documentar Comportamento Esperado

| Cenário | Comportamento Esperado |
|---------|------------------------|
| Grupo em outro setor | DEVE aparecer na busca |
| Contato em outro setor | DEVE aparecer na busca |
| Clicar em grupo de outro setor | Cria assignment para setor atual |
| Conversas do grupo | Separadas por departamento |

## Fluxo Cross-Setor (Confirmação)

```text
┌─────────────────────────────────────────────────────────────────┐
│                    ACESSO CROSS-SETOR                          │
├─────────────────────────────────────────────────────────────────┤
│ BUSCA "NOVA CONVERSA":                                         │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Query: SELECT ... FROM zapp_conversations                  │ │
│ │        WHERE account_id = ? AND is_group = true           │ │
│ │        AND contact_name ILIKE '%Henrique%'                │ │
│ │                                                            │ │
│ │ → NÃO filtra por sector_id ou integration_id              │ │
│ │ → Retorna grupos de TODOS os setores                      │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ CLIQUE NO GRUPO:                                               │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ 1. Verifica se já existe assignment no departamento atual │ │
│ │    → Se SIM: Abre a conversa existente                    │ │
│ │    → Se NÃO: Cria novo assignment para o departamento     │ │
│ │                                                            │ │
│ │ 2. Resultado: Cada setor tem seu próprio assignment       │ │
│ │    → Diretoria: assignment ID 370d4e60...                 │ │
│ │    → Operações: cria novo assignment (se acessado)        │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ CONVERSAS:                                                      │
│ → Mensagens são globais (todas vinculadas ao zapp_conversation)│
│ → Assignments são separados por departamento                   │
│ → Status (triage, active, closed) é independente por setor    │
└─────────────────────────────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/RoyZapp.tsx` | Adicionar logs de debug e aumentar limite de grupos |

## Detalhes Técnicos das Mudanças

### Modificação em `src/pages/RoyZapp.tsx`

**Linhas 2638-2647** - Busca de grupos:

```typescript
// 4. Search groups by name
supabase
  .from("zapp_conversations")
  .select("id, contact_name, avatar_url, group_jid, sector_id")  // Adicionar sector_id para debug
  .eq("account_id", currentUser.account_id)
  .eq("is_group", true)
  .ilike("contact_name", `%${textSearch}%`)
  .order("last_message_at", { ascending: false })
  .limit(25),  // Aumentar de 10 para 25
```

**Após linha 2647** - Adicionar logs:

```typescript
// Debug logging para identificar problemas de busca
console.log("[SearchContacts] Query term:", textSearch);
console.log("[SearchContacts] Groups result:", {
  count: groupsResult.data?.length || 0,
  error: groupsResult.error,
  data: groupsResult.data?.slice(0, 5).map(g => ({ id: g.id, name: g.contact_name }))
});

if (groupsResult.error) {
  console.error("[SearchContacts] Groups error:", groupsResult.error);
}
```

## Teste de Validação

Após implementar:

1. Acessar RoyZapp como usuário do setor **Operações**
2. Clicar em "Nova Conversa"
3. Buscar por "Henrique"
4. Verificar console para logs
5. Confirmar que o grupo "Henrique & Leticia" aparece
6. Clicar no grupo
7. Confirmar que um novo assignment é criado para Operações

## Resultado Esperado

- Grupos de **qualquer setor** aparecerão na busca de **qualquer outro setor**
- Cada setor mantém seus próprios assignments (status, agente, etc.)
- Mensagens continuam visíveis para todos que têm acesso ao grupo
- Logs no console ajudarão a identificar problemas futuros

