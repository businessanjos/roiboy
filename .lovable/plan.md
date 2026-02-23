

## Exibir apenas o nome do mes no eixo X dos graficos empilhados

### Problema

O hook `useStackedVisualData.ts` que gera os dados para graficos de barras empilhadas (como "Qtde Leads MQL - Mes") tem o formato de label de mes **hardcoded** como `'MMM/yy'` (ex: "Jan/26"). Ele ignora completamente a configuracao `appearance.dateDisplayFormat` que ja existe no sistema e suporta tres formatos:

- `'short'` -> "Jan" (apenas mes)
- `'monthYear'` -> "Jan/26" (mes + ano)
- `'full'` -> "Janeiro 2026" (completo)

O hook `useVisualData.ts` (usado por graficos nao-empilhados) ja implementa essa logica corretamente.

### Solucao

Ler `config.appearance?.dateDisplayFormat` dentro de `useStackedVisualData.ts` e aplicar o formato correto nos labels de mes, tanto na secao de Deals quanto na de Leads.

### Alteracoes

**`src/hooks/useStackedVisualData.ts`**

1. Extrair `dateDisplayFormat` do config no inicio de cada funcao de fetch:
   ```
   const displayFormat = config.appearance?.dateDisplayFormat || 'monthYear';
   ```

2. Atualizar `getPeriodLabel` na secao de Deals (linha 144) para usar o formato dinamico em vez de `'MMM/yy'` fixo

3. Atualizar a geracao de labels na secao de Leads (linha 342) para usar o mesmo formato dinamico

4. Os formatos de label para `month` serao:
   - `'short'`: `format(d, 'MMM')` -> "Jan"
   - `'full'`: `format(d, 'MMMM yyyy')` -> "Janeiro 2026"  
   - `'monthYear'` (default): `format(d, 'MMM/yy')` -> "Jan/26"

Para que o visual "Qtde Leads MQL - Mes" exiba apenas o nome do mes, basta que sua config no banco tenha `appearance.dateDisplayFormat = 'short'`. Se o visual nao tiver essa config definida, sera necessario tambem atualizar o registro no banco.

### Nota sobre a config do visual

Se o visual "Qtde Leads MQL - Mes" nao tiver `appearance.dateDisplayFormat` definido (como indicado pelo problema anterior de config incompleta), o default sera `'monthYear'`. Para que mostre apenas o mes, precisaremos **tambem** atualizar o registro no banco para incluir `dateDisplayFormat: 'short'` na appearance, ou alterar o default para `'short'` apenas neste caso.

A abordagem mais limpa: atualizar o `DEFAULT_APPEARANCE.dateDisplayFormat` para continuar sendo `'monthYear'`, mas garantir que o visual especifico tenha a config correta no banco via SQL update.
