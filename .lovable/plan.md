

## Corrigir funcionalidades de Vendas na pagina de Tarefas que nao aparecem

### Diagnostico

As tres funcionalidades (coluna Etapa, abrir detalhes do negocio, follow-up automatico) **estao no codigo**, mas estao condicionadas a `hasVendasAccess` -- que verifica se o usuario tem um registro na tabela `user_sector_access` com `sector_id = "vendas"`. O usuario "Joao Ferrari" esta navegando no setor Vendas (visivel no menu lateral), mas aparentemente nao possui esse registro de permissao explicito, entao `hasVendasAccess` retorna `false` e todas as funcionalidades ficam escondidas.

### Causa raiz

O codigo usa `hasVendasAccess` (permissao de acesso ao setor) quando deveria usar `currentSector?.id === "vendas"` (setor atualmente selecionado). Sao conceitos diferentes:

```text
hasVendasAccess = usuario TEM permissao no setor vendas (via tabela user_sector_access ou admin)
currentSector   = setor que o usuario ESTA visualizando agora (via SectorContext)
```

O usuario pode estar no setor Vendas (selecionou manualmente ou foi redirecionado) sem ter um registro explicito em `user_sector_access`. As funcionalidades devem aparecer com base no setor ativo, nao na permissao.

### Solucao

#### `src/pages/Tasks.tsx`

Substituir todas as referencias a `hasVendasAccess` por `isInVendasSector`, derivado do contexto do setor atual:

```text
const isInVendasSector = currentSector?.id === "vendas";
```

Pontos de alteracao (todos no mesmo arquivo):

1. **Coluna "Etapa" no header da tabela** (condicao `hasVendasAccess` na renderizacao do TableHead)
2. **Celula "Etapa" em cada linha** (condicao `hasVendasAccess` na renderizacao do TableCell)
3. **Coluna "Contexto" vs "Cliente"** (texto do header)
4. **Links de Negocio e Lead nas linhas** (condicoes de exibicao)
5. **Filtro de Etapa no FilterBar** (condicao de exibicao)
6. **Filtro de setor nas tarefas** (logica de isolamento por setor)
7. **colspan da mensagem "Nenhuma tarefa"** (ajuste de contagem de colunas)

A variavel `hasVendasAccess` pode ser mantida se for usada em outros contextos (ex: permissao para editar), mas para **exibicao condicional de UI** o correto e usar o setor ativo.

O clique na linha da tarefa (`handleTaskRowClick`) e o follow-up automatico (`handleToggleComplete`) nao estao gateados por `hasVendasAccess`, entao ja devem funcionar -- porem dependem de `task.deal_id` e `allDeals` do hook `useDeals`, que tambem precisam ser verificados para garantir que carregam dados corretamente no contexto vendas.

### Arquivos alterados

- **`src/pages/Tasks.tsx`**: Substituir `hasVendasAccess` por `currentSector?.id === "vendas"` em todas as condicoes de renderizacao de UI

### Resultado esperado

- A coluna "Etapa" aparece sempre que o usuario estiver no setor Vendas, independente de permissoes granulares
- Clicar em uma tarefa com negocio vinculado abre o painel de detalhes do negocio
- Marcar tarefa como concluida abre o dialogo de follow-up automaticamente

