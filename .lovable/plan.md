

## Adicionar opcao de ocultar vendedores no visual Calls Comerciais

### O que sera feito

Adicionar uma secao no painel de ajustes do visual (VisualQuickSettings) que permite ao usuario selecionar quais vendedores deseja ocultar. O componente ConfigurableCallCommercial filtrara os vendedores ocultos antes de renderizar.

### Como vai funcionar

1. No painel de ajustes (icone de engrenagem), quando o visual for do tipo `call_commercial`, aparecera uma lista de checkboxes com os nomes dos vendedores
2. O usuario desmarca os vendedores que nao quer exibir
3. Ao salvar, os IDs/nomes ocultos sao persistidos no campo `config` do visual
4. O componente filtra os vendedores ocultos na renderizacao

### Mudancas tecnicas

**1. Arquivo: `src/components/insights/visual-builder/types.ts`**
- Adicionar campo opcional `hiddenUsers?: string[]` na interface `VisualConfig`
- Armazenara os nomes dos vendedores que foram ocultados

**2. Arquivo: `src/components/insights/visuals/VisualQuickSettings.tsx`**
- Detectar quando `chart_type === 'call_commercial'`
- Adicionar estado local `hiddenUsers` (array de strings)
- Buscar a lista de vendedores do account (via Supabase, tabela `users`)
- Renderizar uma secao "Vendedores Visiveis" com checkboxes para cada vendedor
- Ao salvar, incluir `hiddenUsers` no config

**3. Arquivo: `src/components/insights/visuals/ConfigurableCallCommercial.tsx`**
- Receber `hiddenUsers` via props (extraido do config)
- Filtrar `data` removendo itens cujo `name` esta na lista de ocultos

**4. Arquivo: `src/components/insights/visuals/ConfigurableChart.tsx`**
- Passar `hiddenUsers` do config para o componente `ConfigurableCallCommercial`

### Interface visual no painel de ajustes

```text
Vendedores Visiveis
---
[x] Jonathan Marcato
[x] Darlan Ferreira
[ ] Vanessa Minelli      <- desmarcado = oculto
[x] George Oliveira
[ ] Everton Pieri         <- desmarcado = oculto
```

Vendedores desmarcados nao aparecerao no visual apos salvar.

