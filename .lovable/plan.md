
# Plano: Adicionar Campo "Item da Venda" com Produtos Dinâmicos no DealDialog

## Resumo da Solicitação

Adicionar um campo nativo "Item da Venda" no diálogo de criação de negócios que:
1. Carrega os produtos da aba Produtos
2. Auto-preenche o valor com o preço do produto selecionado
3. Permite edição manual do valor
4. É visível e editável na janela de detalhes do negócio
5. É preservado na transição para a fila de conciliação de contratos

## Análise Atual

### Como Funciona Hoje

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                    SISTEMA ATUAL - CAMPO PERSONALIZADO                    │
└────────────────────────────────────────────────────────────────────────────┘

   Nova Negociação              custom_fields           deal_field_values
┌─────────────────────┐       ┌─────────────────┐     ┌─────────────────────┐
│ Título              │       │ Item da Venda   │     │ deal_id             │
│ Etapa               │       │ (tipo: select)  │     │ field_id            │
│ Valor               │       │ options: [      │     │ value_text:         │
│ Responsável         │       │   rykas_pass,   │     │   "rykas_mentoring" │
│ ...                 │       │   eternum_club  │     └─────────────────────┘
│                     │       │ ]               │
│ ❌ SEM Item da Venda│       └─────────────────┘
└─────────────────────┘
         │
         ▼
   DealDetailSheet (após criar)
┌─────────────────────────────────┐
│ Campos Personalizados           │
│ ┌─────────────────────────────┐ │
│ │ Item da Venda: [dropdown]   │ │  ← Só disponível DEPOIS de criar
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Problemas:**
1. O campo "Item da Venda" só é editável APÓS criar o negócio
2. As opções são estáticas (não refletem produtos reais do banco)
3. Selecionar um produto NÃO preenche o valor automaticamente
4. O mapeamento para contrato depende de matching de texto

---

## Solução Proposta

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                    NOVA ABORDAGEM - CAMPO NATIVO                          │
└────────────────────────────────────────────────────────────────────────────┘

   Nova Negociação (ATUALIZADO)
┌─────────────────────────────────────────────────────────────────────────┐
│ Título da Negociação *                                                  │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│                                                                         │
│ ┌─────────────────────┐     ┌─────────────────────────────────────────┐ │
│ │ 🆕 Item da Venda    │     │ Valor (R$)                              │ │
│ │ [Rykas Mentoring ▼] │ ──▶ │ [70.000] (auto-preenchido!)             │ │
│ └─────────────────────┘     └─────────────────────────────────────────┘ │
│                                                                         │
│ ┌─────────────────────┐     ┌─────────────────────────────────────────┐ │
│ │ Etapa               │     │ Previsão de Fechamento                  │ │
│ └─────────────────────┘     └─────────────────────────────────────────┘ │
│                                                                         │
│ Responsável                                                             │
└─────────────────────────────────────────────────────────────────────────┘

   Ao selecionar produto:
   1. Busca preço do produto
   2. Auto-preenche campo "Valor" (editável)
   3. Salva product_id em deal_field_values
```

---

## Alterações Técnicas

### 1. `src/components/sales/DealDialog.tsx`

**Modificações:**

#### A) Novo state para produtos
```typescript
interface Product {
  id: string;
  name: string;
  price: number;
}
const [products, setProducts] = useState<Product[]>([]);
const [selectedProductId, setSelectedProductId] = useState<string>("");
```

#### B) Carregar produtos no useEffect
```typescript
// No mesmo useEffect que carrega clients e teamMembers
const { data: productsData } = await supabase
  .from("products")
  .select("id, name, price")
  .eq("is_active", true)
  .order("name");
