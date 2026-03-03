

## Corrigir desalinhamento do funil por texto forçando largura da barra

### Problema
A barra usa `flex-1` mas sem `min-w-0`, então o conteúdo de texto (nomes longos como "Call Comercial Agendada") impede que a barra encolha abaixo do tamanho do texto. Isso força barras menores a ficarem maiores do que a largura percentual calculada, quebrando o alinhamento.

### Solução
1. Adicionar `min-w-0` e `overflow-hidden` na barra colorida para permitir que ela encolha
2. O nome já tem `truncate` — manter isso
3. Adicionar `whitespace-nowrap` no nome para garantir que não quebre linha
4. Para barras muito estreitas, reduzir o `fontSize` proporcionalmente ao `widthPct`

### Arquivos
**`src/components/insights/visuals/ConfigurableFunnel.tsx`**
- Linha 68: adicionar `min-w-0 overflow-hidden` ao div da barra
- Linha 71: adicionar `whitespace-nowrap` ao span do nome
- Calcular fontSize dinâmico: quando `widthPct < 40`, reduzir fonte proporcionalmente (ex: `Math.round(13 * m * Math.min(1, widthPct / 40))` com mínimo de 10px)
- Aplicar mesma lógica à seção Ganhos (linhas 97, 100)

