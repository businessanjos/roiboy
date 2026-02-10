
## Filtro de Periodo por Data na Pagina de Tarefas

### O que sera feito

Adicionar um filtro de periodo (data inicio e data fim) proximo aos botoes "Personalizar" e "Nova Tarefa" no canto superior direito da pagina de Tarefas. O filtro usara o campo `due_date` (prazo) das tarefas para mostrar somente as que se enquadram no periodo selecionado.

### Como vai funcionar

- Dois inputs de data (inicio e fim) aparecerao no header, antes do botao "Personalizar"
- O usuario pode preencher apenas o inicio, apenas o fim, ou ambos
- Um botao de limpar aparece quando alguma data esta selecionada
- O filtro se aplica sobre o campo `due_date` das tarefas
- Tarefas sem prazo definido serao ocultadas quando o filtro de data estiver ativo
- Os cards de estatisticas (Pendentes, Atrasadas, etc.) refletirao o filtro de periodo aplicado

### Detalhes tecnicos

**Arquivo:** `src/pages/Tasks.tsx`

1. **Novos estados:**
   - `filterDateStart: string` (formato YYYY-MM-DD, vazio por padrao)
   - `filterDateEnd: string` (formato YYYY-MM-DD, vazio por padrao)

2. **UI no header (linha ~938-976):**
   - Inserir antes do botao "Personalizar" dois inputs nativos `type="date"` com labels compactos "De" e "Ate", estilizados com as classes existentes do projeto
   - Um botao pequeno com icone X para limpar as datas quando alguma estiver preenchida

3. **Logica de filtragem (linha ~422-464 no `baseFilteredTasks`):**
   - Adicionar condicao: se `filterDateStart` ou `filterDateEnd` estiverem preenchidos, verificar se `task.due_date` esta dentro do intervalo
   - Tarefas sem `due_date` serao excluidas quando o filtro de data estiver ativo

4. **Indicador de filtros ativos:**
   - Atualizar a prop `filtersActive` do `FilterBar` para incluir a verificacao das datas
   - Atualizar `onClearFilters` para tambem limpar as datas
