

## Plano: Filtro inline na coluna "Origem da Venda" da tabela de leads

### O que será feito
Adicionar um botão de filtro pequeno (ícone de funil) ao lado do header da coluna "Origem da Venda" na `ConfigurableTable`. Ao clicar, abre um Popover com checkboxes listando os valores únicos de `deal_source` presentes nos dados carregados. O filtro é client-side (filtra os records já em memória).

### Alterações

#### `src/components/insights/visuals/ConfigurableTable.tsx`

1. **Estado de filtro**: Adicionar `const [dealSourceFilter, setDealSourceFilter] = useState<Set<string>>(new Set())` para armazenar os valores selecionados.

2. **Extrair valores únicos**: Usar `useMemo` para coletar todos os valores únicos de `deal_source` dos records carregados (excluindo `-` e vazios).

3. **Filtrar records**: Aplicar o filtro client-side antes de renderizar — se `dealSourceFilter` não estiver vazio, mostrar apenas records cujo `deal_source` está no set.

4. **UI no header**: Para a coluna `deal_source`, renderizar um botão com ícone `Filter` (lucide) ao lado do label. Ao clicar, abre um `Popover` contendo:
   - Lista de checkboxes com os valores únicos
   - Botão "Limpar" para remover todos os filtros
   - O ícone fica destacado (cor primária) quando há filtro ativo

5. **Imports adicionais**: `Popover, PopoverTrigger, PopoverContent` do shadcn, `Checkbox` do shadcn, `Filter` do lucide-react.

### Fluxo
```
Header "Origem da Venda" [🔽 ícone filtro]
  → Click → Popover com checkboxes dos valores únicos
  → Selecionar valores → tabela filtra client-side instantaneamente
  → Ícone fica highlighted quando filtro ativo
```

### Arquivo afetado
- **Editar**: `src/components/insights/visuals/ConfigurableTable.tsx`

