
## Corrigir formato de funil — remover espaço vazio após as barras

### Problema
Os retângulos vermelhos no print mostram espaço vazio à direita de cada barra. O wrapper `flex-1` faz o container ocupar 100% da largura, e a barra fica menor dentro dele. A porcentagem da direita fica na borda direita da tela, não logo após a barra.

### Solução
Mover o `width: widthPct%` para o **row inteiro** (o `div` que contém label esquerda + barra + label direita), em vez de no wrapper interno. A barra dentro do row usa `flex-1` para preencher o espaço entre os dois labels. Assim cada linha tem largura proporcional, criando o formato de funil.

Layout:
```text
|<---------- widthPct% ---------->|
[%]  ████████ Nome  Valor ████████  [%]

|<------- widthPct% ------->|
[%]  ██████ Nome  Valor ██████  [%]

|<---- widthPct% ---->|
[%]  ████ Nome  Valor ████  [%]
```

### Arquivos

1. **`ConfigurableFunnel.tsx`**
   - Row div: remover `w-full`, adicionar `style={{ width: widthPct% }}`
   - Remover wrapper `flex-1` intermediário
   - Barra colorida: usar `flex-1` e remover `width` inline
   - Mesmo para seção Ganhos

2. **`SalesFunnelChart.tsx`**
   - Mesma lógica aplicada ao funil do WhatsApp
