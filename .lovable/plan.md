

## Duas alteracoes necessarias

### 1. Atualizar Edge Function `get-lead-deals`

Atualmente o campo `product_id` retorna o valor bruto do campo personalizado (ex: `rykas_mentoring`). Precisa resolver esse valor para o UUID real do produto e incluir tambem o nome.

**Arquivo**: `supabase/functions/get-lead-deals/index.ts`

**Logica**:
1. Apos buscar os `deal_field_values`, obter a definicao do campo customizado (`custom_fields`) para mapear option keys para labels
2. Buscar na tabela `products` pelo nome correspondente a label
3. Retornar `product_id` como UUID real e `product_name` como nome do produto

**Output por deal passara a ter**:
- `product_id`: UUID real do produto (ex: `8d3e9bb6-054b-44b3-952f-5920e0ed8775`) ou null
- `product_name`: nome do produto (ex: `Rykas Mentoring`) ou null

### 2. Codigo JavaScript para o node "Filtrar" no n8n

O codigo para o node Code do n8n que filtra e passa adiante somente o negocio mais recente cujo produto corresponda ao produto do contrato:

```javascript
// Recebe os deals do node anterior e o product_id do contrato
const deals = $input.first().json.deals || [];
const contractProductId = $('step3_find_product').first().json.product_id;

// Filtra deals que tem o mesmo product_id do contrato
const matching = deals.filter(d => d.product_id && d.product_id === contractProductId);

// Ordena por created_at decrescente e pega o mais recente
matching.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

if (matching.length > 0) {
  return [{ json: matching[0] }];
}

// Se nenhum deal corresponder, retorna vazio
return [];
```

> **Nota**: Ajuste `$('step3_find_product')` para o nome correto do node que contem o `product_id` do contrato. O codigo compara UUIDs diretamente, garantindo precisao maxima.

