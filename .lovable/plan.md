
# Plano: Correção dos Erros de Atribuição na Fila de Triagem

## Diagnóstico

Após investigação detalhada do código, banco de dados e políticas RLS, identifiquei a causa raiz dos erros:

### Problema Identificado

O componente `ContractTriageQueue.tsx` está tentando atualizar uma coluna que **NÃO EXISTE** na tabela `clients`:

```typescript
// Código atual - LINHA 168-174
const { error } = await supabase
  .from("clients")
  .update({
    responsible_user_id: currentUser.id,
    updated_at: new Date().toISOString(),  // ERRO: Esta coluna não existe!
  })
  .eq("id", clientId);
```

A tabela `clients` possui apenas `created_at`, não possui `updated_at`. Quando o Supabase tenta executar este update, ele falha porque a coluna não existe.

### Evidência

A verificação do schema da tabela `clients` confirma que não há coluna `updated_at`:
- Colunas existentes incluem: `id`, `account_id`, `full_name`, `phone_e164`, `created_at`, `responsible_user_id`, etc.
- Coluna `updated_at` está **ausente**

---

## Solução

### Correção no Arquivo: `src/components/contracts/ContractTriageQueue.tsx`

Remover a referência à coluna `updated_at` em ambas as funções de atualização:

**1. Função `handlePullClient` (linhas 160-186):**

```typescript
const handlePullClient = async (clientId: string) => {
  if (!currentUser) {
    toast.error("Usuário não autenticado");
    return;
  }

  setPullingClientId(clientId);
  try {
    const { error } = await supabase
      .from("clients")
      .update({
        responsible_user_id: currentUser.id,
        // Remover: updated_at: new Date().toISOString(),
      })
      .eq("id", clientId);

    if (error) throw error;

    toast.success("Cliente atribuído a você!");
    onRefresh();
  } catch (error) {
    console.error("Error pulling client:", error);
    toast.error("Erro ao puxar cliente");
  } finally {
    setPullingClientId(null);
  }
};
```

**2. Função `handleAssignResponsible` (linhas 188-210):**

```typescript
const handleAssignResponsible = async (clientId: string, userId: string) => {
  setAssigningClientId(clientId);
  try {
    const { error } = await supabase
      .from("clients")
      .update({
        responsible_user_id: userId,
        // Remover: updated_at: new Date().toISOString(),
      })
      .eq("id", clientId);

    if (error) throw error;

    const assignedUser = teamUsers.find((u) => u.id === userId);
    toast.success(`Cliente atribuído a ${assignedUser?.name || "usuário"}!`);
    onRefresh();
  } catch (error) {
    console.error("Error assigning responsible:", error);
    toast.error("Erro ao atribuir responsável");
  } finally {
    setAssigningClientId(null);
  }
};
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/contracts/ContractTriageQueue.tsx` | Remover referência a `updated_at` nas funções `handlePullClient` e `handleAssignResponsible` |

---

## Impacto Esperado

- O botão "Puxar" passará a funcionar corretamente
- O seletor "Atribuir a..." passará a funcionar corretamente
- Clientes poderão ser atribuídos a consultores sem erros
- O fluxo de triagem da operação será restaurado

## Considerações Técnicas

A coluna `updated_at` é comumente usada para rastrear a última modificação de um registro. Se for desejável ter essa funcionalidade no futuro, seria necessário:

1. Adicionar a coluna `updated_at` na tabela `clients` via migração
2. Opcionalmente criar um trigger para atualizar automaticamente este valor

Porém, para resolver o problema imediato, basta remover a referência à coluna inexistente.
