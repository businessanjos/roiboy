
# Plano: Garantir que Item da Venda Não Seja Perdido na Transição para Contrato

## Problema Identificado

Quando um negócio é marcado como "Ganho" e vai para a fila de conciliação, o **produto (Item da Venda)** frequentemente é perdido porque o mapeamento entre o valor do campo personalizado e o produto é **estático e incompleto**.

### Análise de Dados

**Opções disponíveis no campo "Item da Venda":**

| Value | Label | Tem Mapeamento? | Tem Produto? |
|-------|-------|-----------------|--------------|
| `rykas_pass` | Rykas Pass | ❌ Não | ❌ Não existe |
| `rykas_mentoring` | Rykas Mentoring | ✅ Sim | ✅ Existe |
| `ren_rykas_mentoring` | Ren. Rykas Mentoring | ✅ Sim | ✅ Existe |
| `eternum_club` | Eternum Club | ✅ Sim | ✅ Existe |
| `ren_eternum_club` | Ren. Eternum Club | ✅ Sim | ✅ Existe |
| `eternum_private` | Eternum Private | ✅ Sim | ✅ Existe |
| `ren_eternum_private` | Ren. Eternum Private | ✅ Sim | ✅ Existe |
| `eternum_mvp` | Eternum MVP | ❌ Não | ❌ Não existe |
| `anjoszap_basic` | Anjoszap - Basic | ❌ Não | ❌ Não existe |
| `anjoszap_premium` | Anjoszap - Premium | ❌ Não | ❌ Não existe |
| `liberty_ia_mensal` | Liberty IA - Mensal | ❌ Não | ❌ Não existe |
| `liberty_ia_anual` | Liberty IA - Anual | ❌ Não | ❌ Não existe |
| `conselho_anjo` | Conselho de Anjo | ✅ Sim | ✅ Existe |

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                         PROBLEMA ATUAL                                     │
└────────────────────────────────────────────────────────────────────────────┘

   Deal Field Value              Mapeamento Estático             Produtos
   "eternum_mvp"                 ITEM_VENDA_TO_PRODUCT           (banco)
┌─────────────────┐            ┌─────────────────────┐        ┌───────────────┐
│ value_text:     │            │ eternum_mvp: ???    │        │ Eternum Club  │
│ "eternum_mvp"   │────────────│ (NÃO EXISTE!)       │───X────│ Rykas Mentor. │
└─────────────────┘            └─────────────────────┘        │ etc...        │
        │                               │                     └───────────────┘
        │                               │
        ▼                               ▼
   product_id = null ──────────▶ CONTRATO SEM PRODUTO!
```

---

## Causa Raiz

O sistema atual usa um **mapeamento estático** (`ITEM_VENDA_TO_PRODUCT`) em `src/utils/dealToClientContractMapping.ts` que:

1. Precisa ser **atualizado manualmente** quando novos produtos são criados
2. Falha **silenciosamente** quando o value não está mapeado (retorna `null`)
3. Depende de nomes **exatos** dos produtos, que podem ter sido duplicados ou alterados

---

## Solução Proposta

### Abordagem: Mapeamento Dinâmico via Label

Em vez de depender de um objeto estático, buscar o **label da opção selecionada** diretamente do campo personalizado e fazer **match fuzzy** com os produtos existentes.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                         SOLUÇÃO PROPOSTA                                   │
└────────────────────────────────────────────────────────────────────────────┘

   Deal Field Value              Campo Custom Field              Produtos
   "eternum_mvp"                 (options JSONB)                 (banco)
┌─────────────────┐            ┌─────────────────────┐        ┌───────────────┐
│ value_text:     │            │ value: eternum_mvp  │        │ Eternum MVP   │
│ "eternum_mvp"   │────────────│ label: "Eternum MVP"│────────│ (precisa      │
└─────────────────┘            └─────────────────────┘        │  ser criado)  │
        │                               │                     └───────────────┘
        │                               │
        ▼                               ▼
   1. Busca label da opção     2. Match com produto     3. product_id correto!
```

---

## Alterações Técnicas

### Arquivo: `src/utils/dealToClientContractMapping.ts`

#### 1. Nova função para buscar o label da opção selecionada

```typescript
// Busca o label da opção selecionada no campo "Item da Venda"
async function getItemVendaLabel(itemVendaValue: string): Promise<string | null> {
  const { data } = await supabase
    .from('custom_fields')
    .select('options')
    .eq('id', DEAL_FIELD_IDS.ITEM_VENDA)
    .single();
  
  if (!data?.options) return null;
  
  const options = data.options as Array<{ value: string; label: string }>;
  const option = options.find(o => o.value === itemVendaValue);
  
  return option?.label || null;
}
```

