

## Correcao definitiva: visuais com config incompleta causam tela branca

### Causa raiz

O visual "Qtde Leads MQL - Mes" foi inserido no banco de dados sem os campos `formatting` e `appearance` na coluna `config`. Quando o componente `ConfigurableVisualCard` passa `config.formatting` (que e `undefined`) para `ConfigurableChart`, e depois para `StackedHorizontalBarChart`, o codigo tenta acessar `formatting.type` e `appearance.colorPalette` diretamente -- causando `TypeError: Cannot read properties of undefined`.

Esse mesmo padrao pode afetar qualquer visual futuro que tenha config incompleta.

### Solucao

Aplicar valores default em dois pontos para blindar contra configs incompletas:

#### 1. `src/components/insights/visuals/ConfigurableVisualCard.tsx`

Garantir que `formatting` e `appearance` sempre tenham valores validos antes de serem passados ao `ConfigurableChart`:

```typescript
const safeFormatting = config.formatting || { type: 'number' as FormatType, decimals: 0 };
const safeAppearance = config.appearance || DEFAULT_APPEARANCE;
```

Passar `safeFormatting` e `safeAppearance` no JSX em vez de `config.formatting` e `config.appearance`.

#### 2. `src/components/insights/visuals/StackedHorizontalBarChart.tsx`

Adicionar defaults defensivos no inicio do componente para caso os props cheguem incompletos:

```typescript
const safeFormatting = formatting || { type: 'number' as FormatType, decimals: 0 };
const safeAppearance = appearance || DEFAULT_APPEARANCE;
```

Usar `safeFormatting` e `safeAppearance` em todo o componente.

### Por que esta solucao e definitiva

- Protege contra qualquer visual futuro inserido com config parcial
- Resolve os dois erros nos logs: `Cannot read 'type'` (formatting) e `Cannot read 'aggregation'` (ja corrigido anteriormente)
- Nao altera a logica de negocio -- apenas garante defaults seguros
