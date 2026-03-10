

## Diagnóstico: Campos personalizados no seletor de colunas

### Análise

O código em `DrilldownDialog.tsx` já contém a lógica completa para buscar e exibir campos personalizados (linhas 57-76 para a query, linhas 213-230 para renderização). Confirmei que o banco de dados contém 19 campos personalizados ativos com `show_in_deals = true` para a conta do usuário.

O problema mais provável é a **altura do ScrollArea** (`max-h-72` = 288px). Com 9 campos nativos (cada um ~32px) + header + padding, o conteúdo nativo já ocupa ~290px. Os campos personalizados ficam **abaixo da área visível** e a scrollbar do `ScrollArea` pode não ser suficientemente visível para indicar que há mais conteúdo.

### Correção

**Arquivo: `src/components/insights/visuals/DrilldownDialog.tsx`**

1. Aumentar `max-h-72` para `max-h-[400px]` no ScrollArea para acomodar campos nativos + personalizados
2. Mover a seção "Campos personalizados" para ser visualmente mais destacada com um sticky header ou separação clara
3. Aumentar a largura do popover de `w-64` para `w-72` para melhor legibilidade

Isso garante que o usuário veja os campos personalizados sem precisar rolar, ou pelo menos que a scrollbar seja mais evidente.

