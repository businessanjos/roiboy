

## Problema
O botão de alternância de tipo de gráfico (ícone `ArrowLeftRight`) não aparece em visuais empilhados porque o `chart_type` armazenado no banco é `bar_stacked`, que não está no conjunto de tipos intercambiáveis (`SWITCHABLE_SET`).

O `SWITCHABLE_SET` atual contém apenas: `bar`, `bar_horizontal`, `line`, `pie`.

## Correção

**Arquivo: `src/components/insights/visuals/ConfigurableVisualCard.tsx`**

1. Expandir `SWITCHABLE_TYPES` para incluir `bar_stacked`:
   ```
   { type: 'bar_stacked', icon: BarChart3, label: 'Empilhado' }
   ```

2. Ao alternar de `bar_stacked` para outro tipo (ex: `line`, `pie`), o visual mantém a configuração de empilhamento (`stackBy`/`stackByCustomField`) no config — a renderização do `ConfigurableChart` já lida com isso naturalmente (ignora stacking quando o tipo não suporta).

3. Ao alternar de outro tipo para `bar_stacked`, o visual volta a empilhar se já tiver `stackBy`/`stackByCustomField` no config.

Isso garante que o botão apareça em **todos** os visuais de gráfico (incluindo empilhados) e que a alternância funcione sem perda de configuração.

