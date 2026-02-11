

## Adicionar Podium Visual ao Ranking de Vendedores

### Visao geral

O componente `ConfigurableRanking` sera expandido para exibir um layout dividido: um **podium visual** a esquerda mostrando os 3 primeiros colocados, e a **tabela de ranking** (ja existente) a direita.

### Layout

```text
+---------------------------+-------------------------------+
|                           |                               |
|        PODIUM             |        TABELA RANKING         |
|                           |                               |
|    [Avatar]               |  # | Vendedor | Faturamento   |
|      2o                   |  ...                          |
|  [Avatar]    [Avatar]     |                               |
|    1o          3o         |                               |
|  _____|______|______      |                               |
|  | 2  |  1   |  3  |     |                               |
+---------------------------+-------------------------------+
```

### Detalhes do Podium

- 3 colunas dispostas na ordem: **2o lugar (esquerda)**, **1o lugar (centro, mais alto)**, **3o lugar (direita)**
- Cada coluna do podium tera:
  - Avatar circular do vendedor (com foto real se disponivel)
  - Nome abaixo do avatar
  - Valor do faturamento formatado
  - Uma "base" colorida com altura proporcional a posicao (1o = mais alto, 3o = mais baixo)
- Cores das bases: dourado para 1o, prata para 2o, bronze para 3o
- Se houver menos de 3 vendedores, o podium exibe apenas os disponiveis

### Mudancas tecnicas

**Arquivo: `src/components/insights/visuals/ConfigurableRanking.tsx`**

1. Extrair os top 3 do array `data` para renderizar no podium
2. Adicionar um componente interno `Podium` que renderiza os 3 primeiros com:
   - Layout flex com `items-end` para alinhar as bases pela parte inferior
   - Alturas das bases: 1o = 160px, 2o = 120px, 3o = 90px
   - Avatar com borda colorida (dourado/prata/bronze)
   - Numero da posicao na base
3. Alterar o layout principal de single-column para `flex` com duas areas:
   - Esquerda (~40%): Podium visual
   - Direita (~60%): Tabela existente (sem alteracoes)
4. Em telas/widgets muito pequenos (menos de 400px de largura), o podium sera ocultado e apenas a tabela sera exibida

### Estilo visual

- Bases do podium com gradientes suaves:
  - 1o: gradiente dourado (`from-amber-400 to-amber-500`)
  - 2o: gradiente prata (`from-slate-300 to-slate-400`)
  - 3o: gradiente bronze (`from-orange-400 to-orange-500`)
- Avatares maiores no podium (48-56px) com borda de 3px na cor da medalha
- Nome truncado com `max-w` para nao estourar o layout
- Faturamento em texto menor abaixo do nome