setProducts(productsData || []);
```

#### C) Novo campo no formulário (entre Título e grid de Etapa/Valor)
```tsx
{/* Item da Venda + Valor em grid */}
<div className="grid grid-cols-2 gap-4">
  {/* Item da Venda - Select de Produtos */}
  <FormItem>
    <FormLabel>Item da Venda</FormLabel>
    <Select 
      value={selectedProductId}
      onValueChange={(productId) => {
        setSelectedProductId(productId);
        // Auto-preencher valor
        const product = products.find(p => p.id === productId);
        if (product) {
          form.setValue("value", product.price);
        }
      }}
      disabled={isClosed}
    >
      <SelectTrigger>
        <SelectValue placeholder="Selecione o produto" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">Nenhum</SelectItem>
        {products.map(product => (
          <SelectItem key={product.id} value={product.id}>
            <div className="flex items-center justify-between w-full gap-2">
              <span>{product.name}</span>
              <span className="text-xs text-muted-foreground">
                {formatCurrency(product.price)}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </FormItem>

  {/* Valor (existente, movido para cá) */}
  <FormField name="value" ... />
</div>
```

#### D) Salvar o product_id como deal_field_value após criar o negócio

No `handleSubmit`, após criar o deal com sucesso:
```typescript
// Salvar Item da Venda como deal_field_value
if (selectedProductId && createdDealId) {
  await supabase.from("deal_field_values").upsert({
    account_id: currentUser.account_id,
    deal_id: createdDealId,
    field_id: DEAL_FIELD_IDS.ITEM_VENDA,
    value_text: selectedProductId, // Salva o ID do produto diretamente
  }, { onConflict: 'deal_id,field_id' });
}
```

**Nota:** Como o `onSave` atual retorna `void`, precisaremos modificar para retornar o `dealId` criado ou fazer o upsert dentro do hook `useDeals`.

---

### 2. `src/hooks/useDeals.tsx`

**Modificação no `createDeal`:**

Adicionar parâmetro opcional `productId` e salvar em `deal_field_values` após a criação:

```typescript
interface CreateDealData {
  // ... campos existentes
  product_id?: string; // NOVO
}

const createDeal = async (data: CreateDealData): Promise<string | null> => {
  // ... lógica de criação existente
  
  // Após inserir o deal, se tiver product_id, salvar como field_value
  if (data.product_id && insertedDeal?.id) {
    await supabase.from("deal_field_values").upsert({
      account_id: currentUser.account_id,
      deal_id: insertedDeal.id,
      field_id: 'ITEM_VENDA_FIELD_ID', // ID fixo do campo
      value_text: data.product_id,
    }, { onConflict: 'deal_id,field_id' });
  }
  
  return insertedDeal?.id || null;
};
```

---

### 3. `src/components/sales/DealDetailSheet.tsx`

**Adicionar exibição do Item da Venda na área de informações principais:**

Localizar a seção "Campos Personalizados" e garantir que o campo já existente `Item da Venda` (ID: `033b91fb-3add-4c96-aec9-567fefbd0fb2`) seja exibido com destaque.

Como já renderiza campos personalizados via `dealCustomFields`, o "Item da Venda" já aparece lá. Porém, podemos adicionar uma exibição adicional na seção de resumo do negócio para destaque:

```tsx
{/* Na seção de informações principais, após Etapa/Responsável */}
{dealFieldValues[DEAL_FIELD_IDS.ITEM_VENDA] && (
  <div className="flex items-center gap-2">
    <Package className="h-4 w-4 text-muted-foreground" />
    <span className="text-sm">
      {/* Buscar nome do produto pelo ID */}
      {getProductNameById(dealFieldValues[DEAL_FIELD_IDS.ITEM_VENDA])}
    </span>
  </div>
)}
```

---

### 4. `src/utils/dealToClientContractMapping.ts`

**Atualizar o mapeamento para aceitar product_id direto:**

O campo agora salva diretamente o `product_id` (UUID) em vez de um value do select. Atualizar a lógica:

```typescript
export async function mapItemVendaToProductId(itemVendaValue: string): Promise<string | null> {
  if (!itemVendaValue) return null;
  
  // 1. Verificar se é um UUID válido (product_id direto)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(itemVendaValue)) {
    // Validar que o produto existe
    const { data } = await supabase
      .from('products')
      .select('id')
      .eq('id', itemVendaValue)
      .eq('is_active', true)
      .maybeSingle();
    
    if (data) {
      console.log('[DealMapping] Direct product_id found:', itemVendaValue);
      return itemVendaValue;
    }
  }
  
  // 2. Fallback: mapeamento legado (para negócios antigos)
  // ... lógica existente de mapeamento estático e dinâmico
}
```

---

## Fluxo de Dados

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                         FLUXO COMPLETO                                     │
└────────────────────────────────────────────────────────────────────────────┘

   1. CRIAÇÃO DO NEGÓCIO
   ─────────────────────────────────────────────────────────────────────────
   DealDialog                                           Database
   ┌─────────────────────┐                         ┌─────────────────────┐
   │ Item: Rykas Mentor. │ ────── create deal ────▶│ deals               │
   │ Valor: 70.000       │                         │   id: abc123        │
   └─────────────────────┘                         │   value: 70000      │
         │                                         └─────────────────────┘
         │                                                    
         └──── upsert field_value ──────────────▶ ┌─────────────────────┐
                                                  │ deal_field_values   │
                                                  │   deal_id: abc123   │
                                                  │   field_id: ITEM_V. │
                                                  │   value_text: UUID  │
                                                  │   (product_id)      │
                                                  └─────────────────────┘

   2. VISUALIZAÇÃO E EDIÇÃO
   ─────────────────────────────────────────────────────────────────────────
   DealDetailSheet
   ┌─────────────────────────────────────────────────────────────────────┐
   │ $ VALOR: R$ 70.000    │ 📊 PROBABILIDADE: 50%                       │
   ├───────────────────────┼─────────────────────────────────────────────┤
   │ 📦 Item da Venda: Rykas Mentoring (editável via dropdown)          │
   ├─────────────────────────────────────────────────────────────────────┤
   │ Campos Personalizados                                               │
   │ ┌─────────────┐ ┌─────────────┐                                     │
   │ │ Canal Venda │ │ Faturamento │                                     │
   │ └─────────────┘ └─────────────┘                                     │
   └─────────────────────────────────────────────────────────────────────┘

   3. TRANSIÇÃO PARA CONTRATO (GANHO)
   ─────────────────────────────────────────────────────────────────────────
   handleMarkAsWon
   ┌─────────────────────────────────────────────────────────────────────┐
   │ 1. fetchDealCustomFieldValues(dealId)                               │
   │    → { itemVenda: "8d3e9bb6-..." } (product_id)                     │
   │                                                                     │
   │ 2. getContractDataFromDealFields(fieldValues)                       │
   │    → mapItemVendaToProductId("8d3e9bb6-...")                        │
   │    → Verifica se é UUID válido → ✅ Retorna direto                  │
   │                                                                     │
   │ 3. Cria client_contracts com product_id                             │
   │    → { product_id: "8d3e9bb6-...", ... }                            │
   └─────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/sales/DealDialog.tsx` | Adicionar campo "Item da Venda" com produtos, auto-preenchimento de valor, e salvamento do product_id |
| `src/hooks/useDeals.tsx` | Adicionar suporte para `product_id` no `createDeal` e salvar em `deal_field_values` |
| `src/components/sales/DealDetailSheet.tsx` | Exibir o Item da Venda com destaque na área de resumo |
| `src/utils/dealToClientContractMapping.ts` | Atualizar `mapItemVendaToProductId` para aceitar UUID direto primeiro |

---

## Compatibilidade com Negócios Existentes

A solução mantém retrocompatibilidade:
- Negócios antigos usam o mapeamento estático/dinâmico legado
- Novos negócios salvam o `product_id` diretamente
- A função `mapItemVendaToProductId` detecta automaticamente o formato

---

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Criar negócio com produto | Precisa editar depois | Seleciona na criação ✓ |
| Auto-preenchimento de valor | Manual | Automático ao selecionar ✓ |
| Visualizar Item da Venda | Só em campos personalizados | Destaque no resumo ✓ |
| Transição para contrato | Risco de perder produto | product_id direto ✓ |
| Produtos da aba Produtos | Lista estática | Lista dinâmica ✓ |
