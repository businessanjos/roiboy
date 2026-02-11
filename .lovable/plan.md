
## Filtros Persistentes por Usuario

### O que sera feito

Criar um hook utilitario `usePersistedFilter` que substitui o `useState` nos filtros de todas as paginas, salvando e restaurando automaticamente os valores no `localStorage` com chave unica por usuario e por pagina. Quando o usuario aplicar qualquer filtro, ele permanecera ativo mesmo ao trocar de aba, fechar o navegador ou reabrir o ROY. Cada usuario tera seus proprios filtros independentes.

### Como vai funcionar

- Ao carregar uma pagina, os filtros serao restaurados do `localStorage` com o valor salvo pelo usuario
- Ao alterar qualquer filtro, o valor e salvo imediatamente no `localStorage`
- Ao limpar filtros manualmente (botao "Limpar filtros"), os valores voltam ao padrao e o `localStorage` e atualizado
- Chave de armazenamento: `roy_filters_{userId}_{pagina}_{campo}` -- isso garante isolamento por usuario

### Paginas afetadas

1. **Clientes** - filterClientStatus, filterProduct, filterVNPS, filterContract, filterResponsible, sortOrder
2. **Tarefas** - filterUser, filterActivityType, sortBy, sortDirection, filterDateStart, filterDateEnd
3. **Contratos** - searchTerm, statusFilter, typeFilter, productFilter, sortOrder
4. **Pipeline de Vendas** - wonMonthFilter, lostMonthFilter
5. **Financeiro** - statusFilter, categoryFilter
6. **Dashboard** - statusFilter, quadrantFilter, productFilter

Nota: campos de busca textual (searchQuery/searchTerm) NAO serao persistidos nas paginas de Clientes e Dashboard, pois a busca e mais contextual e transitoria. Nos Contratos sera persistida pois o usuario ja espera esse comportamento.

### Detalhes tecnicos

**Novo arquivo:** `src/hooks/usePersistedFilter.ts`

Um hook simples que encapsula `useState` + `localStorage`:

```typescript
import { useState, useCallback } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function usePersistedFilter<T>(
  page: string,
  field: string,
  defaultValue: T
): [T, (value: T) => void] {
  const { currentUser } = useCurrentUser();
  const storageKey = `roy_filters_${currentUser?.id}_${page}_${field}`;

  const [value, setValue] = useState<T>(() => {
    if (!currentUser?.id) return defaultValue;
    try {
      const saved = localStorage.getItem(storageKey);
      return saved !== null ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setPersistedValue = useCallback((newValue: T) => {
    setValue(newValue);
    if (currentUser?.id) {
      const key = `roy_filters_${currentUser.id}_${page}_${field}`;
      if (newValue === defaultValue) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(newValue));
      }
    }
  }, [currentUser?.id, page, field, defaultValue]);

  return [value, setPersistedValue];
}
```

**Alteracoes nas paginas:**

Em cada pagina listada acima, substituir os `useState` dos filtros por `usePersistedFilter`. Exemplo para Clientes:

```typescript
// Antes:
const [filterClientStatus, setFilterClientStatus] = useState<string>("all");

// Depois:
const [filterClientStatus, setFilterClientStatus] = usePersistedFilter("clients", "clientStatus", "all");
```

A mesma substituicao sera aplicada em todos os filtros de todas as 6 paginas. Nenhuma outra alteracao de logica e necessaria, pois a interface do hook e identica a do `useState`.
