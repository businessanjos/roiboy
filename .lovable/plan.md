

## Adicionar coluna de Status e filtro na listagem de Eventos

### O que sera feito

1. **Nova coluna "Status"** na tabela de eventos, posicionada entre "Produtos" e "Acoes", exibindo badges coloridos:
   - **Em Aberto** (badge outline/cinza) - para eventos com status `null`, `draft`, `planned`, `confirmed` ou `in_progress`
   - **Concluido** (badge verde/secondary) - para status `completed`
   - **Cancelado** (badge vermelho/destructive) - para status `cancelled`

2. **Novo filtro de Status** ao lado dos filtros existentes (Tipo e Modalidade), com as opcoes:
   - Todos os status (default)
   - Em Aberto
   - Concluido
   - Cancelado

3. **Logica de filtragem** atualizada para considerar o novo filtro

### Detalhes tecnicos

**Arquivo: `src/pages/Events.tsx`**

- Adicionar estado `filterStatus` com valor default `"all"`
- Incluir o campo `status` na interface `Event` (ja existe na tabela do banco, mas nao esta na interface local)
- Adicionar um novo `FilterItem` com `Select` para o filtro de status entre as opcoes: "Todos os status", "Em Aberto", "Concluido", "Cancelado"
- Atualizar `filteredEvents` para incluir filtro por status, mapeando "open" para qualquer status que nao seja `completed` nem `cancelled`
- Atualizar `hasActiveFilters` e `clearFilters` para incluir o novo filtro
- Adicionar `TableHead` "Status" no header da tabela (entre Produtos e Acoes)
- Adicionar `TableCell` com badge colorido para cada evento na tabela

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Events.tsx` | Nova coluna Status na tabela + novo filtro de status + estado filterStatus + logica de filtragem |

