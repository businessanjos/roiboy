

## Problema: Filtros do visual não são aplicados no drilldown (Explorar Dados)

### Causa raiz

O componente principal (`ConfigurableVisualCard`) aplica corretamente os filtros `leadFieldFilter`, `dealFieldFilter` e `hiddenCategories` nos dados do gráfico. Porém, quando o usuário clica em "Explorar Dados", o hook `useVisualDrilldown.ts` **ignora completamente esses filtros** — ele busca todos os registros sem aplicar nenhuma restrição do visual.

Resultado: o gráfico mostra apenas "Tráfego Pago" (correto), mas ao explorar os dados, aparecem leads de "Instagram" e outras fontes (incorreto).

### Solução

Aplicar os mesmos filtros na função de drilldown:

### Alteração — `src/hooks/useVisualDrilldown.ts`

**1. Importar as funções de filtragem** (linhas 1-7):
- Adicionar imports de `filterByLeadField` e `filterByDealField`

**2. `fetchLeadsRecords` (linha 139-197)** — aplicar `leadFieldFilter` e `hiddenCategories`:
- Após buscar todos os leads, aplicar `filterByLeadField` se `config.leadFieldFilter` estiver configurado
- Após filtrar por `groupName`, remover registros cujo grupo pertence a `hiddenCategories`

**3. `fetchDealsRecords` (linha 54-137)** — aplicar `leadFieldFilter`, `dealFieldFilter` e `hiddenCategories`:
- Após buscar todos os deals, aplicar `filterByLeadField` e `filterByDealField` se configurados
- Remover registros de categorias ocultas

Isso garante que o drilldown respeite exatamente os mesmos filtros aplicados no visual principal.

