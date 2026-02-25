

## Corrigir tarefas da Vanessa Minelli nao aparecendo na aba Tarefas

### Diagnostico

O problema esta na query que busca as tarefas na pagina `/tasks`. A query em `src/pages/Tasks.tsx` (linha 211-232) busca todas as tarefas ordenadas por `created_at desc` **sem definir um limite explicito**. O Supabase aplica automaticamente um limite padrao de **1000 linhas**.

A evidencia e clara: a aba "Todas" mostra exatamente **1000** -- que e o limite padrao do Supabase. Isso significa que a conta possui mais de 1000 tarefas no total. Como a query retorna apenas as 1000 mais recentes, as tarefas atribuidas a Vanessa Minelli podem estar alem desse corte, resultando em 0 tarefas apos o filtro por usuario ser aplicado no frontend.

### Solucao

#### 1. `src/pages/Tasks.tsx` - Aplicar filtros no servidor e aumentar limite

Modificar a query para:

- **Adicionar filtro server-side de usuario** quando um usuario especifico esta selecionado (nao "all" nem "mine"), adicionando `.eq("assigned_to", filterUser)` diretamente na query do Supabase
- **Adicionar filtro server-side "mine"** quando filterUser === "mine", usando `.eq("assigned_to", currentUser.id)`
- **Incluir `filterUser` e `currentUser?.id` na queryKey** do React Query para que a query refaca o fetch quando o filtro de usuario mudar
- **Adicionar `.limit(5000)`** como rede de seguranca para o caso "all" (sem filtro de usuario), garantindo que mais tarefas sejam carregadas

Essa abordagem garante que quando o usuario seleciona "Vanessa Minelli" no filtro, o banco retorna especificamente as tarefas dela, sem ser limitado pelas 1000 mais recentes de toda a equipe.

#### 2. Corrigir badge "Todas" para mostrar contagem filtrada

Atualmente o badge do tab "Todas" mostra `tasks.length` (o total bruto retornado pela query), que pode ser confuso. Alterar para mostrar `baseFilteredTasks.length` para que reflita a quantidade real apos os filtros aplicados.

### Detalhes tecnicos

```text
Antes:
  queryKey: ["internal-tasks"]
  query: supabase.from("internal_tasks").select(...).order(...)
  → Retorna ate 1000 tarefas (limite padrao)

Depois:
  queryKey: ["internal-tasks", filterUser, currentUser?.id]
  query: supabase.from("internal_tasks").select(...)
    .eq("assigned_to", userId)  // quando filtro especifico
    .order(...)
    .limit(5000)                // rede de seguranca
  → Retorna as tarefas corretas do usuario selecionado
```

### Impacto

- A query do Kanban (linhas 1310-1322) tambem se beneficia, pois usa o mesmo array `tasks`
- Os cards de estatisticas (Pendentes, Em andamento, Atrasadas, Concluidas) passarao a mostrar os valores corretos
- Performance: a query com filtro de usuario sera mais rapida que buscar todas as 5000 tarefas

