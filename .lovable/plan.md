

## Persistir Colunas e Reordenar no "Explorar Dados"

### O que muda

1. **Persistência de colunas selecionadas**: Ao alterar colunas no popover, aparece um botão "Salvar" sutil. Ao clicar, a seleção (e ordem) é salva no `localStorage` por visual (usando `visual.id` + `dataSource`). Ao reabrir o dialog, restaura a configuração salva em vez dos defaults.

2. **Reordenação de colunas por drag-and-drop**: Os cabeçalhos da tabela no "Explorar Dados" ganham suporte a arrastar e soltar para reordenar livremente. A nova ordem é refletida imediatamente e salva junto com a seleção ao clicar "Salvar".

### Alterações técnicas

**Arquivo: `src/components/insights/visuals/DrilldownDialog.tsx`**

- Adicionar `visualId` como prop (vindo de `visual.id` via `ConfigurableVisualCard`)
- Criar chave de localStorage: `roy_drilldown_cols_{userId}_{visualId}`
- No `useEffect` de abertura: carregar colunas salvas do localStorage; se não houver, usar `defaultCols`
- Rastrear se houve mudança vs. estado salvo (`isDirty`) para mostrar/esconder o botão "Salvar"
- Botão "Salvar" aparece no rodapé do Popover de colunas quando `isDirty = true`
- Ao salvar: gravar `selectedColumns` (array ordenado) no localStorage
- Para reordenação dos cabeçalhos: implementar drag-and-drop nativo (HTML5 `draggable`, `onDragStart`, `onDragOver`, `onDrop`) nos `<TableHead>` — atualiza `selectedColumns` ao soltar, sem dependência externa adicional

**Arquivo: `src/components/insights/visuals/ConfigurableVisualCard.tsx`**

- Passar `visual.id` como prop `visualId` ao `<DrilldownDialog>`

**Interface `DrilldownDialogProps`**:
- Adicionar campo `visualId?: string`

### Fluxo do usuário
1. Abre "Explorar Dados" → colunas carregadas do localStorage (ou defaults)
2. Altera seleção de colunas → botão "Salvar" aparece no popover
3. Clica "Salvar" → persiste no localStorage, botão desaparece
4. Arrasta cabeçalho de coluna na tabela → reordena colunas imediatamente
5. Reabre dialog → colunas e ordem restauradas

