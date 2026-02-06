
# Plano: Correção do Filtro de Tarefas no Setor de Vendas

## Diagnóstico do Problema

A página de Tarefas está vazia apesar de mostrar contadores com valores (377 Pendentes, 282 Atrasadas, 623 Concluídas). O problema está na lógica do filtro de responsável.

### Causa Raiz: Precedência de Operadores JavaScript

O código atual em **duas** localizações está com um bug de precedência de operadores:

```javascript
// ❌ Código atual (linhas 409-410 e 1011-1012)
const matchesUser = filterUser === "all" || 
  filterUser === "mine" ? task.assigned_to === currentUser?.id : task.assigned_to === filterUser;
```

**Como o JavaScript interpreta:**
```javascript
const matchesUser = (filterUser === "all" || filterUser === "mine") 
  ? task.assigned_to === currentUser?.id 
  : task.assigned_to === filterUser;
```

**Resultado:**
- Quando `filterUser === "all"` (opção "Todos" selecionada):
  - A condição `(filterUser === "all" || filterUser === "mine")` é verdadeira
  - Então `matchesUser = task.assigned_to === currentUser?.id`
  - Isso filtra APENAS tarefas do usuário atual, **ignorando a opção "Todos"**

### Por que os contadores mostram valores corretos?

Os contadores (pendingCount, overdueCount, etc.) são calculados diretamente sobre o array `tasks` sem aplicar o filtro de usuário, por isso mostram os valores corretos.

---

## Solução

Adicionar parênteses para garantir a precedência correta:

```javascript
// ✅ Código corrigido
const matchesUser = filterUser === "all" || 
  (filterUser === "mine" ? task.assigned_to === currentUser?.id : task.assigned_to === filterUser);
```

---

## Arquivos a Modificar

### `src/pages/Tasks.tsx`

**Modificação 1 - Linha 409-410** (filteredTasks para lista):
```diff
-    const matchesUser = filterUser === "all" || 
-      filterUser === "mine" ? task.assigned_to === currentUser?.id : task.assigned_to === filterUser;
+    const matchesUser = filterUser === "all" || 
+      (filterUser === "mine" ? task.assigned_to === currentUser?.id : task.assigned_to === filterUser);
```

**Modificação 2 - Linha 1011-1012** (filtro do TaskKanban):
```diff
-            const matchesUser = filterUser === "all" || 
-              filterUser === "mine" ? task.assigned_to === currentUser?.id : task.assigned_to === filterUser;
+            const matchesUser = filterUser === "all" || 
+              (filterUser === "mine" ? task.assigned_to === currentUser?.id : task.assigned_to === filterUser);
```

---

## Impacto Esperado

Após a correção:
1. **"Todos" selecionado:** Exibe todas as tarefas (sem filtro de responsável)
2. **"Minhas tarefas" selecionado:** Exibe apenas tarefas onde `assigned_to === currentUser?.id`
3. **Usuário específico selecionado:** Exibe apenas tarefas daquele usuário

---

## Resumo

| Local | Linha | Ação |
|-------|-------|------|
| `src/pages/Tasks.tsx` | 409-410 | Adicionar parênteses no operador ternário |
| `src/pages/Tasks.tsx` | 1011-1012 | Adicionar parênteses no operador ternário |

**Risco:** Baixo - alteração pontual de sintaxe sem impacto em outras funcionalidades
**Tempo estimado:** 2 minutos
