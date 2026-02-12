

## Correcao: "Item da Venda" salvo como UUID em vez do valor correto do select

### Problema identificado

O campo "Item da Venda" e do tipo **select** com opcoes pre-definidas:

| Label | Value |
|-------|-------|
| Rykas Pass | `rykas_pass` |
| Rykas Mentoring | `rykas_mentoring` |
| Eternum Club | `eternum_club` |
| ... | ... |

O codigo atual faz fuzzy match contra a tabela `products` e salva o **UUID do produto** (ex: `8d3e9bb6-054b-44b3-952f-5920e0ed8775`) no campo. Porem, a UI espera o **value da opcao** (ex: `rykas_mentoring`). Como o UUID nao corresponde a nenhuma opcao do select, o campo aparece vazio.

### Solucao

Alem do fuzzy match contra a tabela `products` (que continua necessario para obter o preco e vincular o produto), adicionar um **segundo match** contra as opcoes do campo select para determinar o `value` correto a salvar.

O fluxo sera:

```text
1. Recebe "Rykas Mentoring" do n8n
2. Busca opcoes do campo select (custom_fields.options)
3. Match "Rykas Mentoring" -> encontra opcao com label "Rykas Mentoring" -> value "rykas_mentoring"
4. Salva "rykas_mentoring" em deal_field_values.value_text
5. Busca produto na tabela products para obter preco (auto-fill do valor do negocio)
```

### Mudanca tecnica

**Arquivo:** `supabase/functions/create-deal/index.ts`

Na secao de fuzzy match do `product_id`:

1. Buscar as opcoes do campo select `033b91fb` na tabela `custom_fields`
2. Fazer match do nome recebido contra as labels das opcoes (case-insensitive, com suporte a match parcial)
3. Salvar o `value` da opcao encontrada (ex: `rykas_mentoring`) em vez do UUID do produto
4. Se nenhuma opcao corresponder, salvar o nome original como fallback
5. Manter o match contra `products` para obter o preco

### Resultado esperado

- O campo "Item da Venda" aparecera preenchido corretamente na UI com a tag colorida (ex: "Rykas Mentoring" em azul)
- O valor do negocio continuara sendo preenchido automaticamente com o preco do produto
- Compativel com todos os itens: Rykas Pass, Rykas Mentoring, Eternum Club, etc.

