
Objetivo
- Corrigir definitivamente o visual “Negócios Ganhos por Produto” para agrupar pelos itens da venda reais (sem cair em “Não informado” quando o item existe).

Diagnóstico (confirmado no código + rede)
- O visual manual está sendo salvo com `config.dimension.field = "product_name"` (visto no request de criação do visual).
- A lógica de agregação por produto implementada recentemente só trata `dimension.field === "product"`.
- Resultado: o agrupamento não passa pelo enriquecimento de Item da Venda (`deal_field_values`) e cai no fallback “Não informado”.
- Isso afeta principalmente visuais criados via `AddVisualModal` (manual).

Plano de implementação

1) Corrigir criação de novos visuais manuais
- Arquivo: `src/components/insights/AddVisualModal.tsx`
- Ajustar `GROUP_BY_TO_DIMENSION.product` de:
  - `field: "product_name"`
  para:
  - `field: "product"`
- Impacto: novos visuais já nascerão com o campo correto.

2) Compatibilidade retroativa para visuais já existentes
- Arquivo: `src/hooks/useVisualData.ts`
- Tratar produto com alias: considerar produto quando `dimension.field` for `"product"` **ou** `"product_name"`.
- Aplicar isso em:
  - bloco que decide chamar `enrichDealsWithProduct`
  - `getGroupKey` (retornar `item.product` para ambos os campos)
- Impacto: visuais antigos salvos com `product_name` passam a funcionar sem recriar.

3) Garantir consistência em gráficos empilhados
- Arquivo: `src/hooks/useStackedVisualData.ts`
- Expandir checagens de produto para aceitar `"product_name"` também (dimensão e, se aplicável, stackBy legado).
- Garantir que a série/categoria use o valor enriquecido de produto quando o agrupamento/segmentação for produto.
- Impacto: evita regressões em variações de visual empilhado com produto.

4) Corrigir “Explorar Dados”/drilldown para produto
- Arquivo: `src/hooks/useVisualDrilldown.ts`
- Quando dimensão for produto (`product`/`product_name`), enriquecer deals com `enrichDealsWithProduct` antes de filtrar por grupo.
- Ajustar `getGroupKey` para alias `product_name` -> `item.product`.
- Impacto: clicar no grupo de produto abre os registros corretos (sem vazio por mismatch de chave).

5) Regra de fallback preservada
- “Não informado” permanece apenas para negócios sem item da venda preenchido de fato.
- Quando houver item preenchido, sempre exibir label resolvido (opção legada ou nome de produto via UUID).

Validação (fim-a-fim)
- Criar novo visual manual: “Negócios Ganhos por Produto” e validar que grupos exibem nomes reais dos itens.
- Reabrir visual antigo já salvo com `product_name` e confirmar que foi corrigido sem recriação.
- Testar com filtros (status ganho + período + vendedor) para confirmar que não volta “Não informado” indevidamente.
- Testar drilldown em uma barra de produto e conferir registros coerentes.

Detalhes técnicos
- Sem mudanças de banco/migração obrigatória.
- Correção 100% em camada de frontend/data hooks, com compatibilidade para configs antigas.
- Estratégia segura: normalização por alias (`product` e `product_name`) para eliminar inconsistência histórica sem quebrar dashboards existentes.
