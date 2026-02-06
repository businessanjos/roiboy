
# Plano: Ordenação por Colunas Clicáveis na Tabela de Tarefas

## Objetivo

Permitir ordenar a tabela de tarefas ao clicar nos cabeçalhos das colunas **Prioridade**, **Prazo** e **Responsável**, com ordenação exclusiva (apenas uma coluna ativa por vez).

## Regras de Ordenação

| Coluna | Ordem Crescente (↑) | Ordem Decrescente (↓) |
|--------|---------------------|----------------------|
| **Prioridade** | Alta → Média → Baixa | Baixa → Média → Alta |
| **Prazo** | Atrasado → Hoje → Dentro do prazo (mais distante) | Dentro do prazo → Hoje → Atrasado |
| **Responsável** | A → Z (alfabética) | Z → A (alfabética inversa) |

---

## Alterações Técnicas

### 1. Atualizar Tipo e Estado de Ordenação

**Linha 138** - Expandir `SortOption` para incluir "responsible":

```tsx
type SortOption = "priority" | "due_date" | "created_at" | "responsible";
type SortDirection = "asc" | "desc";
```

**Linha 174** - Adicionar estado de direção:

```tsx
const [sortBy, setSortBy] = useState<SortOption>("priority");
const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
```

### 2. Função de Toggle de Ordenação

Adicionar função para alternar ordenação ao clicar no cabeçalho:

```tsx
const handleColumnSort = useCallback((column: SortOption) => {
  if (sortBy === column) {
    // Toggle direction if same column
    setSortDirection(prev => prev === "asc" ? "desc" : "asc");
  } else {
    // New column - reset to ascending
    setSortBy(column);
    setSortDirection("asc");
  }
}, [sortBy]);
```

### 3. Atualizar Lógica de Ordenação (Linha 467-478)

Refatorar `sortedTasks` para considerar a direção:

```tsx
const sortedTasks = useMemo(() => {
  const sorted = [...filteredTasks].sort((a, b) => {
    let comparison = 0;
    
    if (sortBy === "priority") {
      // Alta (high=1) -> Média (medium=2) -> Baixa (low=3)
      comparison = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    } 
    else if (sortBy === "due_date") {
      // Atrasado (mais negativo) -> Hoje (0) -> Futuro (positivo)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const getDuePriority = (task: Task) => {
        if (!task.due_date) return Infinity; // Sem prazo vai pro final
        const dueDate = new Date(task.due_date);
        dueDate.setHours(0, 0, 0, 0);
        return differenceInDays(dueDate, today);
      };
      
      comparison = getDuePriority(a) - getDuePriority(b);
    }
    else if (sortBy === "responsible") {
      // Ordem alfabética pelo nome do responsável
      const nameA = a.assigned_user?.name?.toLowerCase() || "zzz"; // Sem responsável vai pro final
      const nameB = b.assigned_user?.name?.toLowerCase() || "zzz";
      comparison = nameA.localeCompare(nameB, "pt-BR");
    }
    else {
      // created_at - mais recente primeiro
      comparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    
    // Inverter se direção for descendente
    return sortDirection === "desc" ? -comparison : comparison;
  });
  
  return sorted;
}, [filteredTasks, sortBy, sortDirection]);
```

### 4. Cabeçalhos Clicáveis com Indicador Visual

Modificar o `TableHeader` (linhas 531-543) para tornar as colunas clicáveis:

```tsx
<TableHeader>
  <TableRow className="bg-muted/50">
    <TableHead className="w-[40px]"></TableHead>
    <TableHead className="font-medium min-w-[250px]">Tarefa</TableHead>
    <TableHead className="font-medium text-center min-w-[100px]">Status</TableHead>
    
    {/* Prioridade - Clicável */}
    <TableHead 
      className="font-medium text-center min-w-[100px] cursor-pointer hover:bg-muted/80 select-none"
      onClick={() => handleColumnSort("priority")}
    >
      <div className="flex items-center justify-center gap-1">
        Prioridade
        {sortBy === "priority" && (
          <ArrowUpDown className={cn("h-3 w-3", sortDirection === "desc" && "rotate-180")} />
        )}
      </div>
    </TableHead>
    
    {/* Prazo - Clicável */}
    <TableHead 
      className="font-medium text-center min-w-[100px] cursor-pointer hover:bg-muted/80 select-none"
      onClick={() => handleColumnSort("due_date")}
    >
      <div className="flex items-center justify-center gap-1">
        Prazo
        {sortBy === "due_date" && (
          <ArrowUpDown className={cn("h-3 w-3", sortDirection === "desc" && "rotate-180")} />
        )}
      </div>
    </TableHead>
    
    <TableHead className="font-medium min-w-[120px]">
      {hasVendasAccess ? "Contexto" : "Cliente"}
    </TableHead>
    
    {/* Responsável - Clicável */}
    <TableHead 
      className="font-medium text-center min-w-[80px] cursor-pointer hover:bg-muted/80 select-none"
      onClick={() => handleColumnSort("responsible")}
    >
      <div className="flex items-center justify-center gap-1">
        Responsável
        {sortBy === "responsible" && (
          <ArrowUpDown className={cn("h-3 w-3", sortDirection === "desc" && "rotate-180")} />
        )}
      </div>
    </TableHead>
    
    <TableHead className="font-medium text-right min-w-[60px]">Ação</TableHead>
  </TableRow>
</TableHeader>
```

---

## Arquivo a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/pages/Tasks.tsx` | Adicionar estado `sortDirection`, função `handleColumnSort`, refatorar `sortedTasks`, tornar cabeçalhos clicáveis |

---

## Comportamento Esperado

1. **Clique inicial**: Ativa ordenação crescente na coluna
2. **Clique repetido**: Alterna para decrescente
3. **Clique em outra coluna**: Muda para nova coluna com ordenação crescente
4. **Indicador visual**: Ícone de seta no cabeçalho ativo (↑ ou ↓)

| Ação | Resultado |
|------|-----------|
| Clicar "Prioridade" | Ordena Alta → Média → Baixa |
| Clicar "Prioridade" novamente | Ordena Baixa → Média → Alta |
| Clicar "Prazo" | Ordena Atrasado → Hoje → Futuro |
| Clicar "Responsável" | Ordena A → Z alfabeticamente |
