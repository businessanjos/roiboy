
# Plano: Ordenação de Eventos por Data na Aba Eventos (Operações)

## Visão Geral

Adicionar funcionalidade de ordenação por data na aba Eventos do setor Operações, permitindo alternar entre ordem cronológica (mais antigo → mais recente) e ordem inversa (mais recente → mais antigo).

---

## Arquitetura da Solução

### Estado de Ordenação

Adicionar novo estado para controlar a direção da ordenação:

```typescript
const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
```

**Padrão:** `"asc"` (mais antigo → mais recente, conforme solicitado)

---

## Alterações no Arquivo

### `src/pages/Events.tsx`

#### 1. Adicionar Import do Ícone

Adicionar `ArrowUp` e `ArrowDown` aos imports de lucide-react (linha 49-70):

```typescript
import { 
  // ... existentes
  ArrowUp,
  ArrowDown
} from "lucide-react";
```

#### 2. Adicionar Estado de Ordenação

Próximo aos outros estados de filtro (após linha 148):

```typescript
const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
```

#### 3. Atualizar Query para Incluir sortOrder no Cache Key

A query atual (linhas 210-238) já ordena pelo banco. Precisamos incluir `sortOrder` na query key para invalidar corretamente:

```typescript
const { data: events = [], isLoading: loading } = useQuery({
  queryKey: ["events-with-products", sortOrder],  // ← Adicionar sortOrder
  queryFn: async () => {
    const { data, error } = await supabase
      .from("events")
      .select(`...`)
      .order("scheduled_at", { ascending: sortOrder === "asc", nullsFirst: false });
    // ...
  },
});
```

#### 4. Atualizar Cabeçalho da Tabela "Data/Hora"

Transformar o cabeçalho "Data/Hora" (linha 1166) em um botão clicável:

```typescript
<TableHead 
  className="min-w-[140px] cursor-pointer hover:bg-muted/80 transition-colors select-none"
  onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
>
  <div className="flex items-center gap-1.5">
    Data/Hora
    {sortOrder === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-primary" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-primary" />
    )}
  </div>
</TableHead>
```

---

## Comportamento Esperado

| Estado | Ordem | Ícone |
|--------|-------|-------|
| `"asc"` (padrão) | Mais antigo → Mais recente | ↑ ArrowUp |
| `"desc"` | Mais recente → Mais antigo | ↓ ArrowDown |

---

## Diagrama de Interação

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Usuário acessa a aba Eventos                             │
│    ↓                                                        │
│ 2. Lista carrega com ordenação padrão (asc - antigo→novo)   │
│    ↓                                                        │
│ 3. Usuário clica no cabeçalho "Data/Hora"                   │
│    ↓                                                        │
│ 4. setSortOrder alterna para "desc" (novo→antigo)           │
│    ↓                                                        │
│ 5. React Query refaz a requisição com nova ordenação        │
│    ↓                                                        │
│ 6. Lista atualiza mostrando eventos mais recentes primeiro  │
│    ↓                                                        │
│ 7. Ícone muda de ↑ para ↓                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Resumo das Modificações

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/Events.tsx` | Adicionar imports ArrowUp/ArrowDown, estado sortOrder, incluir na queryKey, atualizar TableHead para ser clicável |

---

## Notas Técnicas

### Ordenação no Banco vs Frontend

A ordenação é feita **no banco de dados** (não no frontend), garantindo performance mesmo com muitos eventos. O Supabase já indexa `scheduled_at`, então a ordenação é eficiente.

### Eventos sem Data

Eventos do tipo "Material" podem não ter `scheduled_at`. O parâmetro `nullsFirst: false` garante que esses eventos fiquem no final da lista, independente da direção da ordenação.

### Persistência do Estado

O estado de ordenação não é persistido no localStorage ou URL - ele reseta para "asc" ao recarregar a página, conforme comportamento padrão solicitado.
