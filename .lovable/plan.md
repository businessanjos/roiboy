

## Novo Visual: Call Comercial Agendada x Concluida

### O que sera criado

Um novo tipo de visual para o sistema de Insights que exibe, para cada vendedor, dois contadores lado a lado:
- **Esquerda**: quantidade de tarefas do tipo "Call Comercial Agendada" **em aberto** (sem `completed_at`)
- **Direita**: quantidade de tarefas do tipo "Call Comercial Concluida" **concluidas** (com `completed_at`)

Cada vendedor sera representado com seu avatar circular acima dos contadores, seguindo o layout da imagem de referencia.

### Layout visual

```text
   [Avatar1]        [Avatar2]        [Avatar3]
   Nome 1           Nome 2           Nome 3
  +------+------+  +------+------+  +------+------+
  |  3   |  10  |  |  0   |  13  |  |  1   |   2  |
  | Agend| Conc |  | Agend| Conc |  | Agend| Conc |
  +------+------+  +------+------+  +------+------+
```

Cada card de vendedor tera:
- Avatar circular com foto (ou iniciais como fallback)
- Nome do vendedor abaixo do avatar
- Dois "pills" lado a lado: esquerdo com icone de calendario (agendadas em aberto) e direito com icone de check (concluidas)

### Detalhes tecnicos

**1. Novo tipo de chart: `'call_commercial'`**

- **Arquivo**: `src/components/insights/visual-builder/types.ts`
  - Adicionar `'call_commercial'` ao tipo `ChartType`
  - Adicionar `'tasks'` ao tipo `DataSource` e ao `DATA_SOURCE_OPTIONS`
  - Adicionar entrada em `CHART_TYPE_OPTIONS` com label "Calls Comerciais" e icone Phone

**2. Novo componente visual: `ConfigurableCallCommercial.tsx`**

- **Arquivo**: `src/components/insights/visuals/ConfigurableCallCommercial.tsx`
  - Componente que recebe dados ja agregados por vendedor
  - Cada vendedor exibido como um card horizontal com avatar + 2 contadores
  - Layout em grid responsivo (flex-wrap) para acomodar multiplos vendedores
  - Busca avatares dos usuarios no banco (mesmo padrao do `ConfigurableRanking`)
  - Estilo visual: pills arredondadas em cinza com numeros grandes, icones pequenos para diferenciar agendada vs concluida

**3. Busca de dados dedicada para tasks**

- **Arquivo**: `src/hooks/useVisualData.ts`
  - Adicionar novo case `'tasks'` no switch do `dataSource`
  - Nova funcao `fetchTasksCallCommercialData` que:
    - Consulta `internal_tasks` com JOIN em `activity_types` (filtro por nome "Call Comercial Agendada" e "Call Comercial Concluida")
    - JOIN em `users` para obter o nome do vendedor
    - Agrupa por vendedor
    - Retorna um formato especial com dois valores por vendedor (agendadas em aberto + concluidas)

**4. Roteamento no ConfigurableChart**

- **Arquivo**: `src/components/insights/visuals/ConfigurableChart.tsx`
  - Adicionar case `'call_commercial'` que renderiza o novo `ConfigurableCallCommercial`

**5. Fluxo de criacao no AddVisualModal**

- **Arquivo**: `src/components/insights/AddVisualModal.tsx`
  - Adicionar "Calls Comerciais" como opcao de tipo de visual (com icone Phone)
  - Fluxo simplificado em 2 passos (tipo + titulo), similar ao ranking
  - Config pre-definida: dataSource = 'tasks', sem necessidade de escolher metrica ou agrupamento

**6. Seletor de tipo de chart**

- **Arquivo**: `src/components/insights/visual-builder/ChartTypeSelector.tsx`
  - Adicionar icone para o novo tipo `call_commercial`

### Formato dos dados

O componente recebera dados no formato:

```text
[
  { name: "Darlan Ferreira", value: 6, count: 36 },
  { name: "Jonathan Marcato", value: 6, count: 46 },
  ...
]
```

Onde:
- `value` = quantidade de "Call Comercial Agendada" em aberto
- `count` = quantidade de "Call Comercial Concluida" concluidas

Isso reutiliza a interface `AggregatedDataPoint` ja existente sem precisar alterar a estrutura de dados.

### Arquivos a criar/modificar

| Arquivo | Acao |
|---------|------|
| `src/components/insights/visual-builder/types.ts` | Adicionar tipo `call_commercial` e data source `tasks` |
| `src/components/insights/visuals/ConfigurableCallCommercial.tsx` | **Criar** - novo componente visual |
| `src/components/insights/visuals/ConfigurableChart.tsx` | Adicionar case para `call_commercial` |
| `src/hooks/useVisualData.ts` | Adicionar fetch de dados de tasks |
| `src/components/insights/AddVisualModal.tsx` | Adicionar opcao de criacao |
| `src/components/insights/visual-builder/ChartTypeSelector.tsx` | Adicionar icone |