#### 2. Atualizar `mapItemVendaToProductId` para usar busca dinâmica

```typescript
export async function mapItemVendaToProductId(itemVendaValue: string): Promise<string | null> {
  // 1. Primeiro, tentar pelo mapeamento estático (compatibilidade)
  const staticProductName = ITEM_VENDA_TO_PRODUCT[itemVendaValue];
  if (staticProductName) {
    const productId = await getProductIdByName(staticProductName);
    if (productId) return productId;
  }
  
  // 2. Fallback: buscar label da opção e fazer match com produto
  const label = await getItemVendaLabel(itemVendaValue);
  if (!label) return null;
  
  // Limpar prefixo "Ren. " se existir para match
  const cleanLabel = label.replace(/^Ren\.\s*/i, '').trim();
  
  const productId = await getProductIdByName(cleanLabel);
  return productId;
}
```

#### 3. Melhorar `getProductIdByName` para busca case-insensitive com match parcial

```typescript
export async function getProductIdByName(productName: string): Promise<string | null> {
  // Invalidar cache para garantir dados atualizados
  // (ou usar cache com TTL curto)
  
  const { data } = await supabase
    .from('products')
    .select('id, name')
    .eq('is_active', true);
  
  if (!data || data.length === 0) return null;
  
  const normalizedSearch = productName.toLowerCase().trim();
  
  // Match exato primeiro
  const exactMatch = data.find(p => 
    p.name.toLowerCase().trim() === normalizedSearch
  );
  if (exactMatch) return exactMatch.id;
  
  // Match parcial (contém)
  const partialMatch = data.find(p => 
    p.name.toLowerCase().includes(normalizedSearch) ||
    normalizedSearch.includes(p.name.toLowerCase())
  );
  if (partialMatch) return partialMatch.id;
  
  return null;
}
```

### Adicionar Logs para Debug

```typescript
export async function mapItemVendaToProductId(itemVendaValue: string): Promise<string | null> {
  console.log('[DealMapping] Mapping item da venda:', itemVendaValue);
  
  // ... lógica ...
  
  if (!productId) {
    console.warn('[DealMapping] Could not find product for:', itemVendaValue, '- label:', label);
  } else {
    console.log('[DealMapping] Mapped to product:', productId);
  }
  
  return productId;
}
```

---

## Atualização do Mapeamento Estático (Medida Imediata)

Enquanto implementamos a solução dinâmica, também atualizar o mapeamento estático para incluir os valores faltantes:

```typescript
const ITEM_VENDA_TO_PRODUCT: Record<string, string> = {
  // Existentes
  'eternum_private': 'Eternum Private',
  'ren_eternum_private': 'Eternum Private',
  'eternum_club': 'Eternum Club',
  'ren_eternum_club': 'Eternum Club',
  'rykas_mentoring': 'Rykas Mentoring',
  'ren_rykas_mentoring': 'Rykas Mentoring',
  'conselho_anjo': 'Conselho de Anjo',
  'makers_club': 'Makers Club',
  'mentoria_makers': 'Mentoria Makers',
  
  // NOVOS - adicionando os faltantes
  'rykas_pass': 'Rykas Pass',           // Produto precisa existir
  'eternum_mvp': 'Eternum MVP',         // Produto precisa existir
  'anjoszap_basic': 'Anjoszap - Basic', // Produto precisa existir
  'anjoszap_premium': 'Anjoszap - Premium', // Produto precisa existir
  'liberty_ia_mensal': 'Liberty IA - Mensal', // Produto precisa existir
  'liberty_ia_anual': 'Liberty IA - Anual', // Produto precisa existir
};
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/utils/dealToClientContractMapping.ts` | Implementar mapeamento dinâmico via label + atualizar mapeamento estático como fallback |

---

## Produtos Faltantes (Ação Manual Necessária)

Os seguintes produtos precisam ser criados na área de Produtos para que o mapeamento funcione:

| Nome do Produto | Status |
|-----------------|--------|
| Rykas Pass | ❌ Criar |
| Eternum MVP | ❌ Criar |
| Anjoszap - Basic | ❌ Criar |
| Anjoszap - Premium | ❌ Criar |
| Liberty IA - Mensal | ❌ Criar |
| Liberty IA - Anual | ❌ Criar |

---

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Deal com "eternum_mvp" ganho | Contrato sem produto | Contrato com "Eternum MVP" |
| Deal com "rykas_pass" ganho | Contrato sem produto | Contrato com "Rykas Pass" |
| Novo produto/opção adicionado | Precisa editar código | Funciona automaticamente |
| Mapeamento inexistente | Falha silenciosa | Log de warning + fallback |
