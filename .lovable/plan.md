

## Corrigir: Visual "Dias Corridos" exibe "Sem dados para exibir"

### Causa raiz

No `ConfigurableChart.tsx`, ha uma verificacao na linha 50 que retorna "Sem dados para exibir" quando `data.length === 0`. Como o gauge de "Dias Corridos" tem a busca de dados desabilitada (nao precisa do banco), o array `processedData` chega sempre vazio, e o componente nunca alcanca o `case 'gauge'`.

### Solucao

Mover a verificacao de dados vazios para **depois** do case `'gauge'`, ou simplesmente excluir o tipo `gauge` dessa verificacao. Gauges geram seus proprios dados internamente.

### Mudancas

**`src/components/insights/visuals/ConfigurableChart.tsx`**

Alterar a guarda de dados vazios para ignorar o tipo `gauge`:

```
if (type !== 'gauge' && (!data || data.length === 0)) {
  return <div>Sem dados para exibir</div>;
}
```

Nenhuma outra mudanca necessaria -- o componente `GaugeFromConfig` ja possui toda a logica interna para calcular os dias corridos do mes atual.

