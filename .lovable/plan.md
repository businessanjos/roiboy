

## Exibir tag "Faturamento Atual" nos cards do Pipeline

### O que sera feito

Adicionar uma tag sutil em cada card de negocio no pipeline mostrando o valor do campo personalizado "Faturamento Atual". Se o negocio nao tiver esse dado preenchido, a tag simplesmente nao aparece.

### Abordagem

Para evitar 541+ queries individuais (uma por card), a busca sera feita em lote no componente `DealKanban`, que ja tem acesso a todos os deals. O mapa de valores sera passado via props ate o `DealCard`.

### Detalhes tecnicos

**Arquivo 1: `src/components/sales/DealKanban.tsx`**

- Adicionar um `useEffect` que busca todos os `deal_field_values` com `field_id = 'ed5c7c0e-0740-4945-b982-70a593ffae0c'` (Faturamento Atual) para os deals carregados
- Buscar tambem as `options` do campo para mapear `value_text` para o `label` legivel (ex: `acima_100k` -> `Acima de 100 mil reais`)
- Criar um `Record<string, string>` mapeando `deal_id` -> label do faturamento
- Passar esse mapa como prop `faturamentoMap` para `DealKanbanColumn`

**Arquivo 2: `src/components/sales/DealKanbanColumn.tsx`**

- Receber a nova prop `faturamentoMap?: Record<string, string>`
- Repassar o valor correspondente para cada `DealCard` como `faturamentoLabel`

**Arquivo 3: `src/components/sales/DealCard.tsx`**

- Receber nova prop opcional `faturamentoLabel?: string`
- Renderizar uma Badge sutil (estilo outline, cor neutra, texto pequeno) na area de tags do card, junto com as tags existentes, exibindo o label do faturamento
- Se `faturamentoLabel` for undefined/null, nao renderizar nada

### Visual da tag

A tag tera um estilo discreto e consistente com as tags ja existentes no card:

```text
[Acima de 100 mil reais]   <-- Badge outline, text-[10px], icone opcional de "$"
```

Sera posicionada na linha de tags existentes, antes das tags normais do deal.

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/sales/DealKanban.tsx` | Busca em lote dos valores de Faturamento Atual + mapa |
| `src/components/sales/DealKanbanColumn.tsx` | Repassa prop faturamentoMap para DealCard |
| `src/components/sales/DealCard.tsx` | Renderiza Badge com faturamentoLabel |

