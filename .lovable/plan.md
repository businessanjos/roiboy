
## Melhorias no create-deal: Item da Venda automatico

### Contexto atual

A edge function `create-deal` ja recebe o campo `product_id` (nome do produto, ex: "Rykas Mentoring") e faz fuzzy match contra a tabela `products`. O UUID encontrado e salvo no campo personalizado "Item da Venda" (ID: `033b91fb`). Porem, ha melhorias a fazer para garantir que tudo funcione de ponta a ponta.

### Melhorias planejadas

#### 1. Corrigir duplicidade de insercao do "Item da Venda"

Atualmente, o `product_id` e salvo na secao de fuzzy match (linha ~156) E tambem pode ser salvo novamente na secao de campos customizados em batch se o parametro coincidir. Vamos garantir que o campo so seja inserido uma vez, usando `upsert` com `onConflict: 'deal_id,field_id'` para evitar erros.

#### 2. Auto-preencher o valor do negocio com o preco do produto

Quando `payload.value` nao for enviado (ou for 0), e o produto for encontrado, usar o `price` do produto como valor do negocio:

```text
// Se produto encontrado e valor nao informado:
if (productMatch && (!payload.value || payload.value === 0)) {
  await supabase.from("deals").update({ value: productMatch.price }).eq("id", newDeal.id);
}
```

#### 3. Melhorar o fuzzy match para lidar com `\n` e espacos extras

O campo vindo do n8n pode conter `\n` no final (como visto na imagem: "Rykas Mentoring\n"). Adicionar sanitizacao:

```text
const productName = payload.product_id.trim().replace(/\\n/g, '').replace(/\n/g, '');
```

#### 4. Usar upsert ao inves de insert para evitar conflitos

Trocar `insert` por `upsert` no salvamento do campo "Item da Venda", garantindo idempotencia caso a funcao seja chamada mais de uma vez.

### Arquivo modificado

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/create-deal/index.ts` | Sanitizar nome do produto, upsert no campo Item da Venda, auto-preencher valor do negocio com preco do produto |

### Resultado esperado

- O campo "Item da Venda" nos campos personalizados sera preenchido corretamente com o UUID do produto
- O valor do negocio sera preenchido automaticamente com o preco do produto quando nao informado
- Nomes com caracteres extras (`\n`, espacos) serao limpos antes do matching
- Sem risco de duplicidade de registros em `deal_field_values`
